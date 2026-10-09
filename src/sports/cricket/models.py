"""Format-specific model: scikit-learn logistic regression wrapped in
probability calibration. XGBoost is used instead when installed and
requested (`backend="xgboost"`); the default keeps the project light.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from src.sports.cricket.config import get_format


def _base(backend: str):
    if backend == "xgboost":
        from xgboost import XGBClassifier  # optional dependency
        return XGBClassifier(n_estimators=120, max_depth=3, learning_rate=0.08, eval_metric="logloss")
    return make_pipeline(StandardScaler(), LogisticRegression(max_iter=500, C=0.5))


class CricketModel:
    def __init__(self, fmt: str, backend: str = "logreg", feature_names: tuple[str, ...] | None = None):
        self.cfg = get_format(fmt)
        self.backend = backend
        self.feature_names = tuple(feature_names or self.cfg.features)
        self.classes_: list[str] = []
        self.model = None

    def fit(self, feats: pd.DataFrame) -> "CricketModel":
        X = feats[list(self.feature_names)].to_numpy(float)
        y = feats["result"].to_numpy()
        self.classes_ = sorted(set(y))
        counts = pd.Series(y).value_counts()
        cv = int(min(3, counts.min()))
        base = _base(self.backend)
        if self.backend == "xgboost":
            self.model = base  # xgboost needs integer labels; handled below
            self._enc = {c: i for i, c in enumerate(self.classes_)}
            self.model.fit(X, np.array([self._enc[v] for v in y]))
        elif cv >= 2:
            self.model = CalibratedClassifierCV(base, method="sigmoid", cv=cv).fit(X, y)
        else:  # too few samples to calibrate: uncalibrated, flagged by caller
            self.model = base.fit(X, y)
        return self

    def predict_proba(self, feats: pd.DataFrame) -> pd.DataFrame:
        X = feats[list(self.feature_names)].to_numpy(float)
        p = self.model.predict_proba(X)
        classes = self.classes_ if self.backend == "xgboost" else list(self.model.classes_)
        out = pd.DataFrame(p, columns=classes)
        for c in self.cfg.outcomes:  # guarantee all outcome columns exist
            if c not in out:
                out[c] = 0.0
        out = out[list(self.cfg.outcomes)]
        return out.div(out.sum(axis=1), axis=0)  # ODI/T20I never carry a draw column

    def explain(self, row: pd.DataFrame, background: pd.DataFrame, max_factors: int = 5) -> dict:
        """Explain calibrated output probabilities with SHAP when available.

        Contributions are changes from the SHAP background expectation for
        the predicted class, in probability units. Failure to explain never
        blocks an otherwise valid prediction.
        """
        try:
            import shap

            names = list(self.feature_names)
            background_values = background[names].to_numpy(float)
            row_values = row[names].to_numpy(float)

            def predict(values):
                frame = pd.DataFrame(values, columns=names)
                return self.predict_proba(frame).to_numpy(float)

            explainer = shap.PermutationExplainer(
                predict, background_values, feature_names=names,
            )
            explanation = explainer(row_values, max_evals=2 * len(names) + 1)
            probabilities = predict(row_values)[0]
            class_index = int(np.argmax(probabilities))
            contributions = np.asarray(explanation.values)[0, :, class_index]
            ranked = sorted(
                ((names[i], float(value)) for i, value in enumerate(contributions)),
                key=lambda item: abs(item[1]), reverse=True,
            )
            factors = [
                {"feature": name, "contribution": value}
                for name, value in ranked[:max_factors]
            ]
            return {
                "status": "available",
                "predicted_class": self.cfg.outcomes[class_index],
                "base_value": float(np.asarray(explanation.base_values)[0, class_index]),
                "positive_factors": [factor for factor in factors if factor["contribution"] > 0],
                "negative_factors": [factor for factor in factors if factor["contribution"] < 0],
                "method": "SHAP permutation explanation of calibrated class probability",
            }
        except Exception as exc:
            return {
                "status": "unavailable",
                "reason": f"SHAP explanation unavailable ({type(exc).__name__})",
                "positive_factors": [],
                "negative_factors": [],
            }
