"""Walk-forward evaluation: train on matches before a cut, predict after."""
from __future__ import annotations

from datetime import datetime, timezone

import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score, log_loss, precision_score, recall_score

from src.sports.cricket.config import get_format
from src.sports.cricket.features import FEATURE_VERSION, HISTORY_FEATURES
from src.sports.cricket.models import CricketModel

HISTORICAL_BACKTEST_LABEL = "HISTORICAL BACKTEST"
CRICKET_MODEL_VERSION = "cricket-history-logreg-sigmoid-v1"


def brier_multiclass(probs: pd.DataFrame, y: pd.Series) -> float:
    onehot = np.stack([(y == c).to_numpy(float) for c in probs.columns], axis=1)
    return float(np.mean(np.sum((probs.to_numpy() - onehot) ** 2, axis=1)))


def walk_forward(feats: pd.DataFrame, fmt: str, min_train: int = 40, step: int = 10) -> dict:
    cfg = get_format(fmt)
    preds, ys = [], []
    for start in range(min_train, len(feats), step):
        train, test = feats.iloc[:start], feats.iloc[start:start + step]
        if train["result"].nunique() < len(cfg.outcomes) - (0 if cfg.has_draw else 0):
            continue
        m = CricketModel(fmt).fit(train)
        preds.append(m.predict_proba(test))
        ys.append(test["result"])
    if not preds:
        raise ValueError("not enough data for walk-forward evaluation")
    P, y = pd.concat(preds, ignore_index=True), pd.concat(ys, ignore_index=True)
    labels = list(P.columns)
    pick = P.idxmax(axis=1)
    conf = {a: {b: int(((y == a) & (pick == b)).sum()) for b in labels} for a in labels}
    bins = np.linspace(0, 1, 6)
    top = P.max(axis=1).to_numpy()
    hit = (pick == y).to_numpy(float)
    calib = []
    for lo, hi in zip(bins[:-1], bins[1:]):
        mask = (top >= lo) & (top < hi if hi < 1 else top <= hi)
        if mask.sum():
            calib.append({"bin": f"{lo:.1f}-{hi:.1f}", "n": int(mask.sum()),
                          "mean_confidence": float(top[mask].mean()),
                          "accuracy": float(hit[mask].mean())})
    return {
        "n_evaluated": int(len(y)),
        "accuracy": float(hit.mean()),
        "brier": brier_multiclass(P, y),
        "log_loss": float(-np.mean(np.log(np.clip(
            [P.loc[i, y[i]] for i in range(len(y))], 1e-6, 1)))),
        "confusion_matrix": {"labels": labels, "matrix": conf},
        "calibration": calib,
    }


