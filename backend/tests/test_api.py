"""Tests fuer die API-Endpoints (Presets, Alarme, Auth, Devices)."""

import pytest


@pytest.mark.asyncio
class TestHealthEndpoint:
    async def test_health(self, client):
        resp = await client.get("/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"


@pytest.mark.asyncio
class TestPresetAPI:
    async def test_list_presets(self, client):
        resp = await client.get("/api/v1/devices/presets")
        assert resp.status_code == 200
        presets = resp.json()
        assert isinstance(presets, list)
        assert len(presets) >= 5

    async def test_list_presets_filter(self, client):
        resp = await client.get("/api/v1/devices/presets?category=heat_pump")
        assert resp.status_code == 200
        presets = resp.json()
        assert all(p["category"] == "heat_pump" for p in presets)

    async def test_get_preset_detail(self, client):
        resp = await client.get("/api/v1/devices/presets/lambda_eu_l")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == "lambda_eu_l"
        assert "register_groups" in data

    async def test_get_preset_not_found(self, client):
        resp = await client.get("/api/v1/devices/presets/nonexistent")
        assert resp.status_code == 404


@pytest.mark.asyncio
class TestAlarmAPI:
    async def test_alarm_status(self, client):
        resp = await client.get("/api/v1/alarms/status")
        assert resp.status_code == 200
        data = resp.json()
        assert "running" in data
        assert "system_alarms" in data

    async def test_system_rules(self, client):
        resp = await client.get("/api/v1/alarms/system-rules")
        assert resp.status_code == 200
        rules = resp.json()
        assert len(rules) >= 4
        ids = [r["id"] for r in rules]
        assert "sys_frost_protection" in ids
        assert "sys_storage_overtemp" in ids

    async def test_active_alarms_empty(self, client):
        resp = await client.get("/api/v1/alarms/events/active")
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_alarm_history_empty(self, client):
        resp = await client.get("/api/v1/alarms/events")
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_evaluate_no_data(self, client):
        resp = await client.post("/api/v1/alarms/evaluate")
        assert resp.status_code == 200
        data = resp.json()
        assert data["triggered"] == 0


@pytest.mark.asyncio
class TestAuthAPI:
    async def test_auth_status(self, client):
        resp = await client.get("/api/v1/auth/status")
        assert resp.status_code == 200
        data = resp.json()
        assert "auth_enabled" in data
        assert "setup_required" in data

    async def test_setup_first_user(self, client):
        resp = await client.post("/api/v1/auth/setup", json={
            "username": "admin",
            "password": "testpass123",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True

    async def test_setup_duplicate_fails(self, client):
        # Ersten Benutzer anlegen
        await client.post("/api/v1/auth/setup", json={
            "username": "admin", "password": "pass",
        })
        # Zweiter Versuch muss fehlschlagen
        resp = await client.post("/api/v1/auth/setup", json={
            "username": "admin2", "password": "pass2",
        })
        assert resp.status_code == 409

    async def test_login_success(self, client):
        # Setup
        await client.post("/api/v1/auth/setup", json={
            "username": "admin", "password": "secret123",
        })
        # Login
        resp = await client.post("/api/v1/auth/login", json={
            "username": "admin", "password": "secret123",
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"

    async def test_login_wrong_password(self, client):
        await client.post("/api/v1/auth/setup", json={
            "username": "admin", "password": "correct",
        })
        resp = await client.post("/api/v1/auth/login", json={
            "username": "admin", "password": "wrong",
        })
        assert resp.status_code == 401


@pytest.mark.asyncio
class TestDeviceManagerAPI:
    async def test_device_status(self, client):
        resp = await client.get("/api/v1/devices/status")
        assert resp.status_code == 200
        data = resp.json()
        assert "running" in data
        assert "device_count" in data

    async def test_reload_presets(self, client):
        resp = await client.post("/api/v1/devices/presets/reload")
        assert resp.status_code == 200
        data = resp.json()
        assert data["reloaded"] >= 5


@pytest.mark.asyncio
class TestCRUDEndpoints:
    async def test_generators_empty(self, client):
        resp = await client.get("/api/v1/generators")
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_create_and_list_generator(self, client):
        gen = {
            "id": "pv_test",
            "name": "Test PV",
            "type": "pv",
            "communication": {"protocol": "modbus_tcp", "ipAddress": "", "port": 502, "pollingIntervalSeconds": 5, "enabled": False, "trendEnabled": True, "trendMode": "interval", "trendIntervalSeconds": 30, "trendDeadbandPercent": 1},
        }
        resp = await client.post("/api/v1/generators", json=gen)
        assert resp.status_code == 201

        resp = await client.get("/api/v1/generators")
        assert resp.status_code == 200
        items = resp.json()
        assert len(items) == 1
        assert items[0]["id"] == "pv_test"

    async def test_alarm_definitions_crud(self, client):
        alarm = {
            "id": "test_alarm",
            "name": "Test-Alarm",
            "enabled": True,
            "severity": "warning",
            "triggerType": "threshold",
            "source": "battery",
            "metric": "soc_pct",
            "condition": "<",
            "threshold": 10,
            "description": "Test",
            "cooldownMinutes": 5,
        }
        resp = await client.post("/api/v1/alarm-definitions", json=alarm)
        assert resp.status_code == 201

        resp = await client.get("/api/v1/alarm-definitions")
        assert resp.status_code == 200
        items = resp.json()
        assert len(items) == 1
        assert items[0]["id"] == "test_alarm"
