import pandas as pd
import pytest

from src.sports.cricket.config import FORMATS, get_format
from src.sports.cricket.demo_data import make_history
from src.sports.cricket.evaluation import walk_forward
from src.sports.cricket.features import build_features, validate
from src.sports.cricket.models import CricketModel


def test_formats_draw_only_in_test():
    assert get_format("test").has_draw and "draw" in get_format("test").outcomes
    for f in ("odi", "t20i"):
        assert not get_format(f).has_draw and "draw" not in get_format(f).outcomes


def test_unknown_format_raises():
    with pytest.raises(KeyError):
        get_format("ipl")


def test_validate_rejects_bad_labels():
    df = make_history("odi").head(5).copy()
    df.loc[0, "result"] = "tie"
    with pytest.raises(ValueError):
        validate(df)


def test_features_have_no_leakage():
    """Changing the final result must not change that match's own features."""
    df = make_history("test").head(30).copy()
    a = build_features(df, "test").iloc[-1]
    df.loc[df.index[-1], "result"] = "opponent" if df.iloc[-1]["result"] != "opponent" else "india"
    b = build_features(df, "test").iloc[-1]
    cols = list(get_format("test").features)
    assert a[cols].tolist() == b[cols].tolist()


@pytest.mark.parametrize("fmt", list(FORMATS))
def test_probabilities_sum_to_one_and_match_outcomes(fmt):
    feats = build_features(make_history(fmt), fmt)
    p = CricketModel(fmt).fit(feats.iloc[:-10]).predict_proba(feats.iloc[-10:])
    assert list(p.columns) == list(get_format(fmt).outcomes)
    assert ((p.sum(axis=1) - 1).abs() < 1e-9).all()


@pytest.mark.parametrize("fmt", list(FORMATS))
def test_walk_forward_metrics(fmt):
    r = walk_forward(build_features(make_history(fmt), fmt), fmt)
    assert 0 <= r["accuracy"] <= 1 and r["brier"] >= 0 and r["log_loss"] >= 0
    assert r["n_evaluated"] > 0
