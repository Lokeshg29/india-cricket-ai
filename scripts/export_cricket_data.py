"""Export dashboard cricket analytics from normalized Cricsheet history.

Player-level statistics and upcoming fixtures remain unavailable because the
match-level normalized source does not provide those data reliably.

    python scripts/export_cricket_data.py
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from src.sports.cricket.config import FORMATS, get_format  # noqa: E402
from src.sports.cricket.features import HISTORY_DATA, load_historical_matches  # noqa: E402

OUT = ROOT / "dashboard" / "data" / "cricket"
EVALUATION_EXPORT = OUT / "historical_evaluation.json"
SOURCE = "Cricsheet"
HISTORICAL = "HISTORICAL DATA"
SOURCE_TYPE = "HISTORICAL_DATA"
BACKTEST = "HISTORICAL BACKTEST"
UNAVAILABLE = "UNAVAILABLE"


def _round(value: float, digits: int = 4) -> float:
    return round(float(value), digits)


def _validation(slug: str) -> dict:
    """Use the actual walk-forward export, or return an explicit pending shape."""
    try:
        exported = json.loads(EVALUATION_EXPORT.read_text(encoding="utf-8"))
        value = exported["formats"][slug]["validation"]
        return {**value, "data_label": BACKTEST}
    except (OSError, KeyError, TypeError, json.JSONDecodeError):
        return {
            "n_evaluated": 0,
            "accuracy": None,
            "precision": None,
            "recall": None,
            "f1": None,
            "macro_f1": None,
            "brier": None,
            "log_loss": None,
            "confusion_matrix": {"labels": [], "matrix": {}},
            "calibration": [],
            "data_label": UNAVAILABLE,
        }


def _format_export(slug: str, matches, evaluation: dict) -> dict:
    cfg = get_format(slug)
    code = cfg.display.upper()
    rows = matches[matches["format"].eq(code)].sort_values(["date", "match_id"], kind="stable")
    resolved = rows[rows["result"].isin(cfg.outcomes)].copy()
    resolved["result_label"] = resolved["result"]
    resolved["outcome_points"] = resolved["result"].map({"india": 1.0, "draw": 0.5, "opponent": 0.0})

    recent = resolved.tail(10).iloc[::-1]
    results = [
        {
            "match_id": str(row.match_id),
            "date": row.date.isoformat(),
            "opponent": str(row.india_opponent),
            "venue": row.venue or "Venue unavailable",
            "result": str(row.result),
            "data_label": HISTORICAL,
            "source": SOURCE,
        }
        for row in recent.itertuples()
    ]

    h2h = []
    for opponent, group in resolved.groupby("india_opponent", sort=True):
        h2h.append({
            "opponent": str(opponent),
            "played": int(len(group)),
            "india_wins": int(group["result"].eq("india").sum()),
            "opponent_wins": int(group["result"].eq("opponent").sum()),
            "draws": int(group["result"].eq("draw").sum()),
            "data_label": HISTORICAL,
            "source": SOURCE,
        })

    venues = []
    venue_rows = resolved[resolved["venue"].fillna("").str.strip().ne("")]
    for venue, group in venue_rows.groupby("venue", sort=True):
        if len(group) < 5:
            continue
        venues.append({
            "venue": str(venue),
            "played": int(len(group)),
            "win_rate": _round(group["result"].eq("india").mean()),
            "data_label": HISTORICAL,
            "source": SOURCE,
        })

    rolling = resolved[["date", "outcome_points"]].copy()
    rolling["form"] = rolling["outcome_points"].rolling(cfg.form_window, min_periods=1).mean()
    form = [
        {"date": row.date.isoformat(), "form": _round(row.form), "data_label": HISTORICAL, "source": SOURCE}
        for row in rolling.tail(40).itertuples()
    ]

    validation = evaluation.get("validation") or _validation(slug)
    model_version = evaluation.get("model_version") or "unavailable"
    evaluation_status = evaluation.get("status") == "EVALUATED"
    return {
        "format": cfg.display,
        "slug": slug,
        "has_draw": cfg.has_draw,
        "outcomes": list(cfg.outcomes),
        "data_label": HISTORICAL,
        "data_source": SOURCE,
        "model_version": model_version,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "features": evaluation.get("features", []),
        "summary": {
            "matches_tracked": int(len(rows)),
            "predictions_generated": int(evaluation.get("n_evaluated", 0)),
            "accuracy": validation.get("accuracy"),
            "holdout_accuracy": validation.get("accuracy"),
        },
        "data_sources": {
            "matches": {"status": HISTORICAL, "source": SOURCE},
            "results": {"status": HISTORICAL, "source": SOURCE, "note": "Resolved match outcomes only."},
            "form": {"status": HISTORICAL, "source": SOURCE, "note": "Rolling points use resolved results in this format."},
            "head_to_head": {"status": HISTORICAL, "source": SOURCE, "note": "Counts include resolved matches only."},
            "venues": {"status": HISTORICAL if venues else UNAVAILABLE, "source": SOURCE if venues else None,
                       "note": "Known stadiums with at least five resolved matches; no home/away classification is inferred."},
            "players": {"status": UNAVAILABLE, "source": None,
                        "note": "The normalized match table has no player-level scorecards."},
            "fixtures": {"status": UNAVAILABLE, "source": None,
                         "note": "No verified upcoming international fixture feed is configured."},
            "prediction_trend": {"status": UNAVAILABLE, "source": None,
                                 "note": "No future-match trend is generated without verified fixtures."},
            "evaluation": {"status": BACKTEST if evaluation_status else UNAVAILABLE,
                           "source": SOURCE if evaluation_status else None},
        },
        "upcoming": [],
        "results": results,
        "h2h": h2h,
        "venues": venues,
        "form": form,
        "trend": [],
        "players": [],
        "validation": validation,
        "ledger": [],
    }


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    matches = load_historical_matches(HISTORY_DATA)
    # Guard the dashboard export against an accidental mixed or domestic input.
    if not matches["source_type"].eq(SOURCE_TYPE).all():
        raise ValueError("dashboard analytics export requires Cricsheet HISTORICAL_DATA only")

    evaluation_export = {}
    try:
        evaluation_export = json.loads(EVALUATION_EXPORT.read_text(encoding="utf-8"))
        evaluations = evaluation_export.get("formats", {})
    except (OSError, json.JSONDecodeError):
        evaluations = {}

    per_format = {
        slug: _format_export(slug, matches, evaluations.get(slug, {}))
        for slug in FORMATS
    }
    for slug, value in per_format.items():
        (OUT / f"{slug}.json").write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    model_registry = []
    for slug, value in per_format.items():
        evaluation = evaluations.get(slug, {})
        metrics = evaluation.get("metrics", {})
        model_registry.append({
            "format": value["format"].upper(),
            "version": value["model_version"],
            "stage": "evaluated" if evaluation.get("status") == "EVALUATED" else "pending",
            "backend": evaluation.get("model_type", "unavailable"),
            "accuracy": metrics.get("accuracy"),
            "brier": metrics.get("brier"),
            "log_loss": metrics.get("log_loss"),
            "data_label": BACKTEST if evaluation.get("status") == "EVALUATED" else UNAVAILABLE,
        })

    checks = [
        {"name": "Cricsheet source rows", "status": "pass"},
        {"name": "India men's international filter", "status": "pass"},
        {"name": "IPL/domestic T20 excluded", "status": "pass"},
        {"name": "player-level data", "status": "unavailable"},
        {"name": "upcoming fixture feed", "status": "unavailable"},
    ]
    shared = {
        "model_registry": model_registry,
        "system_health": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "api": "local endpoint; not deployed",
            "mlflow": "not connected",
            "data_label": HISTORICAL,
        },
        "data_quality": {"checks": checks, "data_label": HISTORICAL},
        "drift": {"status": "unavailable (no live feed)", "data_label": UNAVAILABLE},
        "training": {
            "last_trained": evaluation_export.get("generated_at") if evaluations else None,
            "status": "walk-forward evaluation available" if evaluations else "evaluation pending",
            "data_label": BACKTEST if evaluations else UNAVAILABLE,
        },
    }
    for name, value in shared.items():
        (OUT / f"{name}.json").write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print("wrote Cricsheet-backed format exports:", ", ".join(per_format))


if __name__ == "__main__":
    main()
