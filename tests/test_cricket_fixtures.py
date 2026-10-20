import json
from datetime import datetime, timezone
from pathlib import Path
from tempfile import TemporaryDirectory

import pytest

from src.sports.cricket.fixtures import (
    FixtureFeedCache,
    UnavailableFixtureProvider,
    VerifiedFixtureRegistry,
    normalize_fixture,
    normalize_fixtures,
)


NOW = datetime(2026, 10, 18, 12, tzinfo=timezone.utc)


@pytest.fixture
def registry_dir():
    # Keep temporary fixtures inside the writable repository on sandboxed Windows.
    with TemporaryDirectory(dir=Path(__file__).parent) as directory:
        yield Path(directory)


def fixture(fmt="ODI", **changes):
    row = {
        "id": "internal-fixture-17", "gender": "men", "competition_type": "international",
        "team_level": "senior", "format": fmt, "teams": ["India", "South Africa"],
        "scheduled_start": "2026-11-01T10:30:00+05:30", "status": "scheduled",
        "source_url": "https://example.test/official-fixture", "verified_at": "2026-10-18T10:00:00Z",
        "verification_status": "verified", "venue": "Eden Gardens",
    }
    row.update(changes)
    return row


@pytest.mark.parametrize("fmt", ["TEST", "ODI", "T20I"])
def test_normalizes_supported_verified_formats(fmt):
    result = normalize_fixture(fixture(fmt), now=NOW)
    assert result["format"] == fmt
    assert result["opponent"] == "South Africa"
    assert result["start_time"] == "2026-11-01T05:00:00+00:00"
    assert result["data_label"] == "VERIFIED FIXTURE"
    assert result["fixture_source"] == "VERIFIED_FIXTURE_REGISTRY"
    assert result["source_url"].startswith("https://")
    assert result["verified_at"] == "2026-10-18T10:00:00+00:00"


@pytest.mark.parametrize("changes", [
    {"source_url": None}, {"verified_at": None}, {"verified_at": "2026-10-18T10:00:00"},
    {"format": "unknown"}, {"teams": ["India", ""]}, {"teams": ["India A", "Australia"]},
    {"teams": ["India", "Australia Women"]}, {"gender": None}, {"team_level": "youth"},
    {"competition_type": "domestic"}, {"status": "finished"},
    {"verification_status": "pending"}, {"scheduled_start": "not-a-date"},
    {"scheduled_start": "2026-11-01T10:00:00"}, {"id": ""},
])
def test_rejects_missing_or_unverified_registry_fields(changes):
    with pytest.raises(ValueError):
        normalize_fixture(fixture(**changes), now=NOW)


def test_rejects_past_and_stale_fixtures():
    with pytest.raises(ValueError, match="future"):
        normalize_fixture(fixture(scheduled_start="2026-10-18T11:00:00Z"), now=NOW)
    with pytest.raises(ValueError, match="stale"):
        normalize_fixture(fixture(verified_at="2026-10-01T10:00:00Z"), now=NOW)


def test_duplicate_ids_are_rejected_by_normalizer_and_registry(registry_dir):
    with pytest.raises(ValueError, match="duplicate"):
        normalize_fixtures([fixture(), fixture()], now=NOW)
    registry = registry_dir / "registry.json"
    registry.write_text(json.dumps({"schema_version": 1, "verification_max_age_days": 7, "fixtures": [fixture(), fixture()]}))
    response = VerifiedFixtureRegistry(registry, now_fn=lambda: NOW).upcoming()
    assert response["status"] == "unavailable"
    assert response["fixtures"] == []


def test_empty_registry_remains_unavailable_without_fabricated_fixtures(registry_dir):
    registry = registry_dir / "registry.json"
    registry.write_text(json.dumps({"schema_version": 1, "verification_max_age_days": 7, "fixtures": []}))
    response = VerifiedFixtureRegistry(registry, now_fn=lambda: NOW).upcoming()
    assert response["status"] == "unavailable"
    assert response["fixtures"] == []
    assert "No verified future" in response["reason"]


def test_registry_excludes_invalid_records_but_keeps_valid_verified_fixture(registry_dir):
    registry = registry_dir / "registry.json"
    registry.write_text(json.dumps({
        "schema_version": 1, "verification_max_age_days": 7,
        "fixtures": [fixture(format="IPL"), fixture(id="valid-1")],
    }))
    response = VerifiedFixtureRegistry(registry, now_fn=lambda: NOW).upcoming()
    assert response["status"] == "available"
    assert [row["match_id"] for row in response["fixtures"]] == ["valid-1"]


def test_unavailable_provider_keeps_empty_state():
    response = UnavailableFixtureProvider().upcoming()
    assert response["status"] == "unavailable"
    assert response["source"] is None
    assert response["fixtures"] == []


def test_fixture_feed_cache_limits_refreshes():
    now = [100.0]

    class CountingProvider:
        name = "verified-test-provider"

        def __init__(self):
            self.calls = 0

        def upcoming(self):
            self.calls += 1
            return {"status": "unavailable", "fixtures": []}

    provider = CountingProvider()
    cache = FixtureFeedCache(clock=lambda: now[0])
    cache.get(provider)
    now[0] += 3599
    cache.get(provider)
    assert provider.calls == 1
    now[0] += 2
    cache.get(provider)
    assert provider.calls == 2
