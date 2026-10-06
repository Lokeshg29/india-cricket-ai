"""Cricsheet ingestion and normalized India men's international match data.

This module handles match-level normalization only. It does not build ML
features, fit models, or evaluate predictions.
"""
from __future__ import annotations

import csv
import hashlib
import json
import zipfile
from collections import Counter
from dataclasses import asdict, dataclass
from datetime import date
from pathlib import Path
from typing import Any, Iterable

SOURCE_NAME = "Cricsheet"
SOURCE_TYPE = "HISTORICAL_DATA"
SOURCE_URL = "https://cricsheet.org/downloads/india_male_json.zip"
JSON_FORMAT_URL = "https://cricsheet.org/format/json/"
FORMAT_MAP = {"Test": "TEST", "ODI": "ODI", "T20": "T20I", "IT20": "T20I"}
VALID_RESULTS = {
    "TEST": {"INDIA_WIN", "DRAW", "OPPONENT_WIN"},
    "ODI": {"INDIA_WIN", "OPPONENT_WIN"},
    "T20I": {"INDIA_WIN", "OPPONENT_WIN"},
}
CSV_FIELDS = [
    "match_id", "format", "date", "season", "year", "venue", "city", "country",
    "team_1", "team_2", "india_involved", "india_opponent", "toss_winner",
    "toss_decision", "innings", "result", "winner", "match_status", "source", "source_type",
]


class DataValidationError(ValueError):
    """Raised when a match record violates the normalized cricket schema."""


@dataclass(frozen=True)
class CricketMatch:
    match_id: str
    format: str
    date: str
    season: str
    year: int
    venue: str | None
    city: str | None
    country: str | None
    team_1: str
    team_2: str
    india_involved: bool
    india_opponent: str
    toss_winner: str | None
    toss_decision: str | None
    innings: tuple[dict[str, Any], ...]
    result: str | None
    winner: str | None
    match_status: str
    source: str = SOURCE_NAME
    source_type: str = SOURCE_TYPE


def normalize_format(match_type: str, team_type: str) -> str:
    """Map Cricsheet formats; T20 is T20I only for international teams."""
    if team_type.casefold() != "international":
        raise DataValidationError(f"not an international match: {team_type!r}")
    try:
        return FORMAT_MAP[match_type]
    except KeyError:
        raise DataValidationError(f"unsupported international format: {match_type!r}") from None


def _clean_team(value: Any) -> str:
    if not isinstance(value, str) or not value.strip():
        return ""
    value = value.strip()
    return "India" if value.casefold() in {"india", "india men"} else value


def _optional_text(value: Any) -> str | None:
    return value.strip() if isinstance(value, str) and value.strip() else None


def _innings_summaries(innings: Any) -> tuple[dict[str, Any], ...]:
    if not isinstance(innings, list):
        return ()
    summaries = []
    for number, entry in enumerate(innings, start=1):
        if not isinstance(entry, dict):
            continue
        runs = 0
        wickets = 0
        legal_deliveries = 0
        for over in entry.get("overs", []):
            if not isinstance(over, dict):
                continue
            for delivery in over.get("deliveries", []):
                if not isinstance(delivery, dict):
                    continue
                run_data = delivery.get("runs", {})
                runs += int(run_data.get("total", 0)) if isinstance(run_data, dict) else 0
                extras = delivery.get("extras", {})
                if not isinstance(extras, dict) or not ({"wides", "noballs"} & extras.keys()):
                    legal_deliveries += 1
                dismissals = delivery.get("wickets", [])
                wickets += sum(
                    1 for dismissal in dismissals
                    if isinstance(dismissal, dict) and dismissal.get("kind") != "retired hurt"
                )
        penalty = entry.get("penalty_runs", {})
        if isinstance(penalty, dict):
            runs += sum(int(penalty.get(edge, 0)) for edge in ("pre", "post"))
        target = entry.get("target", {})
        if not isinstance(target, dict):
            target = {}
        summaries.append({
            "innings_number": number,
            "batting_team": _clean_team(entry.get("team")) or None,
            "runs": runs,
            "wickets": wickets,
            "legal_deliveries": legal_deliveries,
            "declared": bool(entry.get("declared", False)),
            "forfeited": bool(entry.get("forfeited", False)),
            "super_over": bool(entry.get("super_over", False)),
            "target_runs": target.get("runs"),
            "target_overs": target.get("overs"),
        })
    return tuple(summaries)


