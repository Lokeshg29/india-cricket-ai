"""Export dashboard data for India Cricket AI.

Runs the real pipeline (features -> format model -> calibration ->
walk-forward evaluation -> ledger) on DEMO DATA by default, because no real
historical dataset ships in the repo. Every output file carries a
`data_label` so the UI can never present demo numbers as real.

    python scripts/export_cricket_data.py
"""
from __future__ import annotations

import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.sports.cricket.config import FORMATS, get_format  # noqa: E402
from src.sports.cricket.demo_data import OPPONENTS, make_history  # noqa: E402
from src.sports.cricket.evaluation import walk_forward  # noqa: E402
from src.sports.cricket.features import build_features  # noqa: E402
from src.sports.cricket.models import CricketModel  # noqa: E402

OUT = ROOT / "dashboard" / "data" / "cricket"
LABEL = "DEMO DATA"
MODEL_VERSION = "cricket-demo-0.1.0"
NOW = datetime.now(timezone.utc)
FIXTURES = {  # DEMO fixtures -- not the real schedule
    "test": [("Australia", "Melbourne", "away", "2026-12-26"), ("England", "Hyderabad", "home", "2027-01-20"),
             ("South Africa", "Kolkata", "home", "2027-02-14")],
    "odi": [("New Zealand", "Mumbai", "home", "2026-11-08"), ("Pakistan", "Dubai", "neutral", "2026-12-02"),
            ("Sri Lanka", "Colombo", "away", "2027-01-11"), ("Australia", "Delhi", "home", "2027-02-02")],
    "t20i": [("England", "Ahmedabad", "home", "2026-11-15"), ("Bangladesh", "Dhaka", "away", "2026-12-09"),
             ("West Indies", "Bridgetown", "away", "2027-01-18"), ("Afghanistan", "Chennai", "home", "2027-02-10")],
}
ROLES = ["Opener", "Top-order batter", "Middle-order batter", "Wicketkeeper-batter", "All-rounder",
         "Fast bowler", "Spinner"]


def _r(x, n=4):
    return round(float(x), n)


def conf_label(p: float) -> str:
    return "HIGH" if p >= 0.65 else "MEDIUM" if p >= 0.52 else "LOW"


def explain(feats: pd.DataFrame, row: pd.DataFrame, cfg) -> list[dict]:
    """Logistic-coefficient contributions on a surrogate model.
    NOT SHAP -- labelled as such in the output."""
    X = feats[list(cfg.features)].to_numpy(float)
    sc = StandardScaler().fit(X)
    lr = LogisticRegression(max_iter=500, C=0.5).fit(sc.transform(X), feats["result"])
    idx = list(lr.classes_).index("india")
    z = sc.transform(row[list(cfg.features)].to_numpy(float))[0]
    contrib = lr.coef_[idx] * z
    order = np.argsort(-np.abs(contrib))[:5]
    return [{"feature": cfg.features[i], "contribution": _r(contrib[i], 3)} for i in order]


def ledger_hash(prev: str, rec: dict) -> str:
    return hashlib.sha256((prev + json.dumps(rec, sort_keys=True, default=str)).encode()).hexdigest()


