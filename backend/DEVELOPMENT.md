# MedOS Backend — Development Guide

## Prerequisites

- Python 3.14+
- Node.js 22+ (for sync-gateway)
- Redis (optional — Celery runs in eager mode by default)

## Setting Up a Dev Environment

```bash
# Clone and enter the backend
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your Supabase credentials (see SUPABASE_SETUP.md)

# Run migrations
python manage.py migrate

# Seed data
python manage.py seed_roles
python manage.py seed_ddi  # optional, ~50MB

# Create superuser
python manage.py createsuperuser

# Run server
python manage.py runserver
```

## Running Tests

```bash
# Run all tests
pytest -v

# Run with coverage
pytest --cov=medos -v

# Run specific test file
pytest medos/tests/test_api.py -v

# Run specific test class
pytest medos/tests/test_models.py::TestPatientModel -v

# Run with print output visible
pytest -v -s
```

## Adding a New Model

Follow these steps in order:

### 1. Define the model in `medos/models.py`

```python
class Diagnosis(models.Model):
    encounter = models.ForeignKey(Encounter, on_delete=models.CASCADE)
    icd_code = models.CharField(max_length=20)
    description = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.icd_code} - {self.description[:50]}"
```

### 2. Create and run migration

```bash
python manage.py makemigrations
python manage.py migrate
```

### 3. Add serializer in `medos/serializers.py`

```python
class DiagnosisSerializer(serializers.ModelSerializer):
    class Meta:
        model = Diagnosis
        fields = '__all__'
        read_only_fields = ['id', 'created_at']
```

### 4. Add view in `medos/views.py`

```python
class DiagnosisViewSet(viewsets.ModelViewSet):
    queryset = Diagnosis.objects.select_related('encounter')
    serializer_class = DiagnosisSerializer
    permission_classes = [IsAuthenticated]
    filterset_fields = ['encounter']
```

### 5. Register URL in `medos/urls.py`

```python
router.register(r'diagnoses', views.DiagnosisViewSet)
```

### 6. Register admin in `medos/admin.py`

```python
class DiagnosisAdmin(admin.ModelAdmin):
    list_display = ['icd_code', 'description', 'encounter', 'created_at']
    search_fields = ['icd_code', 'description']

admin.site.register(Diagnosis, DiagnosisAdmin)
```

### 7. Write tests

```python
# In medos/tests/test_models.py
@pytest.mark.django_db
class TestDiagnosisModel:
    def test_create_diagnosis(self, encounter):
        diagnosis = Diagnosis.objects.create(
            encounter=encounter,
            icd_code='G43.9',
            description='Migraine, unspecified',
        )
        assert str(diagnosis) is not None
```

## Code Style

- Follow **PEP 8** (line length 100 chars)
- Use **Google-style docstrings** for all functions and classes
- Use type hints where practical
- Django imports go in this order:
  1. Standard library
  2. Third-party (Django, DRF, etc.)
  3. Local (`from .models import ...`)

## Git Workflow

```bash
# Create a feature branch
git checkout -b feat/diagnosis-model

# Make changes and commit
git add -A
git commit -m "feat: add diagnosis model with CRUD endpoints"

# Keep branch up to date
git fetch origin
git rebase origin/master

# Push and create PR
git push origin feat/diagnosis-model
```

Commit message format: `type: description`

| Type | When to use |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation |
| `refactor` | Code change that doesn't fix or add |
| `test` | Adding or updating tests |
| `chore` | Tooling, config, dependencies |

## Celery Tasks

Tasks live in `medos/tasks.py`. Add a new task:

```python
@shared_task(bind=True, max_retries=3, default_retry_delay=5)
def my_background_task(self, some_arg):
    try:
        # Do work
        pass
    except TemporaryError as exc:
        raise self.retry(exc=exc)
```

Schedule periodic tasks in `settings.py`:

```python
CELERY_BEAT_SCHEDULE = {
    'my-task': {
        'task': 'medos.tasks.my_background_task',
        'schedule': 300.0,  # Every 5 minutes
    },
}
```

In dev, tasks run synchronously (`CELERY_TASK_ALWAYS_EAGER = True`) so no Redis is needed.

## WebSocket Consumers

Consumers live in `medos/consumers.py`. Add a new consumer:

```python
class MyConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.channel_layer.group_add('my_group', self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard('my_group', self.channel_name)

    async def my_event(self, event):
        await self.send(text_data=json.dumps(event['data']))
```

Add routing in `medos/routing.py`:

```python
websocket_urlpatterns += [
    re_path(r'ws/my-path/$', consumers.MyConsumer.as_asgi()),
]
```

## Environment Configuration

Use `.env` for local development (not committed to git):

```
DJANGO_SECRET_KEY=your-secret-key
DJANGO_DEBUG=True
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

For production, set environment variables on the server or in AWS Secrets Manager.

## Database Migrations

```bash
# Create migration after model changes
python manage.py makemigrations

# Apply pending migrations
python manage.py migrate

# Show migration status
python manage.py showmigrations

# Rollback last migration
python manage.py migrate medos 0001_initial
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `ModuleNotFoundError: No module named '...'` | `pip install -r requirements.txt` |
| `django.db.utils.OperationalError: no such table` | `python manage.py migrate` |
| Supabase JWT validation fails | Check `SUPABASE_URL` in `.env` is correct |
| Tests fail with auth errors | Ensure `SUPABASE_URL` is set (or empty for fallback) |
| Celery tasks not running | Set `CELERY_TASK_ALWAYS_EAGER = True` for dev |
