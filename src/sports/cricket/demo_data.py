"""DEMO DATA generator. Synthetic, seeded, clearly NOT real match history.
Exists so the dashboard and pipeline run locally with no API keys. Swap in
real data (e.g. Cricsheet ball-by-ball, converted to the same columns) by
replacing `make_history` with a loader -- everything downstream is unchanged.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

OPPONENTS = {  # latent demo strength (NOT a real rating)
    "Australia": 0.35, "England": 0.25, "South Africa": 0.2, "New Zealand": 0.15,
    "Pakistan": 0.1, "Sri Lanka": -0.1, "West Indies": -0.2, "Bangladesh": -0.4,
    "Afghanistan": -0.35,
}
HOME_VENUES = ["Hyderabad", "Delhi", "Mumbai", "Bengaluru", "Chennai", "Kolkata", "Ahmedabad"]
AWAY_VENUES = {"Australia": "Melbourne", "England": "London", "South Africa": "Johannesburg",
               "New Zealand": "Wellington", "Pakistan": "Lahore", "Sri Lanka": "Colombo",
               "West Indies": "Bridgetown", "Bangladesh": "Dhaka", "Afghanistan": "Sharjah"}
SIZE = {"test": 90, "odi": 140, "t20i": 160}
DRAW_BASE = {"test": 0.28, "odi": 0.0, "t20i": 0.0}


def make_history(fmt: str, seed: int = 26) -> pd.DataFrame:
    rng = np.random.default_rng(seed + {'test': 1, 'odi': 2, 't20i': 3}[fmt])
    n = SIZE[fmt]
    dates = pd.date_range("2016-01-01", periods=n, freq="26D") if fmt != "t20i" else \
        pd.date_range("2016-01-01", periods=n, freq="20D")
    names = list(OPPONENTS)
    rows = []
    for d in dates:
        opp = names[rng.integers(len(names))]
        vt = rng.choice(["home", "away", "neutral"], p=[0.45, 0.4, 0.15])
        venue = rng.choice(HOME_VENUES) if vt == "home" else AWAY_VENUES[opp] if vt == "away" else "Dubai"
        edge = 0.1 - OPPONENTS[opp] + {"home": 0.35, "away": -0.2, "neutral": 0.0}[vt]
        p_draw = DRAW_BASE[fmt]
        p_win = (1 - p_draw) / (1 + np.exp(-edge * 1.6))
        u = rng.random()
        res = "india" if u < p_win else ("draw" if u < p_win + p_draw else "opponent")
        s = 1 if res == "india" else -1 if res == "opponent" else 0
        rows.append({
            "date": d, "opponent": opp, "venue": venue, "venue_type": vt,
            "toss_won": int(rng.random() < 0.5), "result": res,
            "bat_avg_diff": rng.normal(2 * s, 6), "bowl_avg_diff": rng.normal(-2 * s, 6),
            "run_rate_diff": rng.normal(0.2 * s, 0.6), "economy_diff": rng.normal(-0.2 * s, 0.6),
            "bowling_depth_diff": rng.normal(0.3 * s, 1.0), "powerplay_diff": rng.normal(0.3 * s, 1.0),
            "death_overs_diff": rng.normal(0.3 * s, 1.0),
        })
    return pd.DataFrame(rows)
