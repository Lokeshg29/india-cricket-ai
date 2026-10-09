from __future__ import annotations

from datetime import timedelta

import joblib
import numpy as np
import pandas as pd

from src.sports.cricket.evaluation import walk_forward_historical
from src.sports.cricket.features import (
    HISTORY_FEATURES,
    build_historical_features,
    load_historical_matches,
)
from src.sports.cricket.models import CricketModel
from src.sports.cricket.service import CricketPredictionService


def test_historical_features_are_lagged_and_exclude_post_match_fields():
    matches = load_historical_matches()
    original = build_historical_features(matches, "odi")
    changed = matches.copy(deep=True)
    last_id = changed.loc[changed.index[-1], "match_id"]
    changed.loc[changed.index[-1], "result"] = "opponent"
    changed.at[changed.index[-1], "innings_parsed"] = []
    changed_features = build_historical_features(changed, "odi")
    feature_columns = list(HISTORY_FEATURES["odi"])

    np.testing.assert_allclose(
        original.loc[original.match_id == last_id, feature_columns].to_numpy(float),
        changed_features.loc[changed_features.match_id == last_id, feature_columns].to_numpy(float),
    )
    assert all("toss" not in name and "venue" not in name for name in feature_columns)


def test_same_date_matches_do_not_update_each_others_features():
    matches = load_historical_matches()
    first = matches[matches["format"].eq("ODI")].iloc[[0]].copy()
    second = first.copy()
    second.loc[:, "match_id"] = "same-date-second"
    second.loc[:, "india_opponent"] = "Another opponent"
    same_day = pd.concat([first, second], ignore_index=True)

    features = build_historical_features(same_day, "odi")
    assert features["india_elo_pre"].tolist() == [1500.0, 1500.0]
    assert features["h2h_matches_before"].tolist() == [0.0, 0.0]


def test_walk_forward_stores_real_chronological_predictions_and_metrics():
    matches = load_historical_matches()
    features = build_historical_features(matches, "odi")
    evaluation = walk_forward_historical(features, "odi", min_train=80, step=150)

    assert evaluation["status"] == "EVALUATED"
    assert evaluation["data_label"] == "HISTORICAL BACKTEST"
    assert evaluation["n_evaluated"] > 0
    assert 0 <= evaluation["metrics"]["accuracy"] <= 1
    assert evaluation["metrics"]["precision"] is not None
    assert evaluation["metrics"]["recall"] is not None
    assert evaluation["metrics"]["f1"] is not None
    assert evaluation["metrics"]["log_loss"] >= 0
    assert evaluation["metrics"]["brier"] >= 0
    for record in evaluation["ledger"]:
        assert record["prediction_timestamp"] is None
        assert record["evaluation_timestamp"]
        assert record["verified_pre_match"] is False
        assert abs(sum(record["probabilities"].values()) - 1) < 1e-9


def test_model_shap_explanation_is_real_or_gracefully_unavailable():
    matches = load_historical_matches()
    features = build_historical_features(matches, "odi")
    train = features[features["result"].isin(("india", "opponent"))].iloc[:120]
    model = CricketModel("odi", feature_names=HISTORY_FEATURES["odi"]).fit(train)
    row = train.iloc[[-1]][list(HISTORY_FEATURES["odi"])]
    background = train[list(HISTORY_FEATURES["odi"])].tail(5)

    explanation = model.explain(row, background, max_factors=5)
    assert explanation["status"] in {"available", "unavailable"}
    if explanation["status"] == "available":
        assert explanation["method"].startswith("SHAP")
        assert explanation["predicted_class"] in {"india", "opponent"}


def test_prediction_service_returns_model_prediction_without_live_data(tmp_path, monkeypatch):
    matches = load_historical_matches()
    features = build_historical_features(matches, "odi")
    train = features[features["result"].isin(("india", "opponent"))].iloc[:120]
    model = CricketModel("odi", feature_names=HISTORY_FEATURES["odi"]).fit(train)
    latest_date = max(matches.loc[matches["format"].eq("ODI"), "date"])
    known_opponent = str(matches.loc[matches["format"].eq("ODI"), "india_opponent"].mode().iloc[0])
    metadata = {
        "model_version": "test-odi-v1",
        "training_data_range": {"from": "2001-01-01", "to": latest_date.isoformat()},
    }
    artifact_dir = tmp_path / "artifacts"
    artifact_dir.mkdir()
    joblib.dump({
        "model": model,
        "background": train[list(HISTORY_FEATURES["odi"])].tail(5),
        "metadata": metadata,
    }, artifact_dir / "odi.joblib")
    monkeypatch.setattr(
        CricketModel,
        "explain",
        lambda self, row, background: {"status": "unavailable", "positive_factors": [], "negative_factors": []},
    )
    service = CricketPredictionService(artifact_dir=artifact_dir)

    prediction = service.predict_fixture("odi", known_opponent, latest_date + timedelta(days=1))

    assert prediction["status"] == "available"
    assert prediction["data_label"] == "MODEL PREDICTION"
    assert prediction["model_version"] == "test-odi-v1"
    assert abs(sum(prediction["probabilities"].values()) - 1) < 1e-9
