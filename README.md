# INDIA CRICKET AI

AI-powered match prediction and analytics for the **Indian men's national cricket team** across **Test, ODI and T20I**.
An AI cricket project by **Lokesh Goud**. Predictions are statistical estimates, not guarantees of match outcomes.

Adapted from an existing full-stack MLOps sports-prediction platform (original football version kept as
`docs/README_football_legacy.md`). The dashboard design system, config-driven routing and MLOps layout are preserved.

## Data status (read this first)

The repo includes a Cricsheet-derived historical match dataset for India men's internationals at
`data/processed/cricket/india_internationals.csv`, with raw source archive and provenance manifest. Results, form,
resolved head-to-head and recorded-stadium aggregates are exported from this real dataset and labelled
**HISTORICAL DATA**. Test draws are preserved; unresolved limited-overs ties and no-results do not count as wins.
Player scorecards and upcoming fixtures remain unavailable because the normalized input has no reliable player data
or verified future schedule. Model Performance and Prediction History use **HISTORICAL BACKTEST** records, not
archived pre-match calls. `POST /cricket/predict` can return **MODEL PREDICTION** when a trained artifact and known
history exist, but the dashboard calls it only for future fixtures marked by a verified fixture-feed source. No such
feed is configured yet.

The history preserves unresolved limited-overs ties and no-results with explicit statuses and null result labels.
Rebuild the normalized input with `python scripts/ingest_cricsheet.py`, train/evaluate models with
`python scripts/train_cricket_models.py`, and refresh historical analytics with `python scripts/export_cricket_data.py`.
Trained `.joblib` artifacts are local and git-ignored; the small dashboard metrics export and complete per-format
evaluation ledgers are stored separately.
See `data/raw/cricsheet/README.md` and `docs/PROJECT_LEARNING.md` for provenance, features and limitations.

## Run

```bash
python scripts/ingest_cricsheet.py
python scripts/train_cricket_models.py
python scripts/export_cricket_data.py
uvicorn src.serving.app:app --host 127.0.0.1 --port 8000
# In dashboard/.env.local (server-only): CRICKET_API_URL=http://127.0.0.1:8000
cd dashboard && npm install && npm run dev
```

Routes: `/` (all formats), `/test`, `/odi`, `/t20i`, `/admin` (read-only). Formats come from `dashboard/public/sports_config.json`.

## ML

`src/sports/cricket/`: `features.py` keeps the demo adapter and builds pre-match Cricsheet Elo, form, head-to-head and innings aggregates;
`models.py` uses per-format logistic regression with sigmoid calibration; `evaluation.py` creates chronological
walk-forward metrics; `service.py` trains artifacts and supports `/cricket/predict`. SHAP explains the calibrated
model output when available. Exact kickoff-time proof is unavailable because the source contains match dates only.

Tests: `python -m pytest tests/test_cricket.py`.

Historical data validation: `python -m pytest tests/test_cricket_data.py`.

## Inherited football-era code

`src/ingestion`, `src/models/layer2_simulation`, unrelated `scripts/*`, the Airflow DAG,
CI workflow and Supabase schema still describe the football World Cup pipeline and have **not** been ported to cricket.
