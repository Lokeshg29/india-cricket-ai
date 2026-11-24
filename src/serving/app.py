"""FastAPI model-serving layer (PROJECT_BRAIN #12 item 2): score any
fixture on demand, and the current P(champion) per team from the live
Layer 2 Monte Carlo simulation. Loads the latest Layer 1 model from the
MLflow registry (wc26-layer1-stacked-ensemble) when reachable; falls
back to training one locally from historical + live results otherwise
-- the API should never hard-fail just because MLflow is down, same
best-effort philosophy as tracking.py.

Run: uvicorn src.serving.app:app --host 0.0.0.0 --port 8000
Docs: http://localhost:8000/docs
"""

import os
import sys
import time
import uuid
import hashlib
import math
from contextlib import asynccontextmanager
from datetime import date, datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

from dotenv import load_dotenv  # noqa: E402

load_dotenv()

from fastapi import Depends, FastAPI, HTTPException, Request, Response  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402
from pydantic import BaseModel  # noqa: E402

from src.serving import metrics  # noqa: E402
from src.ingestion import supabase_store  # noqa: E402

# Dashboard origins allowed to call this API directly from the browser (the
# Live Inference Console). Portfolio project, so no auth/rate-limiting is
# added here (see PROJECT_BRAIN.md), but CORS is deliberately scoped to
# known dashboard origins rather than "*". Override/extend via env var.
DEFAULT_DASHBOARD_ORIGINS = [
    "https://fifa2026mlops.vercel.app",
    "https://dashboard-hazel-kappa-52.vercel.app",
    "http://localhost:3000",
]

from src.features.data_loading import load_fifa_rankings  # noqa: E402
from src.features.team_timeline import build_timelines  # noqa: E402
from src.ingestion import live_results_store  # noqa: E402
from src.ingestion.team_names import canonical  # noqa: E402
from src.models.layer1_ensemble import tracking  # noqa: E402
from src.models.layer1_ensemble.ensemble import Layer1Ensemble, load_tuned_xgb_params  # noqa: E402
from src.models.layer2_simulation import live_bracket  # noqa: E402
from src.serving.otel import instrument  # noqa: E402

TRAIN_START = date(1992, 1, 1)


class ModelState:
    """Bootstrapped once at startup: rebuilds Elo/form timelines from
    historical + live results (same as daily_update.py), then loads or
    trains the Layer 1 ensemble. Champion probabilities are computed
    lazily and cached -- they only change once a day (new results), so
    there's no reason to re-run 10,000 simulations on every request."""

    def __init__(self) -> None:
        self.today = datetime.now(timezone.utc).date()
        self.matches = live_results_store.load_combined_matches()
        self.rankings = load_fifa_rankings()
        self.timelines = build_timelines(self.matches)

        stack, source = tracking.load_latest_stack()
        self.model_source = source
        registry_info = tracking.get_registry_info()
        self.model_version = f"v{registry_info['version']}" if registry_info else f"local-{self.today.isoformat()}"
        self.ensemble = Layer1Ensemble(
            self.matches,
            self.timelines,
            self.rankings,
            TRAIN_START,
            self.today,
            stack=stack,
            xgb_params=load_tuned_xgb_params(),
        )

        self._champion_cache: dict | None = None

    def champion_probabilities(self, refresh: bool = False) -> dict:
        """Live Layer 2: Monte Carlo over the actual remaining 2026
        bracket, resolved from locally-known results
        (data/live/results_log.csv) -- doesn't call the paid Odds API, so
        it can't infer a drawn knockout match's shootout winner until that
        winner's next fixture is itself logged as a completed result."""
        if self._champion_cache is None or refresh:
            tree = live_bracket.build_2026_tree(self.matches, upcoming_fixtures=[])
            probabilities = live_bracket.simulate_champion_probabilities(
                tree, lambda a, b: self.ensemble.advance_probability(a, b, self.today)
            )
            self._champion_cache = {
                "as_of": self.today.isoformat(),
                "model_source": self.model_source,
                "probabilities": dict(sorted(probabilities.items(), key=lambda kv: -kv[1])),
            }
        return self._champion_cache


@asynccontextmanager
async def lifespan(app: FastAPI):
    state = ModelState()
    app.state.model_state = state
    metrics.set_model_info(state.model_version, state.model_source)
    yield


app = FastAPI(
    title="WC26 Model Serving",
    description="Layer 1 match scoring + live Layer 2 championship probabilities.",
    version="1.0",
    lifespan=lifespan,
)
instrument(app)