def _result_fields(fmt: str, teams: tuple[str, str], outcome: Any) -> tuple[str | None, str | None, str]:
    if not isinstance(outcome, dict):
        return None, None, "UNKNOWN_RESULT"

    # Eliminator/bowl-out winners decide an otherwise tied limited-overs game.
    winner = _clean_team(
        outcome.get("winner") or outcome.get("eliminator") or outcome.get("bowl_out")
    ) or None
    source_result = str(outcome.get("result", "")).strip().casefold()
    if winner:
        if winner not in teams:
            raise DataValidationError(f"winner {winner!r} is not one of the match teams {teams}")
        result = "INDIA_WIN" if winner == "India" else "OPPONENT_WIN"
        return result, winner, "COMPLETED"
    if source_result == "draw":
        if fmt != "TEST":
            raise DataValidationError(f"draw result is invalid for {fmt}")
        return "DRAW", None, "DRAWN"
    if source_result == "tie":
        return None, None, "TIED"
    if source_result in {"no result", "abandoned"}:
        return None, None, "NO_RESULT"
    return None, None, "UNKNOWN_RESULT"


def normalize_cricsheet_match(match_id: str, raw: dict[str, Any]) -> CricketMatch:
    """Normalize one male India international Cricsheet JSON match."""
    if not isinstance(match_id, str) or not match_id.strip():
        raise DataValidationError("missing match_id")
    if not isinstance(raw, dict) or not isinstance(raw.get("info"), dict):
        raise DataValidationError(f"{match_id}: missing info object")

    info = raw["info"]
    if str(info.get("gender", "")).casefold() != "male":
        raise DataValidationError(f"{match_id}: expected men's match")
    if str(info.get("team_type", "")).casefold() != "international":
        raise DataValidationError(f"{match_id}: expected international match")

    raw_teams = info.get("teams")
    teams = tuple(_clean_team(team) for team in raw_teams) if isinstance(raw_teams, list) else ()
    if len(teams) != 2 or not all(teams) or teams[0].casefold() == teams[1].casefold():
        raise DataValidationError(f"{match_id}: missing or invalid teams")
    if teams.count("India") != 1:
        raise DataValidationError(f"{match_id}: expected India to appear exactly once")

    fmt = normalize_format(str(info.get("match_type", "")), str(info.get("team_type", "")))
    dates = info.get("dates")
    if not isinstance(dates, list) or not dates:
        raise DataValidationError(f"{match_id}: missing match date")
    try:
        match_date = date.fromisoformat(str(dates[0])).isoformat()
    except ValueError:
        raise DataValidationError(f"{match_id}: invalid match date {dates[0]!r}") from None

    toss = info.get("toss", {})
    if not isinstance(toss, dict):
        toss = {}
    toss_winner = _clean_team(toss.get("winner")) or None
    toss_decision = _optional_text(toss.get("decision"))
    result, winner, status = _result_fields(fmt, teams, info.get("outcome"))
    india_opponent = teams[1] if teams[0] == "India" else teams[0]

    match = CricketMatch(
        match_id=match_id.strip(),
        format=fmt,
        date=match_date,
        season=str(info.get("season") or match_date[:4]),
        year=date.fromisoformat(match_date).year,
        venue=_optional_text(info.get("venue")),
        city=_optional_text(info.get("city")),
        country=_optional_text(info.get("country")),
        team_1=teams[0],
        team_2=teams[1],
        india_involved=True,
        india_opponent=india_opponent,
        toss_winner=toss_winner,
        toss_decision=toss_decision,
        innings=_innings_summaries(raw.get("innings")),
        result=result,
        winner=winner,
        match_status=status,
    )
    validate_matches([match])
    return match