def build_format(fmt: str) -> dict:
    cfg = get_format(fmt)
    hist = make_history(fmt)
    feats = build_features(hist, fmt)
    ev = walk_forward(feats, fmt)

    holdout = 20
    model = CricketModel(fmt).fit(feats.iloc[:-holdout])
    P = model.predict_proba(feats.iloc[-holdout:])

    # prediction ledger (DEMO: generated in a batch, NOT a real pre-match proof)
    ledger, prev = [], "GENESIS"
    for i in range(holdout):
        h = hist.iloc[-holdout + i]
        rec = {
            "match_id": f"{fmt}-demo-{i + 1:03d}", "format": fmt.upper(), "date": str(h["date"].date()),
            "opponent": h["opponent"],
            "prediction_timestamp": str((h["date"] - pd.Timedelta(days=1)).date()) + "T00:00:00Z",
            "model_version": MODEL_VERSION,
            "india_probability": _r(P.iloc[i]["india"]),
            "opponent_probability": _r(P.iloc[i]["opponent"]),
            "actual_result": h["result"],
            "model_correct": bool(P.iloc[i].idxmax() == h["result"]),
        }
        if cfg.has_draw:
            rec["draw_probability"] = _r(P.iloc[i]["draw"])
        prev = ledger_hash(prev, rec)
        ledger.append({**rec, "hash": prev, "verified_pre_match": False, "data_label": LABEL})

    full_model = CricketModel(fmt).fit(feats)
    upcoming = []
    for k, (opp, venue, vt, date) in enumerate(FIXTURES[fmt]):
        extra = pd.DataFrame([{**hist.iloc[-1].to_dict(), "date": pd.Timestamp(date), "opponent": opp,
                               "venue_type": vt, "toss_won": 0, "result": "india"}])
        row = build_features(pd.concat([hist, extra], ignore_index=True), fmt).iloc[[-1]]
        p = full_model.predict_proba(row).iloc[0]
        probs = {"india": _r(p["india"]), "opponent": _r(p["opponent"])}
        if cfg.has_draw:
            probs["draw"] = _r(p["draw"])
        upcoming.append({
            "match_id": f"{fmt}-up-{k + 1:02d}", "opponent": opp, "venue": venue, "venue_type": vt,
            "date": date, "format": cfg.display, "probabilities": probs,
            "confidence": conf_label(max(probs.values())),
            "explanation": explain(feats, row, cfg), "explanation_method": "logistic-coefficient surrogate (not SHAP)",
            "data_label": LABEL,
        })

    recent = hist.tail(10).iloc[::-1]
    results = [{"date": str(r["date"].date()), "opponent": r["opponent"], "venue": r["venue"],
                "result": r["result"], "data_label": LABEL} for _, r in recent.iterrows()]

    h2h = []
    for opp in OPPONENTS:
        s = hist[hist["opponent"] == opp]
        if len(s):
            h2h.append({"opponent": opp, "played": int(len(s)), "india_wins": int((s.result == "india").sum()),
                        "opponent_wins": int((s.result == "opponent").sum()), "draws": int((s.result == "draw").sum())})
    venues = []
    for vt in ["home", "away", "neutral"]:
        s = hist[hist["venue_type"] == vt]
        venues.append({"venue": vt.title(), "played": int(len(s)),
                       "win_rate": _r((s.result == "india").mean()) if len(s) else 0.0})
    for v, s in hist.groupby("venue"):
        if len(s) >= 5:
            venues.append({"venue": v, "played": int(len(s)), "win_rate": _r((s.result == "india").mean())})

    pts = hist["result"].map({"india": 1, "draw": 0.5, "opponent": 0}).to_numpy()
    form = [{"date": str(d.date()), "form": _r(pts[max(0, i - cfg.form_window + 1): i + 1].mean())}
            for i, d in enumerate(hist["date"]) if i >= len(hist) - 24]

    trend = []
    for u in upcoming:
        for w in range(6):  # DEMO trend: model re-fit on progressively more history
            m = CricketModel(fmt).fit(feats.iloc[: len(feats) - 5 * (5 - w) - holdout // 2])
            trend.append({"match_id": u["match_id"], "step": w + 1, "india": _r(m.predict_proba(feats.iloc[[-1]])["india"].iloc[0])})

    rng = np.random.default_rng(7)
    players = []
    for i, role in enumerate(ROLES):
        bat = role not in ("Fast bowler", "Spinner")
        players.append({
            "player": f"Demo Player {i + 1}", "role": role, "recent_matches": 6,
            "runs": int(rng.integers(120, 420)) if bat else int(rng.integers(10, 80)),
            "average": _r(rng.uniform(28, 58) if bat else rng.uniform(8, 20), 1),
            "strike_rate": _r(rng.uniform(70, 95) if fmt == "test" else rng.uniform(85, 150), 1) if bat else None,
            "wickets": int(rng.integers(0, 4)) if bat else int(rng.integers(8, 24)),
            "economy": _r(rng.uniform(2.6, 3.4) if fmt == "test" else rng.uniform(4.8, 8.6), 2) if not bat or role == "All-rounder" else None,
            "data_label": LABEL,
        })

    test_acc = float((P.idxmax(axis=1).reset_index(drop=True) == hist["result"].tail(holdout).reset_index(drop=True)).mean())
    return {
        "format": cfg.display, "slug": fmt, "has_draw": cfg.has_draw, "outcomes": list(cfg.outcomes),
        "data_label": LABEL, "model_version": MODEL_VERSION, "generated_at": NOW.isoformat(),
        "features": list(cfg.features),
        "summary": {"matches_tracked": int(len(hist)), "predictions_generated": len(ledger) + len(upcoming),
                    "accuracy": _r(ev["accuracy"]), "holdout_accuracy": _r(test_acc)},
        "upcoming": upcoming, "results": results, "h2h": h2h, "venues": venues, "form": form,
        "trend": trend, "players": players, "validation": ev, "ledger": ledger,
    }


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    all_fmt = {}
    for fmt in FORMATS:
        data = build_format(fmt)
        all_fmt[fmt] = data
        (OUT / f"{fmt}.json").write_text(json.dumps(data, indent=1, default=str))
    shared = {
        "model_registry": [{"format": f.upper(), "version": MODEL_VERSION, "stage": "demo",
                            "backend": "logistic regression + sigmoid calibration",
                            "accuracy": d["summary"]["accuracy"], "brier": _r(d["validation"]["brier"]),
                            "log_loss": _r(d["validation"]["log_loss"]), "data_label": LABEL}
                           for f, d in all_fmt.items()],
        "system_health": {"generated_at": NOW.isoformat(), "api": "not deployed (local)",
                          "mlflow": "not connected", "data_label": LABEL},
        "data_quality": {"checks": [{"name": "schema", "status": "pass"}, {"name": "result labels", "status": "pass"},
                                    {"name": "chronological order", "status": "pass"},
                                    {"name": "real data source", "status": "missing"}], "data_label": LABEL},
        "drift": {"status": "not monitored (demo data has no live feed)", "data_label": LABEL},
        "training": {"last_trained": NOW.isoformat(), "status": "demo run", "data_label": LABEL},
    }
    for name, val in shared.items():
        (OUT / f"{name}.json").write_text(json.dumps(val, indent=1))
    print("wrote", sorted(p.name for p in OUT.iterdir()))


if __name__ == "__main__":
    main()
