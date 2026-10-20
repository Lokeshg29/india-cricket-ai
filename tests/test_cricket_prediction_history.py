import pytest
from datetime import datetime, timezone

from fastapi.testclient import TestClient

from src.ingestion import supabase_store
from src.serving import app
from src.sports.cricket.fixtures import normalize_fixture, UnavailableFixtureProvider


client = TestClient(app.app)


def prediction_event(**changes):
    event = {
        "event_key": "fixture-42:model-v1",
        "provider_fixture_id": "fixture-42",
        "teams": ["India", "England"],
        "format": "TEST",
        "scheduled_start": "2026-11-01T10:00:00Z",
        "predicted_at": "2026-10-11T09:00:00Z",
        "model_version": "test-v1",
        "predicted_class": "draw",
        "probabilities": {"india": 0.4, "draw": 0.3, "opponent": 0.3},
        "data_source": "fixture-api",
    }
    event.update(changes)
    return event


def test_prediction_event_append_and_duplicate_prevention(monkeypatch):
    inserts = []

    class Query:
        def insert(self, payload):
            inserts.append(payload)
            return self

        def execute(self):
            if len(inserts) > 1:
                raise RuntimeError("duplicate key 23505")

    class Client:
        def table(self, _table):
            return Query()

    monkeypatch.setattr(supabase_store, "_client", lambda: Client())
    event = prediction_event()
    assert supabase_store.insert_cricket_prediction_event(event) is True
    assert supabase_store.insert_cricket_prediction_event(event) is False
    assert len(inserts) == 2
    assert inserts[0]["predicted_class"] == "draw"


@pytest.mark.parametrize("changes", [
    {"format": "T20I", "predicted_class": "india", "probabilities": {"india": 0.55, "opponent": 0.45}},
    {"format": "ODI", "predicted_class": "opponent", "probabilities": {"india": 0.35, "opponent": 0.65}},
])
def test_history_supports_odi_t20i_prediction_classes(monkeypatch, changes):
    class Query:
        def insert(self, _payload):
            return self

        def execute(self):
            return None

    class Client:
        def table(self, _table):
            return Query()

    monkeypatch.setattr(supabase_store, "_client", lambda: Client())
    assert supabase_store.insert_cricket_prediction_event(prediction_event(**changes)) is True


def test_actual_outcome_only_attaches_after_verified_finished_status(monkeypatch):
    updates = []

    class Query:
        def update(self, payload):
            updates.append(payload)
            return self

        def eq(self, *_args):
            return self

        def is_(self, *_args):
            return self

        def execute(self):
            return type("Result", (), {"data": [{"id": 1}]})()

    class Client:
        def table(self, _table):
            return Query()

    monkeypatch.setattr(supabase_store, "_client", lambda: Client())
    with pytest.raises(ValueError):
        supabase_store.attach_verified_cricket_result(
            "fixture-42", "draw", format="TEST", provider_status="scheduled", result_verified_at="2026-11-06T15:00:00Z"
        )
    assert supabase_store.attach_verified_cricket_result(
        "fixture-42", "draw", format="TEST", provider_status="finished", result_verified_at="2026-11-06T15:00:00Z"
    ) == 1
    assert updates[0]["actual_outcome"] == "draw"
    assert "predicted_class" not in updates[0]
    with pytest.raises(ValueError):
        supabase_store.attach_verified_cricket_result(
            "fixture-odi", "draw", format="ODI", provider_status="finished", result_verified_at="2026-11-06T15:00:00Z"
        )


def test_verified_fixture_prediction_is_stored_as_an_append_only_event(monkeypatch):
    fixture = normalize_fixture({
        "id": "registry-odi-1", "gender": "men", "competition_type": "international", "team_level": "senior",
        "format": "ODI", "teams": ["India", "Australia"], "scheduled_start": "2026-11-01T10:00:00Z",
        "status": "scheduled", "source_url": "https://example.test/fixture", "verified_at": "2026-10-18T10:00:00Z",
        "verification_status": "verified", "venue": "Sydney",
    }, now=datetime(2026, 10, 18, 12, tzinfo=timezone.utc))
    monkeypatch.setattr("src.sports.cricket.fixtures.get_fixture_feed", lambda: {"status": "available", "source": "Verified fixture registry", "fixtures": [fixture]})

    class FakePredictionService:
        def predict_fixture(self, fmt, opponent, as_of):
            assert fmt == "ODI" and opponent == "Australia"
            return {
                "status": "available", "format": "ODI", "prediction": "india",
                "probabilities": {"india": 0.6, "opponent": 0.4}, "prediction_timestamp": "2026-10-11T12:00:00+00:00",
                "model_version": "odi-v1", "data_label": "MODEL PREDICTION",
            }

    monkeypatch.setattr("src.sports.cricket.service.CricketPredictionService", FakePredictionService)
    inserted = []
    monkeypatch.setattr(supabase_store, "insert_cricket_prediction_event", lambda event: inserted.append(event) or True)

    response = client.post("/cricket/fixtures/registry-odi-1/predict")
    assert response.status_code == 200
    assert response.json()["history_status"] == "stored"
    assert response.json()["probabilities"] == {"india": 0.6, "opponent": 0.4}
    assert inserted[0]["provider_fixture_id"] == "registry-odi-1"
    assert inserted[0]["event_key"] == __import__("hashlib").sha256(b"registry-odi-1:odi-v1").hexdigest()
    assert "actual_outcome" not in inserted[0]


