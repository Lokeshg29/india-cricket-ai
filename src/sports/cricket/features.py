"""Shared cricket feature pipeline. Input: chronological match rows
(date, opponent, venue_type, toss_won, result in {india, opponent, draw}
plus optional per-match stat columns). Output: leak-free features -- every
value for a match is computed only from matches strictly before it.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from src.sports.cricket.config import FormatConfig, get_format

REQUIRED = ["date", "opponent", "venue_type", "toss_won", "result"]
STAT_COLS = ["bat_avg_diff", "bowl_avg_diff", "run_rate_diff", "economy_diff",
             "bowling_depth_diff", "powerplay_diff", "death_overs_diff"]


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
