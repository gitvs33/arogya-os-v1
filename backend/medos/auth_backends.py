"""
Keycloak JWT authentication backend for DRF.

Validates Bearer tokens signed by a Keycloak realm using JWKS.  Falls back
to the existing ``TokenAuthentication`` if Keycloak is not configured
(checked via ``settings.KEYCLOAK_SERVER_URL``).

Usage
-----
Add to ``REST_FRAMEWORK['DEFAULT_AUTHENTICATION_CLASSES']`` in settings.py::

    'medos.auth_backends.KeycloakJwtAuthentication',

Make sure ``TokenAuthentication`` remains in the list to act as a fallback.
"""
import logging
from datetime import datetime, timedelta, timezone

import jwt
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.authentication import TokenAuthentication
from rest_framework.exceptions import AuthenticationFailed

logger = logging.getLogger(__name__)

UserModel = get_user_model()

# ── Cache keys ───────────────────────────────────────────────────────────────
_JWKS_CACHE_KEY = 'keycloak:jwks'
_JWKS_CACHE_TTL = 3600  # 1 hour


class KeycloakJwtAuthentication(TokenAuthentication):
    """DRF authentication backend that validates Keycloak-issued JWTs.

    The authentication flow:

    1. Extract the ``Authorization: Bearer <token>`` header.
    2. If ``settings.KEYCLOAK_SERVER_URL`` is empty / unset → return ``None``
       so DRF falls through to the next authenticator (e.g. ``TokenAuthentication``).
    3. Fetch the Keycloak realm's JWKS (cached in Redis for 1 hour).
    4. Decode and verify the JWT using the appropriate public key.
    5. Look up (or auto-create) the Django user matching the token's ``sub``
       or ``preferred_username`` claim.
    6. Return the ``(user, token)`` tuple.
    """

    keyword = 'Bearer'  # Override the default 'Token' keyword

    # ── Configuration (read from django.conf) ────────────────────────────

    @property
    def _is_configured(self):
        return bool(getattr(settings, 'KEYCLOAK_SERVER_URL', None))

    @property
    def _server_url(self):
        return settings.KEYCLOAK_SERVER_URL.rstrip('/')

    @property
    def _realm(self):
        return getattr(settings, 'KEYCLOAK_REALM', None)

    @property
    def _client_id(self):
        return getattr(settings, 'KEYCLOAK_CLIENT_ID', None)

    # ── JWKS management ──────────────────────────────────────────────────

    def _get_jwks_url(self):
        return (
            f'{self._server_url}/realms/{self._realm}'
            '/protocol/openid-connect/certs'
        )

    def _fetch_jwks(self):
        """Fetch the JWKS from Keycloak, caching the result."""
        import requests  # lazy import to avoid top-level dependency

        jwks = cache.get(_JWKS_CACHE_KEY)
        if jwks is not None:
            return jwks

        url = self._get_jwks_url()
        try:
            resp = requests.get(url, timeout=10)
            resp.raise_for_status()
            jwks = resp.json()
        except requests.RequestException as exc:
            logger.warning('Failed to fetch JWKS from %s: %s', url, exc)
            return None

        cache.set(_JWKS_CACHE_KEY, jwks, _JWKS_CACHE_TTL)
        return jwks

    def _get_public_key(self, headers, jwks):
        """Locate the matching JWK by ``kid`` and return a PEM-formatted key.

        Falls back to the first key if ``kid`` is missing or no match is
        found (a common scenario for realms with a single key).
        """
        kid = headers.get('kid')
        matching_key = None

        if jwks and 'keys' in jwks:
            for key in jwks['keys']:
                if kid and key.get('kid') == kid:
                    matching_key = key
                    break
            if matching_key is None and jwks['keys']:
                # Fallback: use the first key
                matching_key = jwks['keys'][0]

        if matching_key is None:
            return None

        # Build a public key object from the JWK dict
        try:
            return jwt.algorithms.RSAAlgorithm.from_jwk(
                jwt.algorithms.RSAAlgorithm.to_jwk(matching_key)
            )
        except Exception as exc:
            logger.warning('Failed to convert JWK to public key: %s', exc)
            return None

    # ── Token validation ─────────────────────────────────────────────────

    def _decode_token(self, token):
        """Decode and verify the JWT using Keycloak's JWKS."""
        # Unverified header read to get kid for key selection
        try:
            headers = jwt.get_unverified_header(token)
        except jwt.DecodeError as exc:
            raise AuthenticationFailed(f'Invalid token header: {exc}')

        jwks = self._fetch_jwks()
        if not jwks:
            raise AuthenticationFailed(
                'Unable to fetch JWKS from Keycloak. '
                'Is the Keycloak server reachable?'
            )

        public_key = self._get_public_key(headers, jwks)
        if not public_key:
            raise AuthenticationFailed('No suitable public key found in JWKS')

        # Audience is typically the client ID in Keycloak
        audience = self._client_id
        issuer = f'{self._server_url}/realms/{self._realm}'

        try:
            payload = jwt.decode(
                token,
                key=public_key,
                algorithms=['RS256'],
                audience=audience,
                issuer=issuer,
                options={
                    'verify_exp': True,
                    'verify_iat': True,
                },
            )
        except jwt.ExpiredSignatureError:
            raise AuthenticationFailed('Token has expired.')
        except jwt.InvalidAudienceError:
            raise AuthenticationFailed(
                f'Token audience does not match client "{audience}".'
            )
        except jwt.InvalidIssuerError:
            raise AuthenticationFailed(
                f'Token issuer does not match realm "{issuer}".'
            )
        except jwt.PyJWTError as exc:
            raise AuthenticationFailed(f'Token validation failed: {exc}')

        return payload

    # ── User resolution ──────────────────────────────────────────────────

    def _get_or_create_user(self, payload):
        """Resolve a Django user from the JWT payload.

        Matching is attempted in order:
        1. ``sub`` field (Keycloak user UUID).
        2. ``preferred_username``.
        3. ``email``.

        If all are missing, a minimal user is created with the ``sub`` as
        the username to guarantee a valid user object is returned.
        """
        sub = payload.get('sub')
        preferred_username = payload.get('preferred_username', '')
        email = payload.get('email', '')

        # Try matching by sub (UUID)
        if sub:
            try:
                return UserModel.objects.get(  # nosec: sub is a UUID string
                    username=sub
                )
            except UserModel.DoesNotExist:
                pass

        # Try matching by email
        if email:
            try:
                return UserModel.objects.get(email=email)
            except UserModel.DoesNotExist:
                pass

        # Auto-create the user
        username = sub or preferred_username or email.split('@')[0]
        user = UserModel.objects.create_user(
            username=username,
            email=email or '',
            first_name=payload.get('given_name', ''),
            last_name=payload.get('family_name', ''),
        )
        logger.info('Auto-created Django user %s from Keycloak JWT', username)
        return user

    # ── DRF hook ─────────────────────────────────────────────────────────

    def authenticate_credentials(self, key):
        """Override ``TokenAuthentication.authenticate_credentials``.

        *key* is the raw Bearer token string.
        """
        # ── If Keycloak is not configured → let DRF try the next backend ───
        if not self._is_configured:
            logger.debug(
                'Keycloak not configured (KEYCLOAK_SERVER_URL not set). '
                'Skipping KeycloakJwtAuthentication.'
            )
            return None

        payload = self._decode_token(key)
        user = self._get_or_create_user(payload)

        # Update last_login on every request for audit trail
        user.last_login = datetime.now(tz=timezone.utc)
        user.save(update_fields=['last_login'])

        return (user, key)
