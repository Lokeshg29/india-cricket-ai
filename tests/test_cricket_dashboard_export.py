from __future__ import annotations

import pytest

from scripts.export_cricket_data import _format_export
from src.sports.cricket.features import HISTORY_DATA, load_historical_matches


@pytest.fixture(scope="module")
def cricsheet_matches():
    return load_historical_matches(HISTORY_DATA)


@pytest.mark.parametrize(
    ("slug", "code", "expected_total"),
    [("test", "TEST", 219), ("odi", "ODI", 526), ("t20i", "T20I", 276)],
)
def test_format_analytics_are_derived_from_cricsheet_and_not_demo(slug, code, expected_total, cricsheet_matches):
    export = _format_export(slug, cricsheet_matches, {})
    matches = cricsheet_matches[cricsheet_matches["format"].eq(code)]
    resolved = matches[matches["result"].isin(("india", "draw", "opponent"))]

    assert export["data_label"] == "HISTORICAL DATA"
    assert export["data_source"] == "Cricsheet"
    assert export["summary"]["matches_tracked"] == expected_total
    assert export["upcoming"] == []
    assert export["trend"] == []
    assert export["players"] == []
    assert export["ledger"] == []
    assert export["data_sources"]["fixtures"]["status"] == "UNAVAILABLE"
    assert export["data_sources"]["players"]["status"] == "UNAVAILABLE"
    assert sum(row["played"] for row in export["h2h"]) == len(resolved)
    assert sum(row["played"] for row in export["venues"]) <= len(resolved)
    assert all(row["data_label"] == "HISTORICAL DATA" for row in export["results"])
    assert all(row["source"] == "Cricsheet" for row in export["form"])


def test_real_test_h2h_preserves_draws_and_limited_overs_do_not_gain_draws(cricsheet_matches):
    test = _format_export("test", cricsheet_matches, {})
    odi = _format_export("odi", cricsheet_matches, {})

    assert sum(row["draws"] for row in test["h2h"]) == 54
    assert sum(row["draws"] for row in odi["h2h"]) == 0
