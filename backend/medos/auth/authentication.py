"""
DRF authentication backends for MedOS.

Supports:
- ``CookieTokenAuthentication`` — reads the auth token from an HttpOnly cookie.
- ``SupabaseJwtAuthentication`` — validates Bearer tokens issued by Supabase Auth.
"""
import hashlib
import json
import logging

import jwt
import requests
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.authentication import TokenAuthentication
from rest_framework.exceptions import AuthenticationFailed

logger = logging.getLogger(__name__)

UserModel = get_user_model()

# ── Cache keys ───────────────────────────────────────────────────────────────
_JWKS_CACHE_KEY = 'supabase:jwks'
_JWKS_CACHE_TTL = 3600  # 1 hour

# ── Algorithm map: JWT alg → PyJWT algorithm class ──────────────────────────
_ALGORITHM_MAP = {
    'RS256': jwt.algorithms.RSAAlgorithm,
    'RS384': jwt.algorithms.RSAAlgorithm,
    'RS512': jwt.algorithms.RSAAlgorithm,
    'ES256': jwt.algorithms.ECAlgorithm,
    'ES384': jwt.algorithms.ECAlgorithm,
    'ES512': jwt.algorithms.ECAlgorithm,
}


# ═══════════════════════════════════════════════════════════════════════════════
#  CookieTokenAuthentication — reads auth token from cookie
# ═══════════════════════════════════════════════════════════════════════════════


class CookieTokenAuthentication(TokenAuthentication):
    """Read the auth token from the ``auth_token`` HttpOnly cookie.

    This allows the frontend to send the token via cookie (set on login)
    rather than requiring an ``Authorization`` header on every request.
    """

    def authenticate(self, request):
        auth_token = request.COOKIES.get('auth_token')
        if not auth_token:
            return None
        return self.authenticate_credentials(auth_token)


# ═══════════════════════════════════════════════════════════════════════════════
#  SupabaseJwtAuthentication — validates Supabase-issued Bearer tokens
# ═══════════════════════════════════════════════════════════════════════════════


class SupabaseJwtAuthentication(TokenAuthentication):
    """DRF authentication backend that validates Supabase-issued JWTs."""

    keyword = 'Bearer'

    # ── Configuration ───────────────────────────────────────────────────

    @property
    def _is_configured(self):
        return bool(getattr(settings, 'SUPABASE_URL', None))

    @property
    def _supabase_url(self):
        return settings.SUPABASE_URL.rstrip('/')

    @property
    def _anon_key(self):
        return getattr(settings, 'SUPABASE_ANON_KEY', None)

    # ── JWKS management ─────────────────────────────────────────────────

    def _get_jwks_url(self):
        return f'{self._supabase_url}/auth/v1/.well-known/jwks.json'

    def _fetch_jwks(self):
        """Fetch the JWKS from Supabase, caching the result."""
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
        """Locate the matching JWK by ``kid`` and return a public key."""
        kid = headers.get('kid')
        matching_key = None

        if jwks and 'keys' in jwks:
            for key in jwks['keys']:
                if kid and key.get('kid') == kid:
                    matching_key = key
                    break
            if matching_key is None and jwks['keys']:
                matching_key = jwks['keys'][0]

        if matching_key is None:
            return None

        kty = matching_key.get('kty', '').upper()
        algorithm_cls = None

        if kty == 'RSA':
            algorithm_cls = jwt.algorithms.RSAAlgorithm
        elif kty == 'EC':
            algorithm_cls = jwt.algorithms.ECAlgorithm
        else:
            logger.warning('Unsupported JWK key type: %s', kty)
            return None

        try:
            return algorithm_cls.from_jwk(matching_key)
        except Exception as exc:
            logger.warning('Failed to convert JWK to public key (%s): %s', kty, exc)
            return None

    # ── Token validation ─────────────────────────────────────────────────

    def _decode_token(self, token):
        """Decode and verify the JWT using Supabase's JWKS."""
        try:
            headers = jwt.get_unverified_header(token)
        except jwt.DecodeError as exc:
            raise AuthenticationFailed(f'Invalid token header: {exc}')

        alg = headers.get('alg', 'RS256')
        if alg not in _ALGORITHM_MAP:
            raise AuthenticationFailed(f'Unsupported JWT algorithm: {alg}')

        jwks = self._fetch_jwks()
        if not jwks:
            raise AuthenticationFailed('Unable to fetch JWKS from Supabase.')

        public_key = self._get_public_key(headers, jwks)
        if not public_key:
            raise AuthenticationFailed('No suitable public key found in JWKS')

        issuer = f'{self._supabase_url}/auth/v1'

        try:
            payload = jwt.decode(
                token,
                key=public_key,
                algorithms=[alg],
                issuer=issuer,
                options={
                    'verify_exp': True,
                    'verify_iat': True,
                    'verify_aud': False,
                },
            )
        except jwt.ExpiredSignatureError:
            raise AuthenticationFailed('Token has expired.')
        except jwt.PyJWTError as exc:
            raise AuthenticationFailed(f'Token validation failed: {exc}')

        return payload

    # ── User resolution ──────────────────────────────────────────────────

    def _get_or_create_user(self, payload):
        """Resolve a Django user from the JWT payload."""
        email = payload.get('email', '')
        sub = payload.get('sub', '')

        if email:
            try:
                return UserModel.objects.get(email=email)
            except UserModel.DoesNotExist:
                pass

        if sub:
            try:
                return UserModel.objects.get(username=sub)
            except UserModel.DoesNotExist:
                pass

        user_meta = payload.get('user_metadata', {})
        username = sub or email.split('@')[0]
        user = UserModel.objects.create_user(
            username=username,
            email=email or '',
            first_name=user_meta.get('first_name', payload.get('given_name', '')),
            last_name=user_meta.get('last_name', payload.get('family_name', '')),
        )
        logger.info('Auto-created Django user %s from Supabase JWT', username)
        return user

    # ── DRF hook ─────────────────────────────────────────────────────────

    def authenticate_credentials(self, key):
        """Override ``TokenAuthentication.authenticate_credentials``."""
        if not self._is_configured:
            logger.debug(
                'Supabase not configured (SUPABASE_URL not set). '
                'Skipping SupabaseJwtAuthentication.'
            )
            return None

        payload = self._decode_token(key)
        user = self._get_or_create_user(payload)
        return (user, key)