_dashboard_origins = os.environ.get("DASHBOARD_ORIGINS")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_dashboard_origins.split(",") if _dashboard_origins else DEFAULT_DASHBOARD_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_metadata(request: Request, call_next):
    """Every response carries a request ID and measured latency -- the
    Live Inference Console on the dashboard reads these headers to show a
    genuine round-trip (request ID, latency) instead of fabricated
    inference metadata. The same measurement feeds the Prometheus request
    counter/latency histogram (metrics.py) that Prometheus scrapes and
    Grafana renders."""
    request_id = str(uuid.uuid4())
    start = time.perf_counter()
    metrics.IN_PROGRESS.inc() if metrics.enabled() else None
    try:
        response = await call_next(request)
    finally:
        metrics.IN_PROGRESS.dec() if metrics.enabled() else None
    latency_s = time.perf_counter() - start
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Response-Time-Ms"] = f"{latency_s * 1000:.1f}"
    # Label by the matched route template (e.g. "/predict"), not the raw
    # URL, so the path label can't blow up in cardinality.
    route = request.scope.get("route")
    path = getattr(route, "path", request.url.path)
    metrics.observe_request(request.method, path, response.status_code, latency_s)
    return response


def get_model_state(request: Request) -> ModelState:
    return request.app.state.model_state


class PredictRequest(BaseModel):
    home_team: str
    away_team: str
    neutral: bool = True
    as_of: date | None = None


class CricketPredictRequest(BaseModel):
    format: str
    opponent: str
    as_of: date | None = None


class OutcomeProbs(BaseModel):
    home_win: float
    draw: float
    away_win: float


class PredictResponse(BaseModel):
    home_team: str
    away_team: str
    as_of: date
    model_version: str
    model: OutcomeProbs
    baseline: OutcomeProbs


@app.get("/health")
def health(state: ModelState = Depends(get_model_state)):
    return {
        "status": "ok",
        "model_source": state.model_source,
        "model_version": state.model_version,
        "as_of": state.today.isoformat(),
    }


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest, state: ModelState = Depends(get_model_state)):
    home = canonical(req.home_team)
    away = canonical(req.away_team)
    if home not in state.timelines or away not in state.timelines:
        raise HTTPException(404, f"Unknown team(s) -- check spelling against historical results: {home}, {away}")

    as_of = req.as_of or state.today
    p_loss, p_draw, p_win = state.ensemble.match_probs(home, away, as_of, neutral=req.neutral)
    b_loss, b_draw, b_win = state.ensemble.baseline_match_probs(home, away, as_of, neutral=req.neutral)
    outcome = max(("home_win", p_win), ("draw", p_draw), ("away_win", p_loss), key=lambda kv: kv[1])[0]
    metrics.observe_prediction(outcome)
    return PredictResponse(
        home_team=home,
        away_team=away,
        as_of=as_of,
        model_version=state.model_version,
        model=OutcomeProbs(home_win=p_win, draw=p_draw, away_win=p_loss),
        baseline=OutcomeProbs(home_win=b_win, draw=b_draw, away_win=b_loss),
    )


@app.post("/cricket/predict")
def predict_cricket(req: CricketPredictRequest, request: Request):
    """Cricsheet-trained cricket inference; no schedule/live-data lookup."""
    service = getattr(request.app.state, "cricket_prediction_service", None)
    if service is None:
        try:
            from src.sports.cricket.service import CricketPredictionService

            service = CricketPredictionService()
        except FileNotFoundError as exc:
            return {"status": "unavailable", "reason": str(exc), "data_label": "MODEL PREDICTION"}
        request.app.state.cricket_prediction_service = service
    try:
        return service.predict_fixture(req.format, req.opponent, req.as_of)
    except (ValueError, FileNotFoundError) as exc:
        return {"status": "unavailable", "reason": str(exc), "data_label": "MODEL PREDICTION"}


@app.get("/cricket/fixtures")
def cricket_fixtures():
    """Return verified future India men's fixtures, or an explicit empty state."""
    from src.sports.cricket.fixtures import get_fixture_feed

    return get_fixture_feed()


@app.get("/cricket/predictions/history")
def cricket_prediction_history(limit: int = 100):
    """Return persisted, timestamped prediction events when Supabase exists."""
    records, storage_ready = supabase_store.fetch_cricket_prediction_events(limit)
    return {
        "status": "available" if records else ("empty" if storage_ready else "unavailable"),
        "data_label": "MODEL PREDICTION" if records else "UNAVAILABLE",
        "records": records,
        "reason": None if records else ("No saved prediction events yet." if storage_ready else "Prediction history storage is unavailable or not configured."),
    }


