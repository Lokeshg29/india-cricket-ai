"""Format configuration for India Cricket AI (Test / ODI / T20I).

One shared feature pipeline; per-format differences live here only.
Test has a draw outcome; ODI/T20I are two-way (India / Opponent).
"""
from __future__ import annotations

from dataclasses import dataclass

from src.core.sport import SportConfig, register

TEAM = "India"
DATA_LABELS = ("LIVE DATA", "HISTORICAL DATA", "DEMO DATA")


@dataclass(frozen=True)
class FormatConfig:
    fmt: str                      # "test" | "odi" | "t20i"
    display: str
    outcomes: tuple[str, ...]     # model outcome classes
    has_draw: bool
    elo_k: float
    home_adv: float               # Elo points
    form_window: int
    features: tuple[str, ...]


COMMON = ("elo_diff", "form_diff", "h2h_win_rate", "home_flag", "neutral_flag", "toss_won")
FORMATS: dict[str, FormatConfig] = {
    "test": FormatConfig(
        "test", "Test", ("india", "draw", "opponent"), True, 20.0, 60.0, 8,
        COMMON + ("bat_avg_diff", "bowl_avg_diff", "draw_tendency"),
    ),
    "odi": FormatConfig(
        "odi", "ODI", ("india", "opponent"), False, 24.0, 45.0, 10,
        COMMON + ("run_rate_diff", "economy_diff", "bowling_depth_diff"),
    ),
    "t20i": FormatConfig(
        "t20i", "T20I", ("india", "opponent"), False, 28.0, 35.0, 10,
        COMMON + ("run_rate_diff", "economy_diff", "powerplay_diff", "death_overs_diff"),
    ),
}


def get_format(fmt: str) -> FormatConfig:
    try:
        return FORMATS[fmt.lower()]
    except KeyError:
        raise KeyError(f"Unknown cricket format {fmt!r}; expected one of {list(FORMATS)}") from None


class _Cricket:
    config = SportConfig(
        sport_id="india_cricket",
        display_name="India Cricket",
        tournament_name="India men's international cricket",
        outcome_labels=("india", "draw", "opponent"),
        checkpoint_labels=tuple(FORMATS),
    )


register(_Cricket())
