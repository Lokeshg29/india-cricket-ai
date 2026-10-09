"""Train and serve the Cricsheet-backed India cricket models."""
from __future__ import annotations

import json
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import pandas as pd

from src.sports.cricket.config import get_format
from src.sports.cricket.evaluation import (
    CRICKET_MODEL_VERSION,
    HISTORICAL_BACKTEST_LABEL,
    walk_forward_historical,
)
from src.sports.cricket.features import (
    FEATURE_VERSION,
    HISTORY_DATA,
    HISTORY_FEATURES,
    build_historical_features,
    features_for_fixture,
    load_historical_matches,
)
from src.sports.cricket.models import CricketModel

ROOT = Path(__file__).resolve().parents[3]
DEFAULT_ARTIFACT_DIR = ROOT / "models" / "cricket"
DEFAULT_EVALUATION_DIR = ROOT / "data" / "processed" / "cricket" / "evaluations"
DEFAULT_DASHBOARD_EXPORT = ROOT / "dashboard" / "data" / "cricket" / "historical_evaluation.json"
FORMAT_CODES = {"test": "TEST", "odi": "ODI", "t20i": "T20I"}


def train_cricket_models(
    history_path: str | Path = HISTORY_DATA,
    artifact_dir: str | Path = DEFAULT_ARTIFACT_DIR,
    evaluation_dir: str | Path = DEFAULT_EVALUATION_DIR,
    dashboard_path: str | Path = DEFAULT_DASHBOARD_EXPORT,
    min_train: int = 60,
    step: int = 20,
) -> dict[str, Any]:
    """Evaluate chronological folds and save one calibrated model per format."""
    matches = load_historical_matches(history_path)
    artifact_dir, evaluation_dir = Path(artifact_dir), Path(evaluation_dir)
    artifact_dir.mkdir(parents=True, exist_ok=True)
    evaluation_dir.mkdir(parents=True, exist_ok=True)
    trained_at = datetime.now(timezone.utc).isoformat()
    per_format: dict[str, dict] = {}

    for slug, code in FORMAT_CODES.items():
        features = build_historical_features(matches, slug)
        evaluation = walk_forward_historical(features, slug, min_train=min_train, step=step)
        train_rows = features[features["result"].isin(get_format(slug).outcomes)].reset_index(drop=True)
        required = set(get_format(slug).outcomes)
        if set(train_rows["result"]) != required or train_rows["result"].value_counts().min() < 3:
            evaluation["status"] = "EVALUATION_PENDING"
            evaluation["reason"] = "Insufficient labeled rows to fit every format outcome safely."
            per_format[slug] = evaluation
            (evaluation_dir / f"{slug}.json").write_text(json.dumps(evaluation, indent=2) + "\n", encoding="utf-8")
            continue

        model = CricketModel(slug, feature_names=HISTORY_FEATURES[slug]).fit(train_rows)
        model_version = f"{CRICKET_MODEL_VERSION}-{slug}"
        # Small deterministic background set keeps per-prediction SHAP bounded.
        background = train_rows[list(HISTORY_FEATURES[slug])].tail(40).reset_index(drop=True)
        metadata = {
            "format": code,
            "model_type": "StandardScaler + LogisticRegression + sigmoid calibration",
            "model_version": model_version,
            "feature_version": FEATURE_VERSION,
            "training_timestamp": trained_at,
            "training_data_source": "Cricsheet India men's international matches",
            "training_data_range": {
                "from": min(str(value) for value in train_rows["date"]),
                "to": max(str(value) for value in train_rows["date"]),
            },
            "training_matches": int(len(train_rows)),
            "features": list(HISTORY_FEATURES[slug]),
            "evaluation_metrics": evaluation.get("metrics"),
            "evaluation_status": evaluation.get("status"),
            "evaluation_timestamp": evaluation.get("evaluation_timestamp"),
        }
        artifact_path = artifact_dir / f"{slug}.joblib"
        joblib.dump({"model": model, "background": background, "metadata": metadata}, artifact_path, compress=3)
        (artifact_dir / f"{slug}.metadata.json").write_text(
            json.dumps(metadata, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
        )

        evaluation.update({
            "model_version": model_version,
            "model_type": metadata["model_type"],
            "feature_version": FEATURE_VERSION,
            "training_matches": len(train_rows),
            "training_data_range": metadata["training_data_range"],
            "features": list(HISTORY_FEATURES[slug]),
        })
        (evaluation_dir / f"{slug}.json").write_text(
            json.dumps(evaluation, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
        )
        # Keep only the latest records in the small dashboard bundle. The full
        # prediction ledger remains in data/processed/cricket/evaluations/.
        dashboard_ledger = []
        for record in evaluation.get("ledger", [])[-12:]:
            probabilities = record["probabilities"]
            dashboard_ledger.append({
                "match_id": record["match_id"],
                "format": record["format"],
                "date": record["date"],
                "opponent": record["opponent"],
                "prediction_timestamp": None,
                "evaluation_timestamp": record["evaluation_timestamp"],
                "model_version": record["model_version"],
                "india_probability": probabilities["india"],
                "opponent_probability": probabilities["opponent"],
                "draw_probability": probabilities.get("draw"),
                "actual_result": record["actual_result"],
                "predicted_result": record["predicted_class"],
                "model_correct": record["model_correct"],
                "verified_pre_match": False,
                "data_label": record["data_label"],
            })
        validation = {
            "n_evaluated": evaluation["n_evaluated"],
            **evaluation.get("metrics", {}),
            "confusion_matrix": evaluation.get("confusion_matrix"),
            "calibration": evaluation.get("calibration", []),
        }
        per_format[slug] = {
            **{key: value for key, value in evaluation.items() if key != "ledger"},
            "validation": validation,
            "ledger": dashboard_ledger,
        }

    dashboard_export = {
        "generated_at": trained_at,
        "source": "Cricsheet",
        "data_label": HISTORICAL_BACKTEST_LABEL,
        "formats": per_format,
    }
    Path(dashboard_path).parent.mkdir(parents=True, exist_ok=True)
    Path(dashboard_path).write_text(
        json.dumps(dashboard_export, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    return dashboard_export


class CricketPredictionService:
    """Load trained cricket artifacts and generate model predictions."""

    def __init__(self, artifact_dir: str | Path = DEFAULT_ARTIFACT_DIR, history_path: str | Path = HISTORY_DATA):
        self.artifact_dir = Path(artifact_dir)
        self.history = load_historical_matches(history_path)
        self.artifacts: dict[str, dict] = {}

    def _load(self, fmt: str) -> dict:
        slug = fmt.lower()
        if slug not in FORMAT_CODES:
            raise ValueError(f"Unsupported cricket format: {fmt}")
        if slug not in self.artifacts:
            path = self.artifact_dir / f"{slug}.joblib"
            if not path.is_file():
                raise FileNotFoundError(f"Prediction unavailable: train the {FORMAT_CODES[slug]} model first")
            self.artifacts[slug] = joblib.load(path)
        return self.artifacts[slug]

    def predict_match(self, fmt: str, match_features: dict[str, float] | pd.DataFrame) -> dict:
        """Predict from a feature row built before the match."""
        slug = fmt.lower()
        artifact = self._load(slug)
        model: CricketModel = artifact["model"]
        row = match_features if isinstance(match_features, pd.DataFrame) else pd.DataFrame([match_features])
        missing = set(model.feature_names) - set(row.columns)
        if missing:
            raise ValueError(f"Prediction unavailable: missing pre-match features {sorted(missing)}")
        row = row[list(model.feature_names)].apply(pd.to_numeric, errors="coerce")
        if row.isna().any().any():
            raise ValueError("Prediction unavailable: pre-match features contain missing or non-numeric values")
        probs = model.predict_proba(row).iloc[0]
        predicted = str(probs.idxmax())
        background = artifact["background"]
        explanation = model.explain(row, background)
        metadata = artifact["metadata"]
        return {
            "format": FORMAT_CODES[slug],
            "prediction": predicted,
            "probabilities": {label: float(probs[label]) for label in get_format(slug).outcomes},
            "model_version": metadata["model_version"],
            "prediction_timestamp": datetime.now(timezone.utc).isoformat(),
            "data_label": "MODEL PREDICTION",
            "status": "available",
            "explanation": explanation,
        }

    def predict_fixture(self, fmt: str, opponent: str, match_date: date | None = None) -> dict:
        """Generate a current/future estimate using only known match history."""
        slug = fmt.lower()
        artifact = self._load(slug)
        metadata = artifact["metadata"]
        as_of = match_date or datetime.now(timezone.utc).date()
        latest_training_date = date.fromisoformat(metadata["training_data_range"]["to"])
        if as_of <= latest_training_date:
            raise ValueError("Prediction unavailable: requested date is not after the model's training data")
        same_format = self.history[self.history["format"].eq(FORMAT_CODES[slug])]
        known_opponents = same_format.loc[
            same_format["india_opponent"].astype(str).str.casefold().eq(opponent.casefold()), "india_opponent"
        ]
        if known_opponents.empty:
            raise ValueError("Prediction unavailable: no prior India international history for this opponent and format")
        canonical_opponent = str(known_opponents.iloc[-1])
        prior_head_to_head = same_format[
            same_format["date"].lt(as_of)
            & same_format["india_opponent"].astype(str).str.casefold().eq(canonical_opponent.casefold())
            & same_format["result"].notna()
        ]
        if len(prior_head_to_head) < 3:
            raise ValueError("Prediction unavailable: fewer than three resolved prior matches against this opponent")
        feature_row = features_for_fixture(self.history, slug, canonical_opponent, as_of)
        result = self.predict_match(slug, feature_row)
        result["match_date"] = as_of.isoformat()
        result["opponent"] = canonical_opponent
        return result


def predict_match(fmt: str, match_features: dict[str, float] | pd.DataFrame, artifact_dir: str | Path = DEFAULT_ARTIFACT_DIR) -> dict:
    """Convenience API for code that already has a validated feature row."""
    return CricketPredictionService(artifact_dir=artifact_dir).predict_match(fmt, match_features)
