"""Validation and server-side access for the manually verified fixture registry."""

from __future__ import annotations

from copy import deepcopy
from datetime import datetime, timezone
import json
import logging
import os
from pathlib import Path
import re
from threading import Lock
import time
from typing import Protocol
from urllib.parse import urlparse

LOGGER = logging.getLogger(__name__)
REGISTRY_PATH = Path(__file__).resolve().parents[3] / "data" / "cricket" / "verified_fixtures.json"
FIXTURE_SOURCE = "VERIFIED_FIXTURE_REGISTRY"


class FixtureProvider(Protocol):
    name: str

    def upcoming(self) -> dict:
        """Return a status envelope and normalized future fixtures."""


class UnavailableFixtureProvider:
    name = "unconfigured"

    def upcoming(self) -> dict:
        return _unavailable("No verified future fixtures are listed in the registry.")


def _unavailable(reason: str) -> dict:
    return {
        "status": "unavailable", "data_label": "UNAVAILABLE", "source": None,
        "fixtures": [], "checked_at": datetime.now(timezone.utc).isoformat(), "reason": reason,
    }


class FixtureFeedCache:
    """Process-local cache; avoids re-reading/re-validating the registry per request."""

    def __init__(self, *, clock=time.monotonic, minimum_ttl_seconds: int = 3600):
        self._clock = clock
        self._minimum_ttl_seconds = minimum_ttl_seconds
        self._lock = Lock()
        self._provider_name: str | None = None
        self._expires_at = 0.0
        self._value: dict | None = None

    def get(self, provider: FixtureProvider) -> dict:
        with self._lock:
            now = self._clock()
            if self._provider_name == provider.name and self._value is not None and now < self._expires_at:
                return deepcopy(self._value)
            value = provider.upcoming()
            retry_after = value.get("retry_after_seconds", 0) if isinstance(value, dict) else 0
            try:
                retry_after = max(0, int(retry_after))
            except (TypeError, ValueError):
                retry_after = 0
            self._provider_name = provider.name
            self._value = deepcopy(value)
            self._expires_at = now + max(self._minimum_ttl_seconds, retry_after)
            return deepcopy(value)


def _parse_aware(value: object, field: str) -> datetime:
    if not isinstance(value, str):
        raise ValueError(f"{field} is missing")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError(f"{field} is invalid") from exc
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise ValueError(f"{field} must include a timezone")
    return parsed


def normalize_fixture(record: dict, *, source: str = "Verified fixture registry", now: datetime | None = None, max_age_days: int = 7) -> dict:
    """Validate one explicit, human-verified senior India international fixture."""
    if not isinstance(record, dict):
        raise ValueError("fixture must be an object")
    fixture_id = record.get("id")
    if not isinstance(fixture_id, str) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._:-]{0,199}", fixture_id):
        raise ValueError("fixture id is missing or invalid")
    if record.get("verification_status") != "verified":
        raise ValueError("fixture is not verified")
    if record.get("gender") != "men" or record.get("competition_type") != "international" or record.get("team_level") != "senior":
        raise ValueError("fixture is not explicitly classified as men's senior international cricket")
    fmt = record.get("format")
    if not isinstance(fmt, str) or fmt.upper() not in {"TEST", "ODI", "T20I"}:
        raise ValueError("fixture format is unsupported or unverified")
    teams = record.get("teams")
    if not isinstance(teams, list) or len(teams) != 2 or any(not isinstance(team, str) or not team.strip() for team in teams):
        raise ValueError("fixture must have exactly two named teams")
    teams = [team.strip() for team in teams]
    if sum(team.casefold() == "india" for team in teams) != 1:
        raise ValueError("fixture must include India exactly once")
    if any(re.search(r"(?:\bwomen\b|\bu[- ]?19\b|\bunder[- ]?19\b|\b[a]\s*$)", team, re.I) for team in teams):
        raise ValueError("fixture contains a non-senior or women's team")
    if record.get("status") != "scheduled":
        raise ValueError("only scheduled fixtures are eligible")
    kickoff = _parse_aware(record.get("scheduled_start"), "scheduled start")
    verified_at = _parse_aware(record.get("verified_at"), "verification timestamp")
    current = now or datetime.now(timezone.utc)
    if current.tzinfo is None or current.utcoffset() is None:
        raise ValueError("current time must include a timezone")
    current = current.astimezone(timezone.utc)
    if kickoff <= current:
        raise ValueError("fixture is not in the future")
    verified_at = verified_at.astimezone(timezone.utc)
    if verified_at > current:
        raise ValueError("verification timestamp is in the future")
    if not isinstance(max_age_days, int) or isinstance(max_age_days, bool) or max_age_days < 1:
        raise ValueError("verification freshness window is invalid")
    if (current - verified_at).total_seconds() > max_age_days * 86400:
        raise ValueError("fixture verification is stale")
    source_url = record.get("source_url")
    parsed_url = urlparse(source_url) if isinstance(source_url, str) else None
    if not parsed_url or parsed_url.scheme not in {"http", "https"} or not parsed_url.netloc:
        raise ValueError("fixture source URL is missing or invalid")
    opponent = next(team for team in teams if team.casefold() != "india")
    return {
        "match_id": fixture_id,
        "opponent": opponent,
        "teams": teams,
        "format": fmt.upper(),
        "start_time": kickoff.astimezone(timezone.utc).isoformat(),
        "venue": record.get("venue") if isinstance(record.get("venue"), str) and record["venue"].strip() else "Venue unavailable",
        "status": "scheduled",
        "fixture_source": FIXTURE_SOURCE,
        "data_source": source,
        "data_label": "VERIFIED FIXTURE",
        "source_url": source_url,
        "verified_at": verified_at.isoformat(),
        "verification_status": "verified",
    }


