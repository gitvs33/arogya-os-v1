"""Unit tests for ``teleicu/registry.py`` — MonitoredPatientRegistry.

Uses the in-memory implementation to avoid any Redis/Django-cache dependency.
"""
import pytest

from medos.teleicu.registry import (
    InMemoryMonitoredPatientRegistry,
    MonitoredPatientRegistry,
    get_registry,
    set_registry,
    RedisMonitoredPatientRegistry,
)


class TestInMemoryMonitoredPatientRegistry:
    """Tests for the in-memory registry implementation."""

    @pytest.fixture
    def registry(self) -> InMemoryMonitoredPatientRegistry:
        return InMemoryMonitoredPatientRegistry()

    def test_add_and_is_monitored(self, registry):
        """After adding a patient, is_monitored returns True."""
        registry.add('patient-1', 'encounter-1')
        assert registry.is_monitored('patient-1') is True
        assert registry.is_monitored('patient-2') is False

    def test_add_and_list_all(self, registry):
        """list_all returns all added patient→encounter mappings."""
        registry.add('p1', 'e1')
        registry.add('p2', 'e2')
        all_patients = registry.list_all()
        assert all_patients == {'p1': 'e1', 'p2': 'e2'}

    def test_remove_existing_patient(self, registry):
        """Removing an existing patient returns their encounter_id."""
        registry.add('p1', 'e1')
        result = registry.remove('p1')
        assert result == 'e1'
        assert registry.is_monitored('p1') is False

    def test_remove_nonexistent_patient(self, registry):
        """Removing a non-existent patient returns None."""
        result = registry.remove('nonexistent')
        assert result is None

    def test_get_encounter_for_monitored_patient(self, registry):
        """get_encounter returns the encounter_id for a monitored patient."""
        registry.add('p1', 'e1')
        assert registry.get_encounter('p1') == 'e1'

    def test_get_encounter_for_unmonitored_patient(self, registry):
        """get_encounter returns None for an unmonitored patient."""
        assert registry.get_encounter('nonexistent') is None

    def test_list_all_empty_when_no_patients(self, registry):
        """list_all returns an empty dict when no patients are monitored."""
        assert registry.list_all() == {}

    def test_add_overwrites_existing_mapping(self, registry):
        """Adding the same patient again overwrites the old encounter_id."""
        registry.add('p1', 'e1')
        registry.add('p1', 'e2')
        assert registry.get_encounter('p1') == 'e2'

    def test_remove_updates_list_all(self, registry):
        """After removal, the patient no longer appears in list_all."""
        registry.add('p1', 'e1')
        registry.add('p2', 'e2')
        registry.remove('p1')
        assert registry.list_all() == {'p2': 'e2'}

    def test_is_monitored_after_remove(self, registry):
        """is_monitored returns False after a patient is removed."""
        registry.add('p1', 'e1')
        registry.remove('p1')
        assert registry.is_monitored('p1') is False

    def test_multiple_adds_and_removes(self, registry):
        """Multiple add/remove cycles work correctly."""
        for i in range(10):
            registry.add(f'p{i}', f'e{i}')
        assert len(registry.list_all()) == 10

        for i in range(5):
            registry.remove(f'p{i}')
        assert len(registry.list_all()) == 5

        for i in range(5, 10):
            assert registry.is_monitored(f'p{i}') is True


class TestRegistryGlobalDefault:
    """Tests for the global registry getter/setter."""

    def setup_method(self):
        # Save and restore after each test
        self._saved = get_registry()

    def teardown_method(self):
        set_registry(self._saved)

    def test_default_is_redis_registry(self):
        """The default registry should be RedisMonitoredPatientRegistry."""
        registry = get_registry()
        assert isinstance(registry, RedisMonitoredPatientRegistry)

    def test_set_registry_overrides_default(self):
        """set_registry replaces the global default registry."""
        in_memory = InMemoryMonitoredPatientRegistry()
        set_registry(in_memory)
        assert get_registry() is in_memory

    def test_global_registry_is_singleton(self):
        """get_registry returns the same instance after set_registry."""
        in_memory = InMemoryMonitoredPatientRegistry()
        set_registry(in_memory)
        assert get_registry() is in_memory
        assert get_registry() is in_memory
