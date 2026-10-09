"""Shared cricket feature pipeline. Input: chronological match rows
(date, opponent, venue_type, toss_won, result in {india, opponent, draw}
plus optional per-match stat columns). Output: leak-free features -- every
value for a match is computed only from matches strictly before it.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
import json
from collections import defaultdict, deque
from datetime import date
from pathlib import Path

from src.sports.cricket.config import FormatConfig, get_format

REQUIRED = ["date", "opponent", "venue_type", "toss_won", "result"]
STAT_COLS = ["bat_avg_diff", "bowl_avg_diff", "run_rate_diff", "economy_diff",
             "bowling_depth_diff", "powerplay_diff", "death_overs_diff"]

FEATURE_VERSION = "cricsheet-pre-match-v1"
COMMON_HISTORY_FEATURES = (
    "india_elo_pre", "opponent_elo_pre", "elo_diff", "india_recent_win_rate",
    "h2h_india_win_rate", "h2h_matches_before",
)
HISTORY_FEATURES = {
    "test": COMMON_HISTORY_FEATURES + (
        "india_batting_average", "opponent_batting_average", "india_bowling_average",
        "opponent_bowling_average", "india_first_innings_runs", "opponent_first_innings_runs",
        "draw_tendency",
    ),
    "odi": COMMON_HISTORY_FEATURES + (
        "india_run_rate", "opponent_run_rate", "india_batting_average", "opponent_batting_average",
        "india_bowling_economy", "opponent_bowling_economy", "india_wickets_lost",
        "opponent_wickets_lost", "india_bowling_wickets", "opponent_bowling_wickets",
    ),
    "t20i": COMMON_HISTORY_FEATURES + (
        "india_run_rate", "opponent_run_rate", "india_batting_average", "opponent_batting_average",
        "india_bowling_economy", "opponent_bowling_economy", "india_wickets_lost",
        "opponent_wickets_lost", "india_bowling_wickets", "opponent_bowling_wickets",
    ),
}
HISTORY_DATA = Path(__file__).resolve().parents[3] / "data" / "processed" / "cricket" / "india_internationals.csv"
HISTORY_RESULT_MAP = {"INDIA_WIN": "india", "DRAW": "draw", "OPPONENT_WIN": "opponent"}


def load_historical_matches(path: str | Path = HISTORY_DATA) -> pd.DataFrame:
    """Load the normalized Cricsheet match table and keep India internationals."""
    frame = pd.read_csv(path, dtype={"match_id": str, "team_1": str, "team_2": str})
    required = {"match_id", "format", "date", "team_1", "team_2", "india_opponent", "result", "innings", "source_type"}
    missing = required - set(frame.columns)
    if missing:
        raise ValueError(f"Cricsheet table is missing columns: {sorted(missing)}")
    if not frame["source_type"].eq("HISTORICAL_DATA").all() or not frame["team_1"].eq("India").sum() + frame["team_2"].eq("India").sum() == len(frame):
        raise ValueError("expected only HISTORICAL_DATA India international matches")
    frame["date"] = pd.to_datetime(frame["date"], errors="raise").dt.date
    frame["format"] = frame["format"].str.upper()
    frame["result"] = frame["result"].map(HISTORY_RESULT_MAP)
    frame["innings_parsed"] = frame["innings"].map(
        lambda value: json.loads(value) if isinstance(value, str) and value else []
    )
    return frame.sort_values(["date", "match_id"], kind="stable").reset_index(drop=True)


def _match_team_stats(row: pd.Series, team: str) -> dict[str, float]:
    innings = [i for i in row["innings_parsed"] if not i.get("super_over")]
    batting = [i for i in innings if i.get("batting_team") == team]
    bowling_against = [i for i in innings if i.get("batting_team") and i.get("batting_team") != team]
    runs = sum(float(i.get("runs", 0)) for i in batting)
    wickets = sum(float(i.get("wickets", 0)) for i in batting)
    balls = sum(float(i.get("legal_deliveries", 0)) for i in batting)
    conceded = sum(float(i.get("runs", 0)) for i in bowling_against)
    bowling_wickets = sum(float(i.get("wickets", 0)) for i in bowling_against)
    bowling_balls = sum(float(i.get("legal_deliveries", 0)) for i in bowling_against)
    first_innings = next((float(i.get("runs", 0)) for i in batting), 0.0)
    return {
        "run_rate": runs * 6 / balls if balls else 0.0,
        "batting_average": runs / wickets if wickets else runs,
        "wickets_lost": wickets,
        "bowling_economy": conceded * 6 / bowling_balls if bowling_balls else 0.0,
        "bowling_average": conceded / bowling_wickets if bowling_wickets else conceded,
        "bowling_wickets": bowling_wickets,
        "first_innings_runs": first_innings,
    }


def _mean_stat(history: deque, key: str) -> float:
    values = [item[key] for item in history if item[key] is not None]
    return float(np.mean(values)) if values else 0.0


def build_historical_features(matches: pd.DataFrame, fmt: str, form_window: int | None = None) -> pd.DataFrame:
    """Build match features from strictly earlier Cricsheet records only.

    Rows sharing a date are all featurized before any row from that date updates
    Elo or rolling state because source data has no reliable kickoff time.
    """
    fmt = fmt.lower()
    if fmt not in HISTORY_FEATURES:
        raise KeyError(f"Unknown cricket format {fmt!r}")
    cfg = get_format(fmt)
    window = form_window or cfg.form_window
    ordered = matches[matches["format"].eq(fmt.upper())].sort_values(["date", "match_id"], kind="stable")
    if ordered.empty:
        raise ValueError(f"No historical India matches available for {fmt.upper()}")
    ratings: dict[str, float] = defaultdict(lambda: 1500.0)
    recent_results: deque[float] = deque(maxlen=window)
    recent_draws: deque[float] = deque(maxlen=window)
    h2h: dict[str, list[float]] = defaultdict(list)
    team_stats: dict[str, deque[dict[str, float]]] = defaultdict(lambda: deque(maxlen=window))
    output: list[dict] = []

    for _, day_rows in ordered.groupby("date", sort=True):
        day_updates = []
        for _, row in day_rows.iterrows():
            opponent = str(row["india_opponent"])
            india_elo, opponent_elo = ratings["India"], ratings[opponent]
            prior_h2h = h2h[opponent]
            india_stats, opponent_stats = team_stats["India"], team_stats[opponent]
            record = {
                "match_id": str(row["match_id"]), "format": fmt.upper(), "date": row["date"],
                "opponent": opponent,
                "india_elo_pre": india_elo, "opponent_elo_pre": opponent_elo,
                "elo_diff": india_elo - opponent_elo,
                "india_recent_win_rate": float(np.mean(recent_results)) if recent_results else 0.5,
                "h2h_india_win_rate": float(np.mean(prior_h2h)) if prior_h2h else 0.5,
                "h2h_matches_before": float(len(prior_h2h)),
                "india_batting_average": _mean_stat(india_stats, "batting_average"),
                "opponent_batting_average": _mean_stat(opponent_stats, "batting_average"),
                "india_bowling_average": _mean_stat(india_stats, "bowling_average"),
                "opponent_bowling_average": _mean_stat(opponent_stats, "bowling_average"),
                "india_first_innings_runs": _mean_stat(india_stats, "first_innings_runs"),
                "opponent_first_innings_runs": _mean_stat(opponent_stats, "first_innings_runs"),
                "india_run_rate": _mean_stat(india_stats, "run_rate"),
                "opponent_run_rate": _mean_stat(opponent_stats, "run_rate"),
                "india_bowling_economy": _mean_stat(india_stats, "bowling_economy"),
                "opponent_bowling_economy": _mean_stat(opponent_stats, "bowling_economy"),
                "india_wickets_lost": _mean_stat(india_stats, "wickets_lost"),
                "opponent_wickets_lost": _mean_stat(opponent_stats, "wickets_lost"),
                "india_bowling_wickets": _mean_stat(india_stats, "bowling_wickets"),
                "opponent_bowling_wickets": _mean_stat(opponent_stats, "bowling_wickets"),
                "draw_tendency": float(np.mean(recent_draws)) if recent_draws else 0.0,
                "result": row["result"],
            }
            output.append(record)
            india_stats_current = _match_team_stats(row, "India")
            opponent_stats_current = _match_team_stats(row, opponent)
            day_updates.append((opponent, row["result"], india_stats_current, opponent_stats_current))

        # Update only after every match on this date has features.
        for opponent, result, india_performance, opponent_performance in day_updates:
            team_stats["India"].append(india_performance)
            team_stats[opponent].append(opponent_performance)
            if result not in {"india", "opponent", "draw"}:
                continue
            score = {"india": 1.0, "draw": 0.5, "opponent": 0.0}[result]
            expected = 1.0 / (1.0 + 10 ** ((ratings[opponent] - ratings["India"]) / 400.0))
            delta = 24.0 * (score - expected)
            ratings["India"] += delta
            ratings[opponent] -= delta
            recent_results.append(float(result == "india"))
            recent_draws.append(float(result == "draw"))
            h2h[opponent].append(float(result == "india"))

    frame = pd.DataFrame(output)
    for column in HISTORY_FEATURES[fmt]:
        frame[column] = pd.to_numeric(frame[column], errors="coerce").fillna(0.0)
    return frame


def features_for_fixture(matches: pd.DataFrame, fmt: str, opponent: str, match_date: date) -> pd.DataFrame:
    """Return one pre-match feature row; never project results/toss/venue inputs."""
    fmt = fmt.lower()
    same_format = matches[matches["format"].eq(fmt.upper())]
    if not same_format["india_opponent"].astype(str).str.casefold().eq(opponent.casefold()).any():
        raise ValueError("Prediction unavailable: no prior India international history for this opponent and format")
    past = matches[matches["date"] < match_date]
    prior_rows = past[past["format"].eq(fmt.upper())]
    if prior_rows.empty:
        raise ValueError("Prediction unavailable: no prior history for this format")
    # Construct a result-free fixture. It is processed after history but never
    # contributes to any rolling feature because features are emitted first.
    candidate = prior_rows.iloc[-1].copy()
    candidate["match_id"] = "__prediction__"
    candidate["date"] = match_date
    candidate["india_opponent"] = opponent
    candidate["result"] = None
    candidate["innings_parsed"] = []
    combined = pd.concat([prior_rows, pd.DataFrame([candidate])], ignore_index=True)
    candidate_features = build_historical_features(combined, fmt)
    row = candidate_features[candidate_features["match_id"].eq("__prediction__")]
    if row.empty:
        raise ValueError("Prediction unavailable: the requested match date is not after available history")
    return row.reset_index(drop=True)


def validate(df: pd.DataFrame) -> pd.DataFrame:
    missing = [c for c in REQUIRED if c not in df.columns]
    if missing:
        raise ValueError(f"missing columns: {missing}")
    bad = set(df["result"]) - {"india", "opponent", "draw"}
    if bad:
        raise ValueError(f"invalid result labels: {bad}")
    if df["venue_type"].isin(["home", "away", "neutral"]).sum() != len(df):
        raise ValueError("venue_type must be home/away/neutral")
    return df.sort_values("date").reset_index(drop=True)


def _score(result: str) -> float:
    return {"india": 1.0, "draw": 0.5, "opponent": 0.0}[result]


def build_features(df: pd.DataFrame, fmt: str) -> pd.DataFrame:
    cfg: FormatConfig = get_format(fmt)
    df = validate(df)
    elo: dict[str, float] = {}
    india_elo = 1500.0
    scores: list[float] = []
    h2h: dict[str, list[float]] = {}
    draws: list[int] = []
    rows = []
    for r in df.itertuples(index=False):
        opp_elo = elo.get(r.opponent, 1500.0)
        adv = {"home": cfg.home_adv, "away": -cfg.home_adv, "neutral": 0.0}[r.venue_type]
        recent = scores[-cfg.form_window:]
        past_h2h = h2h.get(r.opponent, [])
        feat = {
            "date": r.date,
            "opponent": r.opponent,
            "elo_diff": india_elo + adv - opp_elo,
            "form_diff": (np.mean(recent) - 0.5) if recent else 0.0,
            "h2h_win_rate": np.mean(past_h2h) if past_h2h else 0.5,
            "home_flag": float(r.venue_type == "home"),
            "neutral_flag": float(r.venue_type == "neutral"),
            "toss_won": float(r.toss_won),
            "draw_tendency": float(np.mean(draws[-cfg.form_window:])) if draws else 0.0,
        }
        for c in STAT_COLS:
            feat[c] = float(getattr(r, c, 0.0) or 0.0)
        feat["result"] = r.result
        rows.append(feat)
        # update state AFTER the row is emitted (no leakage)
        s = _score(r.result)
        exp = 1 / (1 + 10 ** (-(india_elo + adv - opp_elo) / 400))
        india_elo += cfg.elo_k * (s - exp)
        elo[r.opponent] = opp_elo - cfg.elo_k * (s - exp)
        scores.append(s)
        h2h.setdefault(r.opponent, []).append(s)
        draws.append(int(r.result == "draw"))
    out = pd.DataFrame(rows)
    return out[["date", "opponent", *cfg.features, "result"]]