class VerifiedFixtureRegistry:
    name = "verified-fixture-registry"

    def __init__(self, path: Path | str = REGISTRY_PATH, *, now_fn=lambda: datetime.now(timezone.utc)):
        self.path = Path(path)
        self.name = f"verified-fixture-registry:{self.path.resolve()}"
        self.now_fn = now_fn

    def upcoming(self) -> dict:
        try:
            payload = json.loads(self.path.read_text(encoding="utf-8"))
            if not isinstance(payload, dict) or payload.get("schema_version") != 1:
                raise ValueError("unsupported registry schema")
            records = payload.get("fixtures")
            if not isinstance(records, list):
                raise ValueError("fixtures must be a list")
            max_age_days = payload.get("verification_max_age_days")
            if not isinstance(max_age_days, int) or isinstance(max_age_days, bool) or max_age_days < 1:
                raise ValueError("verification freshness window is invalid")
        except (OSError, json.JSONDecodeError, ValueError) as exc:
            LOGGER.warning("Fixture registry unavailable: %s", exc)
            return _unavailable("The verified fixture registry is missing or invalid.")
        if not records:
            return _unavailable("No verified future fixtures are listed in the registry.")
        counts: dict[str, int] = {}
        for row in records:
            key = row.get("id") if isinstance(row, dict) else None
            if isinstance(key, str):
                counts[key] = counts.get(key, 0) + 1
        fixtures = []
        now = self.now_fn()
        for index, row in enumerate(records):
            try:
                if isinstance(row, dict) and isinstance(row.get("id"), str) and counts.get(row["id"], 0) > 1:
                    raise ValueError("duplicate fixture ID")
                fixtures.append(normalize_fixture(row, source="Verified fixture registry", now=now, max_age_days=max_age_days))
            except ValueError as exc:
                LOGGER.warning("Ignoring fixture registry entry %s: %s", index, exc)
        fixtures.sort(key=lambda item: item["start_time"])
        if not fixtures:
            return _unavailable("No eligible verified future fixtures are listed in the registry.")
        return {
            "status": "available", "data_label": "VERIFIED FIXTURE", "source": "Verified fixture registry",
            "fixtures": fixtures, "checked_at": now.astimezone(timezone.utc).isoformat(), "reason": None,
        }


def get_fixture_provider() -> FixtureProvider:
    path = os.environ.get("CRICKET_FIXTURE_REGISTRY_PATH")
    return VerifiedFixtureRegistry(path) if path else VerifiedFixtureRegistry()


_fixture_feed_cache = FixtureFeedCache()


def get_fixture_feed() -> dict:
    return _fixture_feed_cache.get(get_fixture_provider())


def normalize_fixtures(records: list[dict], *, source: str = "Verified fixture registry", now: datetime | None = None, max_age_days: int = 7) -> list[dict]:
    if not isinstance(records, list):
        raise ValueError("fixture response must be a list")
    normalized = []
    seen = set()
    for record in records:
        fixture = normalize_fixture(record, source=source, now=now, max_age_days=max_age_days)
        if fixture["match_id"] in seen:
            raise ValueError("duplicate fixture IDs")
        seen.add(fixture["match_id"])
        normalized.append(fixture)
    return sorted(normalized, key=lambda fixture: fixture["start_time"])