def validate_matches(matches: Iterable[CricketMatch]) -> list[CricketMatch]:
    """Validate required fields and reject duplicate IDs or match identities."""
    records = list(matches)
    issues: list[str] = []
    valid_statuses = {"COMPLETED", "DRAWN", "TIED", "NO_RESULT", "UNKNOWN_RESULT"}
    seen_ids: set[str] = set()
    seen_identity: set[tuple[str, str, tuple[str, str]]] = set()
    for index, match in enumerate(records):
        prefix = f"row {index + 1}"
        if not isinstance(match.match_id, str) or not match.match_id.strip():
            issues.append(f"{prefix}: missing match_id")
        elif match.match_id in seen_ids:
            issues.append(f"{prefix}: duplicate match_id {match.match_id!r}")
        else:
            seen_ids.add(match.match_id)
        if match.format not in VALID_RESULTS:
            issues.append(f"{prefix}: invalid format {match.format!r}")
        try:
            parsed_date = date.fromisoformat(match.date)
            if match.year != parsed_date.year:
                issues.append(f"{prefix}: year does not match date")
        except (TypeError, ValueError):
            issues.append(f"{prefix}: invalid date {match.date!r}")
        if (
            not isinstance(match.team_1, str) or not match.team_1.strip()
            or not isinstance(match.team_2, str) or not match.team_2.strip()
            or match.team_1.casefold() == match.team_2.casefold()
        ):
            issues.append(f"{prefix}: missing or invalid teams")
        teams = (match.team_1, match.team_2)
        india_count = sum(isinstance(team, str) and team.casefold() == "india" for team in teams)
        if match.india_involved is not True or india_count != 1:
            issues.append(f"{prefix}: India identification is invalid")
        expected_opponent = match.team_2 if isinstance(match.team_1, str) and match.team_1.casefold() == "india" else match.team_1
        if not isinstance(match.india_opponent, str) or match.india_opponent != expected_opponent:
            issues.append(f"{prefix}: India opponent does not match teams")
        if match.result is not None and match.result not in VALID_RESULTS.get(match.format, set()):
            issues.append(f"{prefix}: invalid result {match.result!r} for {match.format}")
        if match.result == "DRAW" and match.format != "TEST":
            issues.append(f"{prefix}: only Test matches may be draws")
        if match.winner is not None and match.winner not in (match.team_1, match.team_2):
            issues.append(f"{prefix}: winner is not a match team")
        if match.winner is not None and match.result is not None:
            expected_result = "INDIA_WIN" if match.winner == "India" else "OPPONENT_WIN"
            if match.result != expected_result:
                issues.append(f"{prefix}: result does not agree with winner")
        if match.match_status not in valid_statuses:
            issues.append(f"{prefix}: invalid match status {match.match_status!r}")
        if match.match_status == "DRAWN" and (match.format != "TEST" or match.result != "DRAW" or match.winner):
            issues.append(f"{prefix}: invalid Test draw representation")
        if match.match_status in {"TIED", "NO_RESULT", "UNKNOWN_RESULT"} and match.result is not None:
            issues.append(f"{prefix}: unresolved match status cannot have a training result")
        if match.toss_winner is not None and match.toss_winner not in (match.team_1, match.team_2):
            issues.append(f"{prefix}: toss winner is not a match team")
        if match.toss_decision is not None and match.toss_decision.casefold() not in {"bat", "field"}:
            issues.append(f"{prefix}: invalid toss decision {match.toss_decision!r}")
        for innings in match.innings:
            batting_team = innings.get("batting_team")
            if batting_team is not None and batting_team not in (match.team_1, match.team_2):
                issues.append(f"{prefix}: innings team is not a match team")
            if any(int(innings.get(key, 0)) < 0 for key in ("runs", "wickets", "legal_deliveries")):
                issues.append(f"{prefix}: innings totals cannot be negative")
        if match.source != SOURCE_NAME or match.source_type != SOURCE_TYPE:
            issues.append(f"{prefix}: source metadata must identify Cricsheet historical data")
        identity = (match.format, match.date, tuple(sorted((match.team_1.casefold(), match.team_2.casefold()))))
        if identity in seen_identity:
            issues.append(f"{prefix}: duplicate match identity {identity!r}")
        seen_identity.add(identity)

    if issues:
        raise DataValidationError("Data validation failed:\n- " + "\n- ".join(issues))
    return records


