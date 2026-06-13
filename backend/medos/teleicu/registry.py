"""
Monitored patient registry for TeleICU.

Provides an abstract base and concrete implementations backed by
Django's cache framework (Redis) or in-memory storage for testing.
"""
import logging
from abc import ABC, abstractmethod
from typing import Optional

logger = logging.getLogger(__name__)

CACHE_KEY = 'teleicu:monitored_patients'


class MonitoredPatientRegistry(ABC):
    """Registry of patients currently under active TeleICU monitoring.

    Each entry maps ``patient_id`` → ``encounter_id``.
    """

    @abstractmethod
    def add(self, patient_id: str, encounter_id: str) -> None:
        """Register a patient for monitoring."""
        ...

    @abstractmethod
    def remove(self, patient_id: str) -> Optional[str]:
        """Unregister a patient.

        Returns:
            The ``encounter_id`` that was removed, or ``None`` if the
            patient was not being monitored.
        """
        ...

    @abstractmethod
    def list_all(self) -> dict[str, str]:
        """Return all monitored patients as ``{patient_id: encounter_id}``."""
        ...

    @abstractmethod
    def is_monitored(self, patient_id: str) -> bool:
        """Check whether a patient is currently being monitored."""
        ...

    @abstractmethod
    def get_encounter(self, patient_id: str) -> Optional[str]:
        """Return the encounter_id for a monitored patient, or None."""
        ...


class RedisMonitoredPatientRegistry(MonitoredPatientRegistry):
    """Production implementation backed by Django's cache (Redis)."""

    def add(self, patient_id: str, encounter_id: str) -> None:
        from django.core.cache import cache
        monitored = cache.get(CACHE_KEY, {})
        monitored[patient_id] = encounter_id
        cache.set(CACHE_KEY, monitored)

    def remove(self, patient_id: str) -> Optional[str]:
        from django.core.cache import cache
        monitored = cache.get(CACHE_KEY, {})
        encounter_id = monitored.pop(patient_id, None)
        if encounter_id is not None:
            cache.set(CACHE_KEY, monitored)
        return encounter_id

    def list_all(self) -> dict[str, str]:
        from django.core.cache import cache
        return cache.get(CACHE_KEY, {})

    def is_monitored(self, patient_id: str) -> bool:
        from django.core.cache import cache
        monitored = cache.get(CACHE_KEY, {})
        return patient_id in monitored

    def get_encounter(self, patient_id: str) -> Optional[str]:
        from django.core.cache import cache
        monitored = cache.get(CACHE_KEY, {})
        return monitored.get(patient_id)


class InMemoryMonitoredPatientRegistry(MonitoredPatientRegistry):
    """In-memory implementation for testing — fast and hermetic."""

    def __init__(self) -> None:
        self._data: dict[str, str] = {}

    def add(self, patient_id: str, encounter_id: str) -> None:
        self._data[patient_id] = encounter_id

    def remove(self, patient_id: str) -> Optional[str]:
        return self._data.pop(patient_id, None)

    def list_all(self) -> dict[str, str]:
        return dict(self._data)

    def is_monitored(self, patient_id: str) -> bool:
        return patient_id in self._data

    def get_encounter(self, patient_id: str) -> Optional[str]:
        return self._data.get(patient_id)


# ── Global default registry ──────────────────────────────────────────────────

_default_registry: MonitoredPatientRegistry = RedisMonitoredPatientRegistry()


def get_registry() -> MonitoredPatientRegistry:
    """Return the current default registry."""
    return _default_registry


def set_registry(registry: MonitoredPatientRegistry) -> None:
    """Override the default registry (useful in tests)."""
    global _default_registry
    _default_registry = registry
