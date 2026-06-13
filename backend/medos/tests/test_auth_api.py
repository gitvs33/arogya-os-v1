"""Integration tests for auth endpoints.

Covers:
- GET /api/auth/me/ (authenticated & unauthenticated)
- POST /api/login/ (Django auth path with username/password)
"""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

User = get_user_model()


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def user():
    return User.objects.create_user(
        username='doctor1',
        password='testpass123',
        email='doctor1@medos.in',
    )


@pytest.fixture
def auth_client(api_client, user):
    api_client.force_authenticate(user=user)
    return api_client


# ═══════════════════════════════════════════════════════════════════════════════
# GET /api/auth/me/
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.django_db
class TestAuthMe:
    def test_authenticated_returns_user_profile(self, auth_client):
        """Authenticated request returns user data with role."""
        response = auth_client.get('/api/auth/me/')
        assert response.status_code == 200
        assert response.data['username'] == 'doctor1'
        assert 'email' in response.data
        assert 'role' in response.data
        assert 'role_snapshot_hash' in response.data

    def test_authenticated_returns_id(self, auth_client, user):
        """Response includes the user's UUID primary key."""
        response = auth_client.get('/api/auth/me/')
        assert response.status_code == 200
        assert str(user.id) in str(response.data['id'])

    def test_unauthenticated_returns_401(self, api_client):
        """Request without auth token is rejected."""
        response = api_client.get('/api/auth/me/')
        assert response.status_code in (401, 403)

    def test_wrong_method_returns_405(self, auth_client):
        """POST to auth/me/ is not allowed."""
        response = auth_client.post('/api/auth/me/')
        assert response.status_code == 405


# ═══════════════════════════════════════════════════════════════════════════════
# POST /api/login/  — Django auth path
# ═══════════════════════════════════════════════════════════════════════════════


@pytest.mark.django_db
class TestLogin:
    def test_valid_credentials_returns_token(self, api_client, user):
        """Login with correct username/password yields a Token."""
        response = api_client.post('/api/login/', {
            'username': 'doctor1',
            'password': 'testpass123',
        })
        assert response.status_code == 200
        assert 'token' in response.data
        assert response.data['token'] is not None

    def test_valid_credentials_returns_user_data(self, api_client, user):
        """Login response includes user profile fields."""
        response = api_client.post('/api/login/', {
            'username': 'doctor1',
            'password': 'testpass123',
        })
        assert response.status_code == 200
        assert response.data['username'] == 'doctor1'
        assert response.data['email'] == 'doctor1@medos.in'
        assert 'is_staff' in response.data
        assert 'remember_me' in response.data

    def test_invalid_password_returns_401(self, api_client, user):
        """Wrong password is rejected."""
        response = api_client.post('/api/login/', {
            'username': 'doctor1',
            'password': 'wrongpassword',
        })
        assert response.status_code == 401

    def test_invalid_username_returns_401(self, api_client):
        """Non-existent username is rejected."""
        response = api_client.post('/api/login/', {
            'username': 'nonexistent',
            'password': 'testpass123',
        })
        assert response.status_code == 401

    def test_missing_fields_rejected(self, api_client):
        """Missing username or password is rejected."""
        response = api_client.post('/api/login/', {'username': 'doctor1'})
        assert response.status_code in (400, 401)  # view falls through to auth

        response = api_client.post('/api/login/', {'password': 'testpass123'})
        assert response.status_code in (400, 401)

        response = api_client.post('/api/login/', {})
        assert response.status_code in (400, 401)

    def test_empty_password_returns_401(self, api_client, user):
        """Empty string password is rejected."""
        response = api_client.post('/api/login/', {
            'username': 'doctor1',
            'password': '',
        })
        assert response.status_code == 401

    def test_wrong_method_returns_405(self, auth_client):
        """GET on login endpoint is not allowed."""
        response = auth_client.get('/api/login/')
        assert response.status_code == 405