def load_cricsheet_archive(archive_path: Path) -> tuple[list[CricketMatch], dict[str, Any]]:
    """Read an India team JSON archive without extracting its raw files."""
    archive_path = Path(archive_path)
    if not archive_path.is_file():
        raise FileNotFoundError(f"Cricsheet archive not found: {archive_path}; download {SOURCE_URL}")
    matches: list[CricketMatch] = []
    excluded: Counter[str] = Counter()
    source_types: Counter[str] = Counter()
    data_versions: Counter[str] = Counter()
    with zipfile.ZipFile(archive_path) as archive:
        bad_member = archive.testzip()
        if bad_member:
            raise DataValidationError(f"corrupt ZIP member: {bad_member}")
        json_members = sorted(name for name in archive.namelist() if name.casefold().endswith(".json"))
        for member in json_members:
            match_id = Path(member).stem.strip()
            if not match_id:
                raise DataValidationError(f"missing match_id in archive path {member!r}")
            try:
                raw = json.loads(archive.read(member))
            except (json.JSONDecodeError, UnicodeDecodeError) as exc:
                raise DataValidationError(f"invalid JSON in {member}: {exc}") from exc
            info = raw.get("info", {}) if isinstance(raw, dict) else {}
            teams = info.get("teams", []) if isinstance(info, dict) else []
            cleaned_teams = [_clean_team(team) for team in teams] if isinstance(teams, list) else []
            if str(info.get("gender", "")).casefold() != "male":
                excluded["not_male"] += 1
                continue
            if str(info.get("team_type", "")).casefold() != "international":
                excluded["not_international"] += 1
                continue
            if cleaned_teams.count("India") != 1:
                excluded["not_india_international"] += 1
                continue
            source_type = str(info.get("match_type", ""))
            source_types[source_type or "MISSING"] += 1
            try:
                match = normalize_cricsheet_match(match_id, raw)
            except DataValidationError as exc:
                if "unsupported international format" in str(exc):
                    excluded[f"unsupported_format:{source_type or 'MISSING'}"] += 1
                    continue
                raise
            matches.append(match)
            meta = raw.get("meta", {})
            if isinstance(meta, dict) and meta.get("data_version"):
                data_versions[str(meta["data_version"])] += 1

    validate_matches(matches)
    if not matches:
        raise DataValidationError("the archive contained no supported India men's international matches")
    format_counts = Counter(match.format for match in matches)
    result_counts = Counter(f"{match.format}:{match.result or match.match_status}" for match in matches)
    summary = {
        "archive": archive_path.name,
        "source_json_matches": len(json_members),
        "included_matches": len(matches),
        "formats": dict(sorted(format_counts.items())),
        "results_and_statuses": dict(sorted(result_counts.items())),
        "source_match_types": dict(sorted(source_types.items())),
        "source_data_versions": dict(sorted(data_versions.items())),
        "excluded": dict(sorted(excluded.items())),
    }
    return sorted(matches, key=lambda row: (row.date, row.format, row.match_id)), summary


def _csv_row(match: CricketMatch) -> dict[str, Any]:
    row = asdict(match)
    row["innings"] = json.dumps(match.innings, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return row


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def write_processed_dataset(
    matches: Iterable[CricketMatch],
    archive_path: Path,
    output_dir: Path,
    source_summary: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Write stable match-level CSV and provenance manifest."""
    records = validate_matches(matches)
    records.sort(key=lambda row: (row.date, row.format, row.match_id))
    archive_path = Path(archive_path)
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    csv_path = output_dir / "india_internationals.csv"
    with csv_path.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=CSV_FIELDS, extrasaction="raise", lineterminator="\n")
        writer.writeheader()
        writer.writerows(_csv_row(record) for record in records)

    summary = source_summary or {
        "included_matches": len(records),
        "formats": dict(sorted(Counter(record.format for record in records).items())),
        "results_and_statuses": dict(sorted(Counter(
            f"{record.format}:{record.result or record.match_status}" for record in records
        ).items())),
    }
    manifest = {
        "dataset": "India men's international cricket match history",
        "data_status": SOURCE_TYPE,
        "source": SOURCE_NAME,
        "source_url": SOURCE_URL,
        "format_documentation": JSON_FORMAT_URL,
        "source_archive": archive_path.name,
        "source_archive_sha256": _sha256(archive_path),
        "source_data_format": "Cricsheet JSON; match-level normalization",
        "date_range": {
            "from": min(record.date for record in records),
            "to": max(record.date for record in records),
        },
        "processed_file": csv_path.name,
        **summary,
    }
    manifest_path = output_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return manifest
