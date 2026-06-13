"""Auth views — login, auth_me, and change-password."""
import datetime
import requests

from django.conf import settings
from django.contrib.auth import authenticate, login as django_login
from django.contrib.auth.models import User
from django.views.decorators.csrf import csrf_exempt
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .authentication import SupabaseJwtAuthentication


def _get_hospital_info(profile):
    """Build hospital info dict from a user's profile."""
    if not profile or not profile.hospital:
        return None
    h = profile.hospital
    return {
        'id': str(h.id),
        'name': h.name,
        'slug': h.slug,
        'plan': h.plan,
        'is_active': h.is_active,
    }


def _build_user_response(user, profile):
    """Common logic to build the user response dict."""
    employee_id = profile.employee_id if profile else None
    role_name = profile.role.name if profile and profile.role else None
    role_permissions = profile.role.permissions if profile and profile.role else {}
    role_snapshot_hash = profile.get_role_snapshot_hash() if profile else None

    return {
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'is_staff': user.is_staff,
        'employee_id': employee_id,
        'role': role_name,
        'role_permissions': role_permissions,
        'role_snapshot_hash': role_snapshot_hash,
        'department': profile.department if profile else '',
        'designation': profile.designation if profile else '',
        'must_change_password': profile.must_change_password if profile else False,
        'hospital': _get_hospital_info(profile),
    }


def _set_auth_cookie(response, token_key):
    """Set the auth token as an HttpOnly cookie."""
    response.set_cookie(
        'auth_token',
        token_key,
        httponly=True,
        secure=False,  # Set to True in production with HTTPS
        samesite='Lax',
        max_age=datetime.timedelta(days=14),
        path='/',
    )


def _finalize_supabase_login(user, request):
    """Common logic after successful Supabase authentication."""
    django_login(request, user)
    token, _ = Token.objects.get_or_create(user=user)
    profile = getattr(user, 'hospital_profile', None)
    resp_data = _build_user_response(user, profile)
    response = Response(resp_data)
    _set_auth_cookie(response, token.key)
    return response


@csrf_exempt
@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def login_view(request):
    """Login — accepts email/password or username/password or Supabase access_token."""
    # ── Email/password flow — try local DB first, then Supabase ──
    email = request.data.get('email')
    pwd = request.data.get('password')
    if email and pwd:
        # Try local DB auth first (users created via internal ops panel)
        local_user = authenticate(request, username=email, password=pwd)
        if local_user is None:
            # Also try matching by username (in case email was used as username)
            try:
                user_obj = User.objects.get(email=email)
                local_user = authenticate(request, username=user_obj.username, password=pwd)
            except User.DoesNotExist:
                pass

        if local_user is not None:
            django_login(request, local_user)
            token, _ = Token.objects.get_or_create(user=local_user)
            profile = getattr(local_user, 'hospital_profile', None)
            resp_data = _build_user_response(local_user, profile)
            response = Response(resp_data)
            _set_auth_cookie(response, token.key)
            return response

        # Fallback: try Supabase
        supabase_url = getattr(settings, 'SUPABASE_URL', '').rstrip('/')
        anon_key = getattr(settings, 'SUPABASE_ANON_KEY', '')

        if not supabase_url or not anon_key:
            return Response(
                {'error': 'Invalid login credentials'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        resp = requests.post(
            f'{supabase_url}/auth/v1/token?grant_type=password',
            json={'email': email, 'password': pwd},
            headers={'apikey': anon_key},
            timeout=15,
        )

        if resp.status_code != 200:
            msg = resp.json().get('msg', 'Invalid login credentials')
            return Response(
                {'error': msg},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        access_token = resp.json()['access_token']
        auth_backend = SupabaseJwtAuthentication()
        try:
            result = auth_backend.authenticate_credentials(access_token)
        except AuthenticationFailed as exc:
            return Response(
                {'error': str(exc)},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        except Exception as exc:
            return Response(
                {'error': 'Authentication service error'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        if result is None:
            return Response(
                {'error': 'Supabase authentication failed'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        user, _ = result
        return _finalize_supabase_login(user, request)

    # ── Access_token flow ──
    access_token = request.data.get('access_token')
    if access_token:
        auth_backend = SupabaseJwtAuthentication()
        try:
            result = auth_backend.authenticate_credentials(access_token)
        except AuthenticationFailed as exc:
            return Response(
                {'error': str(exc)},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        except Exception as exc:
            return Response(
                {'error': 'Authentication service error'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        if result is None:
            return Response(
                {'error': 'Supabase is not configured. Set SUPABASE_URL in .env'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        user, _ = result
        return _finalize_supabase_login(user, request)

    # ── Fallback: local username/password (dev only) ──
    username = request.data.get('username')
    password = request.data.get('password')
    remember_me = request.data.get('remember_me', False)

    user = authenticate(request, username=username, password=password)
    if user is not None:
        django_login(request, user)
        token, _ = Token.objects.get_or_create(user=user)

        if not remember_me:
            request.session.set_expiry(0)
        else:
            request.session.set_expiry(1209600)

        profile = getattr(user, 'hospital_profile', None)
        resp_data = _build_user_response(user, profile)
        response = Response(resp_data)
        _set_auth_cookie(response, token.key)
        return response

    return Response(
        {'error': 'Invalid credentials'},
        status=status.HTTP_401_UNAUTHORIZED,
    )


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def auth_me(request):
    """Return the current user's profile including role and hospital info."""
    user = request.user
    profile = getattr(user, 'hospital_profile', None)
    return Response(_build_user_response(user, profile))


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password(request):
    """Change the current user's password and clear must_change_password flag."""
    old_password = request.data.get('old_password')
    new_password = request.data.get('new_password')

    if not old_password or not new_password:
        return Response(
            {'error': 'Both old_password and new_password are required.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if len(new_password) < 8:
        return Response(
            {'error': 'Password must be at least 8 characters.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    user = request.user
    supabase_url = getattr(settings, 'SUPABASE_URL', '').rstrip('/')
    anon_key = getattr(settings, 'SUPABASE_ANON_KEY', '')

    is_password_valid = False

    if supabase_url and anon_key and user.email:
        resp = requests.post(
            f'{supabase_url}/auth/v1/token?grant_type=password',
            json={'email': user.email, 'password': old_password},
            headers={'apikey': anon_key},
            timeout=15,
        )
        if resp.status_code == 200:
            is_password_valid = True
            access_token = resp.json().get('access_token')
            update_resp = requests.put(
                f'{supabase_url}/auth/v1/user',
                json={'password': new_password},
                headers={'Authorization': f'Bearer {access_token}', 'apikey': anon_key},
                timeout=15,
            )
            if update_resp.status_code != 200:
                return Response(
                    {'error': 'Failed to update password in authentication service.'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                )

    if not is_password_valid:
        if not user.check_password(old_password):
            return Response(
                {'error': 'Current password is incorrect.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

    user.set_password(new_password)
    user.save(update_fields=['password'])

    profile = getattr(user, 'hospital_profile', None)
    if profile and profile.must_change_password:
        profile.must_change_password = False
        profile.save(update_fields=['must_change_password'])

    return Response({'status': 'Password changed successfully.'})