def test_repeated_fixture_prediction_uses_idempotent_history_key(monkeypatch):
    fixture = normalize_fixture({
        "id": "registry-t20i-1", "gender": "men", "competition_type": "international", "team_level": "senior",
        "format": "T20I", "teams": ["India", "Australia"], "scheduled_start": "2026-11-01T10:00:00Z",
        "status": "scheduled", "source_url": "https://example.test/fixture", "verified_at": "2026-10-18T10:00:00Z",
        "verification_status": "verified",
    }, now=datetime(2026, 10, 18, 12, tzinfo=timezone.utc))
    monkeypatch.setattr("src.sports.cricket.fixtures.get_fixture_feed", lambda: {"status": "available", "source": "Verified fixture registry", "fixtures": [fixture]})

    class FakePredictionService:
        def predict_fixture(self, *_args):
            return {"status": "available", "format": "T20I", "prediction": "india", "probabilities": {"india": .6, "opponent": .4}, "prediction_timestamp": "2026-10-18T12:00:00+00:00", "model_version": "t20i-v1", "data_label": "MODEL PREDICTION"}

    monkeypatch.setattr("src.sports.cricket.service.CricketPredictionService", FakePredictionService)
    keys = []
    def insert_once(event):
        keys.append(event["event_key"])
        return len(keys) == 1

    monkeypatch.setattr(supabase_store, "insert_cricket_prediction_event", insert_once)
    first = client.post("/cricket/fixtures/registry-t20i-1/predict")
    second = client.post("/cricket/fixtures/registry-t20i-1/predict")
    assert first.status_code == second.status_code == 200
    assert first.json()["history_status"] == "stored"
    assert second.json()["history_status"] == "unavailable"
    assert len(keys) == 2 and keys[0] == keys[1]


def test_test_fixture_prediction_preserves_draw_class(monkeypatch):
    fixture = normalize_fixture({
        "id": "mock-registry-test", "gender": "men", "competition_type": "international", "team_level": "senior",
        "format": "TEST", "teams": ["India", "New Zealand"], "scheduled_start": "2026-11-19T03:30:00+05:30",
        "status": "scheduled", "source_url": "https://example.test/mock-test", "verified_at": "2026-10-18T10:00:00Z",
        "verification_status": "verified",
    }, now=datetime(2026, 10, 18, 12, tzinfo=timezone.utc))
    monkeypatch.setattr("src.sports.cricket.fixtures.get_fixture_feed", lambda: {"status": "available", "fixtures": [fixture]})

    class FakeTestService:
        def predict_fixture(self, fmt, opponent, _as_of):
            assert fmt == "TEST" and opponent == "New Zealand"
            return {"status": "available", "format": "TEST", "prediction": "draw", "probabilities": {"india": .3, "draw": .4, "opponent": .3}, "prediction_timestamp": "2026-10-18T12:00:00+00:00", "model_version": "test-v1", "data_label": "MODEL PREDICTION"}

    monkeypatch.setattr("src.sports.cricket.service.CricketPredictionService", FakeTestService)
    monkeypatch.setattr(supabase_store, "insert_cricket_prediction_event", lambda _event: True)
    response = client.post("/cricket/fixtures/mock-registry-test/predict")
    assert response.status_code == 200
    assert response.json()["probabilities"] == {"india": .3, "draw": .4, "opponent": .3}


def test_prediction_is_unavailable_when_format_model_artifact_is_missing(monkeypatch):
    fixture = normalize_fixture({
        "id": "registry-test-1", "gender": "men", "competition_type": "international", "team_level": "senior",
        "format": "TEST", "teams": ["India", "Australia"], "scheduled_start": "2026-11-01T10:00:00Z",
        "status": "scheduled", "source_url": "https://example.test/fixture", "verified_at": "2026-10-18T10:00:00Z",
        "verification_status": "verified",
    }, now=datetime(2026, 10, 18, 12, tzinfo=timezone.utc))
    monkeypatch.setattr("src.sports.cricket.fixtures.get_fixture_feed", lambda: {"status": "available", "fixtures": [fixture]})

    class MissingModel:
        def __init__(self):
            raise FileNotFoundError("test model artifact unavailable")

    monkeypatch.setattr("src.sports.cricket.service.CricketPredictionService", MissingModel)
    response = client.post("/cricket/fixtures/registry-test-1/predict")
    assert response.status_code == 200
    assert response.json()["status"] == "unavailable"
    assert "probabilities" not in response.json()


