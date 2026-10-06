from __future__ import annotations

import json
import zipfile
import pytest

from src.sports.cricket.data import (
    DataValidationError,
    load_cricsheet_archive,
    normalize_cricsheet_match,
    normalize_format,
    validate_matches,
)


def _raw(
    *, match_type="Test", teams=None, winner="India", result=None, date="2024-01-01",
):
    outcome = {"winner": winner} if winner else {"result": result}
    return {
        "meta": {"data_version": "1.2.0"},
        "info": {
            "gender": "male",
            "team_type": "international",
            "match_type": match_type,
            "teams": teams or ["Australia", "India"],
            "dates": [date],
            "season": 2024,
            "venue": "Example Ground",
            "city": "Example City",
            "outcome": outcome,
            "toss": {"winner": "India", "decision": "bat"},
        },
        "innings": [
            {"team": "Australia", "overs": [{"over": 0, "deliveries": [
                {"runs": {"total": 2}, "extras": {}},
                {"runs": {"total": 0}, "extras": {}, "wickets": [{"kind": "bowled"}]},
            ]}]},
            {"team": "India", "overs": [{"over": 0, "deliveries": [
                {"runs": {"total": 1}, "extras": {"wides": 1}},
            ]}]},
        ],
    }


def test_format_normalization_and_domestic_t20_rejection():
    assert normalize_format("Test", "international") == "TEST"
    assert normalize_format("ODI", "international") == "ODI"
    assert normalize_format("T20", "international") == "T20I"
    assert normalize_format("IT20", "international") == "T20I"
    with pytest.raises(DataValidationError):
        normalize_format("T20", "club")
    with pytest.raises(DataValidationError):
        normalize_format("ODM", "international")


def test_match_id_is_required_and_preserved():
    with pytest.raises(DataValidationError, match="missing match_id"):
        normalize_cricsheet_match("", _raw())
    assert normalize_cricsheet_match("123456", _raw()).match_id == "123456"


def test_duplicate_ids_and_duplicate_match_identities_are_rejected():
    match = normalize_cricsheet_match("one", _raw())
    with pytest.raises(DataValidationError, match="duplicate match_id"):
        validate_matches([match, match])
    same_match_new_id = normalize_cricsheet_match("two", _raw())
    with pytest.raises(DataValidationError, match="duplicate match identity"):
        validate_matches([match, same_match_new_id])


def test_india_opponent_works_when_india_is_team_one_or_two():
    india_second = normalize_cricsheet_match("one", _raw(teams=["Australia", "India"]))
    india_first = normalize_cricsheet_match("two", _raw(teams=["India", "Australia"]))
    assert india_second.india_involved is True
    assert india_second.india_opponent == "Australia"
    assert india_first.india_opponent == "Australia"


def test_test_draw_is_preserved_as_draw_not_loss():
    match = normalize_cricsheet_match("draw", _raw(winner=None, result="draw"))
    assert match.format == "TEST"
    assert match.result == "DRAW"
    assert match.winner is None
    assert match.match_status == "DRAWN"


def test_odi_winner_maps_to_india_opponent_target():
    india_wins = normalize_cricsheet_match("odi-win", _raw(match_type="ODI", winner="India"))
    opponent_wins = normalize_cricsheet_match("odi-loss", _raw(match_type="ODI", winner="Australia"))
    assert india_wins.result == "INDIA_WIN"
    assert opponent_wins.result == "OPPONENT_WIN"
    assert "DRAW" not in {india_wins.result, opponent_wins.result}


def test_t20_source_format_becomes_t20i_and_ties_are_not_losses():
    match = normalize_cricsheet_match("t20-tie", _raw(match_type="T20", winner=None, result="tie"))
    assert match.format == "T20I"
    assert match.result is None
    assert match.match_status == "TIED"


def test_required_schema_fields_and_innings_summary_are_present():
    match = normalize_cricsheet_match("schema", _raw())
    required = {
        "match_id", "format", "date", "season", "year", "venue", "city", "country",
        "team_1", "team_2", "india_involved", "india_opponent", "toss_winner",
        "toss_decision", "innings", "result", "winner", "match_status", "source", "source_type",
    }
    assert required <= set(match.__dataclass_fields__)
    assert match.innings[0]["batting_team"] == "Australia"
    assert match.innings[0]["runs"] == 2
    assert match.innings[0]["wickets"] == 1
    assert match.source_type == "HISTORICAL_DATA"


@pytest.mark.parametrize(
    "raw, message",
    [
        (_raw(date="2024-13-01"), "invalid match date"),
        (_raw(teams=["India", "India"]), "missing or invalid teams"),
        (_raw(match_type="ODI", winner=None, result="draw"), "draw result is invalid"),
    ],
)
def test_invalid_records_fail_validation(raw, message):
    with pytest.raises(DataValidationError, match=message):
        normalize_cricsheet_match("invalid", raw)


def test_archive_loader_uses_filename_ids_and_excludes_franchise_records(tmp_path):
    archive_path = tmp_path / "source.zip"
    international = _raw(match_type="T20")
    domestic = _raw(match_type="T20")
    domestic["info"]["team_type"] = "club"
    with zipfile.ZipFile(archive_path, "w") as archive:
        archive.writestr("100001.json", json.dumps(international))
        archive.writestr("100002.json", json.dumps(domestic))

    matches, summary = load_cricsheet_archive(archive_path)
    assert [match.match_id for match in matches] == ["100001"]
    assert matches[0].format == "T20I"
    assert summary["excluded"] == {"not_international": 1}