@app.post("/cricket/fixtures/{fixture_id}/predict")
def predict_verified_cricket_fixture(fixture_id: str):
    """Predict and append history only after a provider returns a valid fixture."""
    from src.sports.cricket.fixtures import get_fixture_feed
    from src.sports.cricket.service import CricketPredictionService

    feed = get_fixture_feed()
    if feed.get("status") != "available":
        return {"status": "unavailable", "reason": feed.get("reason", "No verified fixture feed is available."), "data_label": "MODEL PREDICTION"}
    fixture = next((row for row in feed.get("fixtures", []) if row.get("match_id") == fixture_id), None)
    if not fixture or fixture.get("status") != "scheduled" or fixture.get("fixture_source") != "VERIFIED_FIXTURE_REGISTRY":
        raise HTTPException(status_code=404, detail="Verified upcoming fixture not found")
    try:
        kickoff = datetime.fromisoformat(fixture["start_time"].replace("Z", "+00:00"))
        if kickoff.tzinfo is None or kickoff <= datetime.now(timezone.utc):
            raise ValueError("Fixture is not in the future")
        result = CricketPredictionService().predict_fixture(
            fixture["format"], fixture["opponent"], kickoff.date()
        )
    except FileNotFoundError as exc:
        return {"status": "unavailable", "reason": str(exc), "data_label": "MODEL PREDICTION"}
    except ValueError as exc:
        return {"status": "unavailable", "reason": str(exc), "data_label": "MODEL PREDICTION"}

    probabilities = result.get("probabilities")
    labels = {"india", "draw", "opponent"} if fixture["format"] == "TEST" else {"india", "opponent"}
    if not isinstance(probabilities, dict) or set(probabilities) != labels:
        return {"status": "unavailable", "reason": "Model outcome classes do not match the fixture format.", "data_label": "MODEL PREDICTION"}
    values = list(probabilities.values())
    if any(not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0 or value > 1 for value in values) or abs(sum(values) - 1) > 1e-6:
        return {"status": "unavailable", "reason": "Model probabilities failed validation.", "data_label": "MODEL PREDICTION"}

    predicted_at = result["prediction_timestamp"]
    # Keep one history snapshot per fixture/model/UTC day. Repeated page loads
    # on the same day stay idempotent, while a later day's prediction can be
    # recorded without colliding with the first-ever prediction for the fixture.
    prediction_time = datetime.fromisoformat(predicted_at.replace("Z", "+00:00"))
    if prediction_time.tzinfo is None:
        return {"status": "unavailable", "reason": "Prediction timestamp is missing a timezone.", "data_label": "MODEL PREDICTION"}
    prediction_day = prediction_time.astimezone(timezone.utc).date().isoformat()
    event_key = hashlib.sha256(
        f"{fixture_id}:{result['model_version']}:{prediction_day}".encode()
    ).hexdigest()
    persistence_status = supabase_store.insert_cricket_prediction_event({
        "event_key": event_key,
        "provider_fixture_id": fixture_id,
        "teams": fixture["teams"],
        "format": fixture["format"],
        "scheduled_start": fixture["start_time"],
        "predicted_at": predicted_at,
        "model_version": result["model_version"],
        "predicted_class": result["prediction"],
        "probabilities": probabilities,
        "data_source": fixture["data_source"],
        "match_status": "scheduled",
    })
    return {
        **result,
        "history_status": {
            "stored": "stored",
            "duplicate": "already_recorded",
            "unavailable": "unavailable",
        }.get(persistence_status, "unavailable"),
    }


@app.post("/explain")
def explain(req: PredictRequest, state: ModelState = Depends(get_model_state)):
    """Real per-match SHAP values (Layer1Ensemble.shap_values_for_match) --
    genuine local interpretability for one specific fixture, not the
    global feature_importances_ that /feature-importance returns. Reuses
    PredictRequest since the inputs are identical to /predict."""
    home = canonical(req.home_team)
    away = canonical(req.away_team)
    if home not in state.timelines or away not in state.timelines:
        raise HTTPException(404, f"Unknown team(s) -- check spelling against historical results: {home}, {away}")

    as_of = req.as_of or state.today
    result = state.ensemble.shap_values_for_match(home, away, as_of, neutral=req.neutral)
    return {**result, "model_version": state.model_version}


@app.get("/champions")
def champions(refresh: bool = False, state: ModelState = Depends(get_model_state)):
    result = state.champion_probabilities(refresh=refresh)
    return {**result, "model_version": state.model_version}


@app.get("/metrics")
def prometheus_metrics():
    """Prometheus text exposition -- scraped by the `prometheus` service in
    docker-compose.airflow.yml and rendered by the `grafana` service's
    provisioned 'WC26 Serving' dashboard. RED metrics (request rate/errors/
    duration) plus predictions-by-outcome and the loaded model version."""
    return Response(content=metrics.render_latest(), media_type=metrics.CONTENT_TYPE_LATEST)


@app.get("/metrics-summary")
def metrics_summary():
    """A small JSON projection of the same metrics for the dashboard's admin
    Observability card -- genuine live counters (requests served, avg
    latency, predictions by outcome, uptime) without asking the browser to
    parse Prometheus text. Distinct from /metrics, which Prometheus scrapes."""
    return metrics.summary()


@app.get("/feature-importance")
def feature_importance(state: ModelState = Depends(get_model_state)):
    """The actually-serving model's real XGBoost feature importances (see
    Layer1Ensemble.xgb_feature_importance) -- for the admin dashboard's
    Training section. Live from state.ensemble, not a static export, so it
    always reflects whichever model this instance loaded/trained at
    startup (registry version or a freshly trained fallback)."""
    return {
        "model_version": state.model_version,
        "model_source": state.model_source,
        "importances": state.ensemble.xgb_feature_importance(),
    }