def test_prediction_is_available_but_history_failure_is_not_claimed_as_saved(monkeypatch):
    fixture = normalize_fixture({
        "id": "mock-storage-failure", "gender": "men", "competition_type": "international", "team_level": "senior",
        "format": "ODI", "teams": ["India", "New Zealand"], "scheduled_start": "2026-11-04T07:30:00+05:30",
        "status": "scheduled", "source_url": "https://example.test/mock-fixture", "verified_at": "2026-10-18T10:00:00Z",
        "verification_status": "verified",
    }, now=datetime(2026, 10, 18, 12, tzinfo=timezone.utc))
    monkeypatch.setattr("src.sports.cricket.fixtures.get_fixture_feed", lambda: {"status": "available", "fixtures": [fixture]})

    class FakeOdiService:
        def predict_fixture(self, *_args):
            return {"status": "available", "format": "ODI", "prediction": "india", "probabilities": {"india": .6, "opponent": .4}, "prediction_timestamp": "2026-10-18T12:00:00+00:00", "model_version": "odi-v1", "data_label": "MODEL PREDICTION"}

    monkeypatch.setattr("src.sports.cricket.service.CricketPredictionService", FakeOdiService)
    monkeypatch.setattr(supabase_store, "insert_cricket_prediction_event", lambda _event: False)
    response = client.post("/cricket/fixtures/mock-storage-failure/predict")
    assert response.status_code == 200
    assert response.json()["status"] == "available"
    assert response.json()["history_status"] == "unavailable"
    assert response.json()["data_label"] == "MODEL PREDICTION"


def test_fixture_prediction_is_unavailable_without_fixture_provider(monkeypatch):
    monkeypatch.setattr("src.sports.cricket.fixtures.get_fixture_feed", lambda: UnavailableFixtureProvider().upcoming())
    response = client.post("/cricket/fixtures/not-a-real-fixture/predict")
    assert response.status_code == 200
    assert response.json()["status"] == "unavailable"
    assert "probabilities" not in response.json()


def test_fixture_api_returns_validated_registry_metadata(monkeypatch):
    fixture = normalize_fixture({
        "id": "mock-registry-entry", "gender": "men", "competition_type": "international", "team_level": "senior",
        "format": "ODI", "teams": ["India", "New Zealand"], "scheduled_start": "2026-11-04T07:30:00+05:30",
        "status": "scheduled", "source_url": "https://example.test/mock-fixture", "verified_at": "2026-10-18T10:00:00Z",
        "verification_status": "verified", "venue": "Auckland",
    }, now=datetime(2026, 10, 18, 12, tzinfo=timezone.utc))
    monkeypatch.setattr("src.sports.cricket.fixtures.get_fixture_feed", lambda: {
        "status": "available", "source": "Verified fixture registry", "fixtures": [fixture],
    })
    response = client.get("/cricket/fixtures")
    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "available"
    assert payload["fixtures"][0]["data_label"] == "VERIFIED FIXTURE"
    assert payload["fixtures"][0]["verification_status"] == "verified"
    assert payload["fixtures"][0]["source_url"] == "https://example.test/mock-fixture"


def test_fixture_and_history_routes_have_truthful_unavailable_states(monkeypatch, caplog):
    secret = "fixture-secret-sentinel"
    monkeypatch.setenv("CRICKET_FIXTURE_API_KEY", secret)
    monkeypatch.setattr("src.sports.cricket.fixtures.get_fixture_feed", lambda: UnavailableFixtureProvider().upcoming())
    fixtures = client.get("/cricket/fixtures")
    assert fixtures.status_code == 200
    assert fixtures.json()["status"] == "unavailable"
    assert fixtures.json()["fixtures"] == []
    assert secret not in fixtures.text

    monkeypatch.setattr(supabase_store, "fetch_cricket_prediction_events", lambda _limit: ([], False))
    monkeypatch.setattr(supabase_store, "SUPABASE_URL", None)
    monkeypatch.setattr(supabase_store, "SUPABASE_KEY", None)
    history = client.get("/cricket/predictions/history")
    assert history.status_code == 200
    assert history.json()["status"] == "unavailable"
    assert history.json()["records"] == []
    assert "key" not in history.text.casefold()
    assert secret not in caplog.text
