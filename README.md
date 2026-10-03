# INDIA CRICKET AI

AI-powered match prediction and analytics for the **Indian men's national cricket team** across **Test, ODI and T20I**.
An AI cricket project by **Lokesh Goud**. Predictions are statistical estimates, not guarantees of match outcomes.

Adapted from an existing full-stack MLOps sports-prediction platform (original football version kept as
`docs/README_football_legacy.md`). The dashboard design system, config-driven routing and MLOps layout are preserved.

## Data status (read this first)

No real cricket dataset ships in this repo. All numbers on the site are **DEMO DATA**: a seeded synthetic history
(`src/sports/cricket/demo_data.py`) run through the real feature/model/evaluation code. Fixtures are placeholders,
players are `Demo Player N`, and the prediction ledger is **not** proof of pre-match prediction
(`verified_pre_match = false`). Labels used everywhere: `LIVE DATA`, `HISTORICAL DATA`, `DEMO DATA`.
To go real, replace `make_history` with a loader (e.g. Cricsheet ball-by-ball, check its licence) that returns the
same columns; nothing downstream changes. No API keys are needed to run locally.

## Run

```bash
python scripts/export_cricket_data.py   # regenerates dashboard/data/cricket/*.json
cd dashboard && npm install && npm run dev
```

Routes: `/` (all formats), `/test`, `/odi`, `/t20i`, `/admin` (read-only). Formats come from `dashboard/public/sports_config.json`.

## ML

`src/sports/cricket/`: `config.py` (per-format settings; Test is 3-way with draw, ODI/T20I 2-way), `features.py`
(leak-free Elo, form, head-to-head, venue, toss, format-specific stats), `models.py` (logistic regression with sigmoid
calibration; XGBoost optional), `evaluation.py` (walk-forward accuracy, Brier, log loss, confusion matrix, calibration).
Explainability is a logistic-coefficient surrogate, **not SHAP** yet.

Tests: `python -m pytest tests/test_cricket.py`.

## Inherited football-era code

`src/ingestion`, `src/models/layer2_simulation`, `scripts/*` (except `export_cricket_data.py`), the Airflow DAG,
CI workflow and Supabase schema still describe the football World Cup pipeline and have **not** been ported to cricket.