def walk_forward_historical(
    feats: pd.DataFrame,
    fmt: str,
    min_train: int = 60,
    step: int = 20,
) -> dict:
    """Evaluate Cricsheet features in chronological expanding-window folds.

    Each fold trains only on earlier labeled matches. The walk-forward rows
    carry no claimed prediction timestamp because Cricsheet supplies dates,
    not kickoff times or archived pre-match calls.
    """
    cfg = get_format(fmt)
    feature_names = HISTORY_FEATURES[fmt.lower()]
    ordered = feats.sort_values(["date", "match_id"], kind="stable").reset_index(drop=True)
    labeled = ordered[ordered["result"].isin(cfg.outcomes)].reset_index(drop=True)
    labels = list(cfg.outcomes)
    evaluation_timestamp = datetime.now(timezone.utc).isoformat()
    model_version = f"{CRICKET_MODEL_VERSION}-{fmt.lower()}"
    predictions: list[dict] = []

    for start in range(min_train, len(labeled), step):
        train = labeled.iloc[:start]
        test = labeled.iloc[start:start + step]
        counts = train["result"].value_counts()
        if any(counts.get(label, 0) < 3 for label in labels):
            continue
        model = CricketModel(fmt, feature_names=feature_names).fit(train)
        probabilities = model.predict_proba(test[list(feature_names)])
        for pos, (_, row) in enumerate(test.iterrows()):
            prob_row = probabilities.iloc[pos]
            predicted = str(prob_row.idxmax())
            predictions.append({
                "match_id": str(row["match_id"]),
                "format": cfg.display,
                "date": row["date"].isoformat() if hasattr(row["date"], "isoformat") else str(row["date"]),
                "opponent": str(row["opponent"]),
                "prediction_timestamp": None,
                "evaluation_timestamp": evaluation_timestamp,
                "model_version": model_version,
                "training_cutoff_date": str(train.iloc[-1]["date"]),
                "training_matches": len(train),
                "predicted_class": predicted,
                "probabilities": {label: float(prob_row[label]) for label in labels},
                "actual_result": str(row["result"]),
                "model_correct": predicted == row["result"],
                "verified_pre_match": False,
                "data_label": HISTORICAL_BACKTEST_LABEL,
            })

    if not predictions:
        return {
            "format": cfg.display,
            "slug": fmt.lower(),
            "status": "EVALUATION_PENDING",
            "data_label": HISTORICAL_BACKTEST_LABEL,
            "reason": "Insufficient chronologically prior labeled matches for every outcome class.",
            "n_evaluated": 0,
            "metrics": {name: None for name in ("accuracy", "precision", "recall", "f1", "macro_f1", "log_loss", "brier")},
            "confusion_matrix": {"labels": labels, "matrix": {label: {pred: 0 for pred in labels} for label in labels}},
            "calibration": [],
            "ledger": [],
        }

    actual = np.asarray([record["actual_result"] for record in predictions])
    predicted = np.asarray([record["predicted_class"] for record in predictions])
    probability_matrix = np.asarray([[record["probabilities"][label] for label in labels] for record in predictions])
    metrics = {
        "accuracy": float(accuracy_score(actual, predicted)),
        "precision": None if cfg.has_draw else float(precision_score(actual, predicted, pos_label="india", zero_division=0)),
        "recall": None if cfg.has_draw else float(recall_score(actual, predicted, pos_label="india", zero_division=0)),
        "f1": None if cfg.has_draw else float(f1_score(actual, predicted, pos_label="india", zero_division=0)),
        "macro_f1": float(f1_score(actual, predicted, labels=labels, average="macro", zero_division=0)),
        "log_loss": float(log_loss(actual, probability_matrix, labels=labels)),
        "brier": float(np.mean(np.sum((probability_matrix - np.eye(len(labels))[[labels.index(y) for y in actual]]) ** 2, axis=1))),
    }
    matrix = confusion_matrix(actual, predicted, labels=labels)
    confusion = {label: {guess: int(matrix[i, j]) for j, guess in enumerate(labels)} for i, label in enumerate(labels)}

    top_confidence = probability_matrix.max(axis=1)
    hit = (actual == predicted).astype(float)
    calibration = []
    edges = np.linspace(0, 1, 6)
    for low, high in zip(edges[:-1], edges[1:]):
        mask = (top_confidence >= low) & (top_confidence < high if high < 1 else top_confidence <= high)
        if mask.any():
            calibration.append({
                "bin": f"{low:.1f}-{high:.1f}",
                "n": int(mask.sum()),
                "mean_confidence": float(top_confidence[mask].mean()),
                "accuracy": float(hit[mask].mean()),
            })
    return {
        "format": cfg.display,
        "slug": fmt.lower(),
        "status": "EVALUATED",
        "data_label": HISTORICAL_BACKTEST_LABEL,
        "model_version": model_version,
        "model_type": "StandardScaler + LogisticRegression + sigmoid calibration",
        "feature_version": FEATURE_VERSION,
        "n_evaluated": len(predictions),
        "training_data_range": {
            "from": min(str(v) for v in ordered["date"]),
            "to": max(str(v) for v in ordered["date"]),
        },
        "metrics": metrics,
        "confusion_matrix": {"labels": labels, "matrix": confusion},
        "calibration": calibration,
        "evaluation_timestamp": evaluation_timestamp,
        "ledger": predictions,
        "features": list(feature_names),
        "evaluation_method": f"Expanding walk-forward; min_train={min_train}; step={step}; no shuffling.",
    }
