"""Fit, evaluate and export the historical India cricket models.

Run: python scripts/train_cricket_models.py
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src.sports.cricket.service import train_cricket_models  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="Train and chronologically evaluate India cricket models.")
    parser.add_argument("--history", type=Path, default=ROOT / "data" / "processed" / "cricket" / "india_internationals.csv")
    parser.add_argument("--artifacts", type=Path, default=ROOT / "models" / "cricket")
    parser.add_argument("--evaluations", type=Path, default=ROOT / "data" / "processed" / "cricket" / "evaluations")
    parser.add_argument("--dashboard", type=Path, default=ROOT / "dashboard" / "data" / "cricket" / "historical_evaluation.json")
    parser.add_argument("--min-train", type=int, default=60)
    parser.add_argument("--step", type=int, default=20)
    args = parser.parse_args()
    result = train_cricket_models(
        args.history, args.artifacts, args.evaluations, args.dashboard,
        min_train=args.min_train, step=args.step,
    )
    print(json.dumps({
        "generated_at": result["generated_at"],
        "data_label": result["data_label"],
        "formats": {
            slug: {"status": value["status"], "n_evaluated": value["n_evaluated"], "metrics": value["metrics"]}
            for slug, value in result["formats"].items()
        },
        "dashboard_export": str(args.dashboard),
        "artifact_directory": str(args.artifacts),
    }, indent=2))


if __name__ == "__main__":
    main()
