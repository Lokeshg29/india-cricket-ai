"""Normalize Cricsheet India men's international match data.

Usage:
    python scripts/ingest_cricsheet.py
    python scripts/ingest_cricsheet.py --archive path/to/india_male_json.zip
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from src.sports.cricket.data import load_cricsheet_archive, write_processed_dataset  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser(description="Build the normalized India cricket historical dataset.")
    parser.add_argument(
        "--archive", type=Path,
        default=ROOT / "data" / "raw" / "cricsheet" / "india_male_json.zip",
        help="Cricsheet India men's JSON archive (default: data/raw/cricsheet/india_male_json.zip)",
    )
    parser.add_argument(
        "--output", type=Path,
        default=ROOT / "data" / "processed" / "cricket",
        help="Output directory (default: data/processed/cricket)",
    )
    args = parser.parse_args()
    matches, summary = load_cricsheet_archive(args.archive)
    manifest = write_processed_dataset(matches, args.archive, args.output, source_summary=summary)
    print(json.dumps({
        "processed_file": str(args.output / "india_internationals.csv"),
        "manifest_file": str(args.output / "manifest.json"),
        "included_matches": manifest["included_matches"],
        "formats": manifest["formats"],
        "results_and_statuses": manifest["results_and_statuses"],
        "excluded": manifest.get("excluded", {}),
    }, indent=2))


if __name__ == "__main__":
    main()
