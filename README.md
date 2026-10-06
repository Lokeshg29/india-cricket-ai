# INDIA CRICKET AI

AI-powered match prediction and analytics for the **Indian men's national cricket team** across **Test, ODI and T20I**.
An AI cricket project by **Lokesh Goud**. Predictions are statistical estimates, not guarantees of match outcomes.

Adapted from an existing full-stack MLOps sports-prediction platform (original football version kept as
`docs/README_football_legacy.md`). The dashboard design system, config-driven routing and MLOps layout are preserved.

## Data status (read this first)

The repo includes a Cricsheet-derived historical match dataset for India men's internationals at
`data/processed/cricket/india_internationals.csv`, with raw source archive and provenance manifest. It is not used by
the dashboard or current model pipeline. All numbers on the site are still **DEMO DATA**: a seeded synthetic history
(`src/sports/cricket/demo_data.py`) run through the real feature/model/evaluation code. Fixtures are placeholders,
players are `Demo Player N`, and the prediction ledger is **not** proof of pre-match prediction
(`verified_pre_match = false`). Labels used everywhere: `LIVE DATA`, `HISTORICAL DATA`, `DEMO DATA`.
The historical table preserves unresolved limited-overs ties and no-results with explicit statuses and null result
labels. It is not a compatible input to the current feature builder yet: venue/home-away enrichment and an explicit
target/feature adapter are future work. Rebuild it from `data/raw/cricsheet/india_male_json.zip` with
`python scripts/ingest_cricsheet.py`. See `data/raw/cricsheet/README.md` and `docs/PROJECT_LEARNING.md` for provenance
and schema details. No API keys are needed to run locally.

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

Historical data validation: `python -m pytest tests/test_cricket_data.py`.

## Inherited football-era code

`src/ingestion`, `src/models/layer2_simulation`, `scripts/*` (except `export_cricket_data.py`), the Airflow DAG,
CI workflow and Supabase schema still describe the football World Cup pipeline and have **not** been ported to cricket.
