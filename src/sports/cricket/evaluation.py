"""Walk-forward evaluation: train on matches before a cut, predict after."""
from __future__ import annotations

import numpy as np
import pandas as pd

from src.sports.cricket.config import get_format
from src.sports.cricket.models import CricketModel


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
