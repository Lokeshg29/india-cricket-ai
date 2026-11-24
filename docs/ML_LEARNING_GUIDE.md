# India Cricket Analytics: Machine Learning Learning Guide

This guide follows the code and data currently in this repository. It distinguishes the India cricket model from the older football/WC26 system that still shares some backend files and Python dependencies. “Current artifacts” means files present in the inspected workspace; it does not prove that a separately deployed server has those same files.

## 1. Project overview

India Cricket Analytics turns historical India men's international match records into team-level summaries, historical model evaluations, and (when the required fixture and model are usable) format-specific probability estimates. The three supported formats are Test, ODI, and T20I. Test has three outcomes—India win, draw, and opponent win. ODI and T20I have India win and opponent win.

The cricket workflow has these main parts:

- **Historical data:** a Cricsheet JSON archive is normalized into a match-level CSV.
- **Features and models:** prior match history is converted into pre-match team features. One calibrated logistic-regression model is trained per format.
- **Evaluation:** expanding chronological folds produce a historical backtest ledger and metrics.
- **Serving:** FastAPI loads the format artifact and computes probabilities for an eligible fixture.
- **Dashboard:** Next.js displays Cricsheet aggregates, verified fixture cards, model predictions, and stored prediction history.
- **Optional persistence:** Supabase stores fixture prediction events and later verified actual results. It is not part of fitting the model.

The repository also retains a different football/WC26 system. Its `/predict`, `/explain`, and `/champions` endpoints, XGBoost stack, MLflow integration, and tournament simulation should not be mistaken for the cricket model described here.

## 2. Technology stack actually found

### Python and machine learning

- **Python:** the serving Docker image starts from Python 3.10. The runtime version used for every local training run is not established by that Dockerfile.
- **pandas:** reads the normalized CSV and builds match tables and feature frames.
- **NumPy:** numeric feature arrays, probability calculations, and Brier score calculations.
- **scikit-learn:** `StandardScaler`, `LogisticRegression`, `CalibratedClassifierCV`, and evaluation metrics.
- **joblib:** serializes and loads each cricket model artifact.
- **SHAP:** the cricket model tries a `PermutationExplainer` over the model's predicted probabilities. Explanations fail gracefully and are optional at serving time.
- **XGBoost:** installed and used by the legacy football ensemble. `CricketModel` has an optional XGBoost backend, but the cricket training script does not request it; the saved cricket metadata says logistic regression.
- **MLflow:** installed and used by the legacy football/WC26 model tracking and registry code. Cricket artifacts in `src/sports/cricket/service.py` are written with joblib; the current cricket trainer does not register them in MLflow.
- **Optuna, Evidently, matplotlib:** present in the requirements for other tuning/monitoring/reporting workflows. Their use in the current cricket training and inference path was not verified.
- **pytest:** tests cover the cricket data, features, evaluation, endpoints, and persistence behavior. Some model tests use synthetic demo data; others use the actual normalized Cricsheet file.

### Web service, dashboard, and storage

- **FastAPI and Pydantic:** HTTP endpoints and request parsing in `src/serving/app.py`.
- **Uvicorn:** ASGI server command in the serving Dockerfile and deployment configuration.
- **Next.js, React, TypeScript:** dashboard pages and server-side API routes under `dashboard/src`.
- **Tailwind CSS and Recharts:** dashboard styling and chart components. Framer Motion and `date-fns` are installed; their role in the cricket model itself is none.
- **CSV and JSON:** normalized historical data, manifests, model metadata, evaluation exports, registry entries, and dashboard data snapshots.
- **Supabase/Postgres:** optional persistence for cricket prediction events and verified result fields. The schema is in `supabase/schema.sql`.
- **Docker:** a serving image and compose files exist. `render.yaml` and Kubernetes files are retained from the WC26 stack; their presence does not verify a live deployment of the cricket path.

Exact pinned Python packages are listed in `requirements.txt` and `requirements-lock.txt`; frontend dependencies are listed in `dashboard/package.json` and `dashboard/package-lock.json`.

## 3. End-to-end architecture

```mermaid
flowchart TD
    A[Cricsheet India men's JSON archive] --> B[scripts/ingest_cricsheet.py]
    B --> C[Normalized CSV and manifest]
    C --> D[load_historical_matches]
    D --> E[build_historical_features]
    E --> F[walk_forward_historical]
    E --> G[One final model per format]
    G --> H[models/cricket/{test,odi,t20i}.joblib]
    F --> I[Evaluation JSON and historical backtest ledger]
    I --> J[Dashboard JSON exports]
    C --> K[CricketPredictionService history]
    L[Verified fixture registry] --> M[FastAPI fixture endpoint]
    M --> N[Next.js server fixture proxy]
    N --> O[Dashboard fixture card]
    O --> P[Next.js prediction proxy]
    P --> Q[FastAPI verified-fixture prediction endpoint]
    K --> Q
    H --> Q
    Q --> R[Probabilities and optional SHAP explanation]
    Q --> S[Optional Supabase prediction event]
    S --> T[FastAPI history endpoint]
    T --> U[Next.js history proxy and dashboard]
    V[Verified completed-match result] --> S
```

The stages in code are:

1. `scripts/ingest_cricsheet.py` calls `load_cricsheet_archive` and `write_processed_dataset` in `src/sports/cricket/data.py`.
2. `src/sports/cricket/features.py` loads the CSV and produces lagged historical feature rows.
3. `scripts/train_cricket_models.py` calls `train_cricket_models` in `src/sports/cricket/service.py`. For each format it evaluates chronological folds, fits the final model on the resolved training rows, and writes a joblib artifact plus JSON metadata.
4. `src/sports/cricket/service.py:CricketPredictionService` loads one artifact by format and creates a feature row from history for a fixture.
5. For dashboard predictions, `dashboard/src/components/cricket/PredictionCards.tsx` posts a fixture ID and format to `dashboard/src/app/api/cricket/predict/route.ts`. That route validates the fixture against `dashboard/src/lib/server-fixtures.ts` and calls FastAPI's `/cricket/fixtures/{fixture_id}/predict` endpoint. FastAPI selects the matching cricket artifact and returns probabilities.
6. The FastAPI fixture prediction endpoint attempts to append the estimate to Supabase. The dashboard separately loads history through `dashboard/src/app/api/cricket/predictions/history/route.ts` and `StoredPredictionHistory.tsx`.
7. Historical evaluation is a separate export, labelled `HISTORICAL BACKTEST`. It is not inserted into the live prediction-history table and is not a record of a real prediction made before kickoff.

There is also a direct FastAPI `/cricket/predict` endpoint accepting a format and opponent without requiring a registry fixture ID. The dashboard's card flow uses the stricter fixture-ID endpoint. A direct API response for a hypothetical opponent/date is not evidence that a real fixture exists.

## 4. Data and dataset

### Source and observed size

The source is the archive `data/raw/cricsheet/india_male_json.zip`, documented as the Cricsheet India men's JSON archive. Its provenance is recorded in `data/processed/cricket/manifest.json` and `data/raw/cricsheet/README.md`.

The checked-in manifest reports:

- 1,021 source JSON matches included, with dates from 2001-12-19 through 2026-08-23.
- 219 Tests, 526 ODIs, and 276 T20Is.
- Test results: 105 India wins, 54 draws, and 60 opponent wins.
- ODI results: 313 India wins, 184 opponent wins, 23 no-results, and 6 ties.
- T20I results: 188 India wins, 81 opponent wins, 6 no-results, and 1 tie.

ODI and T20I no-results and ties remain represented as match statuses, but do not become a class in the supervised win/loss model. Test draws remain a real target class. The model training row counts in artifact metadata are 219 Test, 497 ODI, and 269 T20I. The last two are lower than match counts because ties/no-results have no resolved target.

The dashboard exporter `scripts/export_cricket_data.py:_format_export` computes match results, form, head-to-head, and venue aggregates from the normalized file. It does not derive player statistics from the innings summaries. IPL and other domestic matches are excluded by the importer’s explicit `gender == male`, `team_type == international`, and India-exactly-once filters.

### Cleaning and normalization

`src/sports/cricket/data.py:normalize_cricsheet_match` and `load_cricsheet_archive` do the following:

- Read JSON members from the ZIP without extracting the archive.
- Reject or exclude non-men's, non-international, or non-India matches.
- Map `Test` to `TEST`, `ODI` to `ODI`, and international `T20`/`IT20` to `T20I`. A domestic T20 record is not relabelled as T20I.
- Normalize dates, team names, India’s opponent, toss fields, venue fields, and outcomes.
- Summarize each innings into batting team, runs, wickets, legal deliveries, declaration/forfeit/super-over flags, and target fields. Wides and no-balls are not counted as legal deliveries. Penalty runs are added to runs.
- Map a Test draw to `DRAW`; a tie or abandoned/no-result match has no win/loss target. A limited-overs draw is rejected as an invalid result representation.
- Validate match IDs, duplicate match identities, team membership, winner/result consistency, statuses, toss data, innings values, and source labels.
- Write a deterministic match-level CSV plus a manifest with archive hash, data version, format counts, result counts, and exclusions.

The target labels are `india`, `draw`, and `opponent` internally. `load_historical_matches` maps the normalized CSV values `INDIA_WIN`, `DRAW`, and `OPPONENT_WIN` to those labels. Rows with unresolved outcomes are not used to fit the classifier.

## 5. Feature engineering

The actual production feature builder is `src/sports/cricket/features.py:build_historical_features`; its format-specific names are declared in `HISTORY_FEATURES`. It operates on match-level team history, not player data. Every current feature row is created before the current match updates the rolling state. All matches on the same date receive the same state from before that date because Cricsheet does not provide a trusted kickoff ordering for this purpose.

The feature window is 8 prior matches for Test and 10 for ODI/T20I (`FormatConfig.form_window` in `src/sports/cricket/config.py`). Elo history and head-to-head history are not truncated to this window.

| Feature(s) | Cricket meaning and calculation in the code | Available before a fixture? |
|---|---|---|
| `india_elo_pre`, `opponent_elo_pre` | Running team strength ratings, initialized at 1500. After a resolved prior match, expected score is logistic in the rating difference; India’s rating changes by `24 * (actual score - expected score)` and the opponent changes oppositely. A win scores 1, a draw 0.5, a loss 0. | Yes, from earlier resolved India matches. Opponent ratings are based on this India-only archive, not the opponent’s complete international history. |
| `elo_diff` | India pre-match rating minus opponent pre-match rating. | Yes. |
| `india_recent_win_rate` | Mean of the last 8/10 binary values that equal 1 for an India win and 0 for an India non-win. A draw therefore counts as non-win for this feature. Defaults to 0.5 when there is no prior result. | Yes. |
| `h2h_india_win_rate` | Mean of prior India-win indicators against this opponent; draws and losses are 0. Defaults to 0.5 without prior head-to-head games. | Yes. |
| `h2h_matches_before` | Number of prior resolved head-to-head results against this opponent. | Yes. |
| `draw_tendency` (Test) | Fraction of recent prior resolved matches that were draws; defaults to 0.0. | Yes, using earlier matches only. |
| `india_batting_average`, `opponent_batting_average` | Recent mean of match-level team runs divided by wickets lost; if there are no wickets, the code uses runs as the denominator fallback value. It is not a player batting average. | Yes, when earlier match innings summaries exist. Opponent values come from that opponent’s prior India matches. |
| `india_bowling_average`, `opponent_bowling_average` (Test) | Recent mean of runs conceded divided by bowling wickets; when there are no wickets, conceded runs are used as the fallback. | Yes, from earlier innings summaries. |
| `india_first_innings_runs`, `opponent_first_innings_runs` (Test) | Recent mean of runs in the team’s first batting innings in each prior match. | Yes. |
| `india_run_rate`, `opponent_run_rate` (ODI/T20I) | Recent mean of match-level runs times 6 divided by legal deliveries. Zero if no legal deliveries are present. | Yes. |
| `india_bowling_economy`, `opponent_bowling_economy` (ODI/T20I) | Recent mean of runs conceded times 6 divided by legal deliveries bowled. Zero if no legal deliveries are present. | Yes. |
| `india_wickets_lost`, `opponent_wickets_lost` (ODI/T20I) | Recent mean of wickets lost while batting, summed from innings summaries. | Yes. |
| `india_bowling_wickets`, `opponent_bowling_wickets` (ODI/T20I) | Recent mean of wickets taken while bowling, summed from opponents’ innings summaries. | Yes. |

At fixture prediction time, `features_for_fixture` copies a previous same-format match row to construct a result-free candidate. It sets the requested opponent and date, clears the target and innings, and reruns the lagged builder. `CricketPredictionService.predict_fixture` also requires the fixture date to be after the artifact's training range and at least three resolved prior head-to-head results in that format. The feature vector does **not** include future toss, actual venue conditions, playing XI, injuries, weather, pitch, live score, or opponent-wide form.

### Leakage checks and cautions

The current historical builder avoids using a match’s own result or innings totals to predict that same match: it emits features, then updates ratings/history. This is tested in `tests/test_cricket_phase3.py`. The evaluator sorts chronologically and trains each outer fold only on earlier labelled rows.

Two qualifications matter in an interview:

1. `CalibratedClassifierCV` is given an integer `cv` in `CricketModel.fit`. Scikit-learn's default classifier folds are stratified, not time-aware. The outer walk-forward test rows remain later than all rows in that fold’s training partition, but calibration within the past-only training window is not itself a chronological simulation. This is a limitation to improve if strict temporal calibration is required.
2. The older `build_features` function uses caller-supplied `toss_won`, venue flags, and optional match-stat columns. It is not the feature builder used by `train_cricket_models`. If that older function is reused with values only known after the match begins or ends, it could introduce leakage. The actual historical feature names from `HISTORY_FEATURES` contain neither toss nor venue.

Other limits: same-date matches share pre-date state; the source has limited India-only opponent history; scorecard summaries cannot support batter/bowler-level claims; and features may be stale when the source archive is not refreshed.

## 6. ML model explained simply

### The model actually trained

`src/sports/cricket/models.py:CricketModel` defaults to a scikit-learn pipeline:

1. `StandardScaler` puts numeric features on comparable scales by subtracting the training mean and dividing by the training standard deviation.
2. `LogisticRegression(max_iter=500, C=0.5)` learns weights that map the feature row to class probabilities. Despite its name, logistic regression is used for classification here.
3. When the smallest class has at least two examples, `CalibratedClassifierCV(method="sigmoid", cv=...)` calibrates the probabilities. In the current saved artifacts, each outcome has enough observations for the configured calibration path.

This is three models, one per format, with different feature lists and class counts. They use the same model-family and calibration strategy but are fitted separately. Test is three-class; ODI/T20I are binary. The training script’s `CricketModel(...)` calls do not set `backend`, so they use logistic regression. The saved metadata files independently identify all three as `StandardScaler + LogisticRegression + sigmoid calibration`.

The source has an optional `backend="xgboost"` path in `CricketModel`, but the standard cricket training script never selects it and the current metadata does not describe XGBoost artifacts. The separate football stack in `src/models/layer1_ensemble/ensemble.py` does use XGBoost and is a different model.

The model receives one numeric pre-match feature row for its format. It returns a probability for each legal outcome class; `predict_proba` explicitly orders columns using the format configuration and normalizes them to sum to 1. `predict_fixture` chooses the largest probability as the predicted class, but the full probability distribution is the more informative result.

**Illustrative example only — not a project prediction:** suppose a hypothetical Test model output is India `0.52`, draw `0.28`, opponent `0.20`. Those numbers sum to 1. The model's most likely class is India win, but it still assigns probability to a draw or opponent win. This example is not pulled from a fixture, artifact output, or saved evaluation record.

The code defaults to this relatively compact model family. The repository does not document a controlled comparison showing it beat XGBoost or another baseline. Therefore, describe logistic regression as the implemented baseline/current choice; do not claim it was proven to be the best algorithm.

## 7. Training pipeline and artifact loading

Run path: `scripts/train_cricket_models.py` parses options and invokes `train_cricket_models` in `src/sports/cricket/service.py`.

For each slug `test`, `odi`, and `t20i`, the function:

1. Reads the normalized CSV through `load_historical_matches`.
2. Builds historical lagged features with `build_historical_features`.
3. Calls `walk_forward_historical` (default minimum 60 prior matches, then blocks of 20) to create held-out predictions and evaluation results.
4. Filters to the format’s resolved legal outcome labels. It refuses to fit if a class is absent or has fewer than 3 rows.
5. Fits the final format-specific calibrated estimator using all eligible resolved rows as the calibration input. Internally, `CalibratedClassifierCV` fits its base estimators on CV fold subsets rather than one single base estimator trained on every row.
6. Selects up to the last 40 training feature rows as the SHAP explanation background.
7. Saves a dictionary containing the model, background frame, and metadata to `models/cricket/{slug}.joblib`, and writes `{slug}.metadata.json`.
8. Writes full format evaluations under `data/processed/cricket/evaluations/` and a compact dashboard export to `dashboard/data/cricket/historical_evaluation.json`.

Metadata records format, model type/version, feature version, training timestamp, source, training date range, training row count, feature names, evaluation metrics, and evaluation status/time. The current local workspace contains all three `.joblib` artifacts and metadata files. Their metadata says they were trained on 2026-10-07. Per-format training range ends are Test 2026-08-23, ODI 2026-07-19, and T20I 2026-07-26. This confirms local artifact presence, but does not establish that an independently deployed API uses the same files.

At inference, `CricketPredictionService._load` lazily loads and caches `{slug}.joblib` with `joblib.load`. A missing artifact raises a clear unavailable error. `predict_fixture` checks the date against the artifact's last training date and requires known opponent history before calculating a feature row and calling `predict_match`.

`src/serving/app.py` also calls `load_dotenv()` for the backend process. The dashboard’s FastAPI base URL is read server-side from `CRICKET_API_URL` in `dashboard/src/lib/server-fixtures.ts` and the prediction route. No secrets need to be included in this guide.

## 8. Evaluation: what the saved numbers mean

`src/sports/cricket/evaluation.py:walk_forward_historical` sorts matches by date and match ID, keeps rows with valid labels, and moves through expanding chronological folds. It starts with 60 training examples by default and predicts the next 20, then grows the training history and repeats. A fold is skipped until every outcome class has at least three observations in its training set. The saved ledger marks these records `HISTORICAL BACKTEST`, has `prediction_timestamp: null`, and sets `verified_pre_match: false` because Cricsheet match dates do not prove a call was made before kickoff.

The values below are in `data/processed/cricket/evaluations/{test,odi,t20i}.json` and the metadata/dashboard export. They are historical, out-of-sample predictions from the saved expanding-window evaluation, not live forecasts. They were generated on 2026-10-07 for the artifacts inspected.

| Format | Resolved rows supplied to final fit | Training range | Held-out rows | Accuracy | Precision | Recall | F1 / Macro F1 | Log loss | Brier |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Test | 219 | 2001-12-19 to 2026-08-23 | 159 | 0.4403 | Not reported | Not reported | Macro F1 0.3050 | 1.2160 | 0.6419 |
| ODI | 497 | 2002-06-29 to 2026-07-19 | 437 | 0.6339 | 0.6493 | 0.9321 | F1 0.7654; macro F1 0.4660 | 0.6634 | 0.4704 |
| T20I | 269 | 2006-12-01 to 2026-07-26 | 209 | 0.7225 | 0.7363 | 0.9673 | F1 0.8362; macro F1 0.4650 | 0.6156 | 0.4235 |

Interpretation:

- **Accuracy:** share of held-out labels predicted correctly.
- **Precision:** among predictions called India wins, share that were India wins (binary formats only in the saved metric output).
- **Recall:** among actual India wins, share detected by the model.
- **F1:** harmonic mean of precision and recall. **Macro F1** computes F1 per class and averages equally, so a frequent class cannot dominate as much.
- **Log loss:** penalizes assigning very low probability to the actual class; lower is better.
- **Multiclass Brier score:** mean squared difference between the probability vector and the one-hot actual outcome; lower is better.
- **Calibration bins:** the export groups each prediction by its top-class confidence and compares average confidence with the observed correctness rate. These bins are small and noisy; they are not a guarantee that future predictions will calibrate.

Test precision/recall/F1 are null in this output; the code reports macro F1 for the three-class case. ODI/T20I have high India-win recall but low macro F1 in the saved results. This is consistent with the outcome imbalance visible in the dataset. The repository does not save a verified majority-class or Elo-only baseline comparison for this cricket evaluation, so these scores alone do not establish improvement over a simpler benchmark.

## 9. Prediction walkthrough: dashboard to model response

Here is the actual dashboard flow for one eligible fixture:

1. A server-rendered page calls `getFixtureFeed()` from `dashboard/src/lib/server-fixtures.ts`. It calls FastAPI `GET /cricket/fixtures`, then filters for a future timezone-aware start, scheduled status, verified-registry source/label, `verification_status`, source URL, and verification timestamp. The proxy caches the upstream response for one hour.
2. `PredictionCards` shows eligible fixture cards. Its browser effect sends only `format` and `match_id` to the same-origin Next route `/api/cricket/predict`.
3. `dashboard/src/app/api/cricket/predict/route.ts:POST` validates JSON, looks up the match ID in the server-fetched feed, checks that the format agrees and the date is still future, then calls FastAPI `/cricket/fixtures/{fixture_id}/predict`. It does not trust a browser-supplied opponent or probability.
4. `src/serving/app.py:predict_verified_cricket_fixture` verifies the fixture ID against the provider feed again. It converts the scheduled start to a date and calls `CricketPredictionService.predict_fixture(format, opponent, date)`.
5. The service loads the selected format artifact, checks the training cutoff and prior opponent history, builds pre-match features, and calls the fitted classifier. The model returns probabilities, the predicted class, version, UTC prediction timestamp, and `MODEL PREDICTION` label. SHAP may return factors; if explanation fails, the probability response remains available with explanation unavailable.
6. FastAPI validates class names and probability constraints. It tries to insert a prediction event into Supabase and reports `history_status` separately so a storage failure does not imply that the model prediction itself failed.
7. `PredictionCards` accepts only a valid response with the expected outcome classes and a sum near 1. It renders probabilities with the model version. `StoredPredictionHistory` calls the Next history proxy and labels those records as model predictions. The historical walk-forward ledger remains under its own backtest heading.

Important current-state note: `data/cricket/verified_fixtures.json` contains seven registry entries (five ODIs and two Tests) with a seven-day verification freshness limit. Their recorded verification timestamp is 2026-10-17. As of 2026-10-29, the backend validator considers them stale and excludes them from the eligible feed. The registry records are real claims sourced in project documentation; their current eligibility is expired until reverified. This means current model artifacts can exist while the dashboard correctly has no eligible fixture to predict.

## 10. What the main ML libraries do here

| Library/tool | Verified role in this project | Cricket path? |
|---|---|---|
| pandas | CSV ingestion, match sorting/grouping, lagged feature tables, DataFrame model inputs. | Yes. |
| NumPy | Converts model frames to arrays, handles expected values and probability/error calculations. | Yes. |
| scikit-learn | Scales inputs, fits logistic regression, calibrates probabilities, and computes evaluation metrics. | Yes; core predictor. |
| XGBoost | Tree boosting. There is an optional cricket backend, but standard cricket training does not select it. The WC26 football ensemble and tuning script do use it. | Installed; optional unused-by-default for cricket. |
| SHAP | Cricket `PermutationExplainer` explains how features shift a calibrated class probability relative to a background set. | Yes, optional at inference. |
| MLflow | Tracking/model registry utilities for the separate WC26 football stack. Cricket training writes joblib artifacts and JSON metadata instead. | Not used by the verified cricket train/load path. |
| joblib | Saves and loads the per-format cricket artifact bundle. | Yes. |
| FastAPI / Uvicorn | Exposes HTTP routes and runs the Python API. | Yes. |
| Supabase client | Best-effort storage/retrieval of timestamped cricket prediction events and separately verified actual results. | Optional serving/history path; not training. |

Installed does not mean used by every workflow. The cricket path’s actual model type is established by the trainer code and saved metadata, not by the complete requirements list.

## 11. Model limitations and risks

- A probability is a model estimate from historical patterns. It is not a guaranteed outcome or necessarily a well-calibrated probability for a future tournament or opponent.
- The archive is India-centric. Opponent features are derived from that opponent’s matches against India, not its complete record against all teams.
- The class frequencies are unequal. A high accuracy or India-win recall can hide poor minority-class recognition; macro F1, confusion matrices, and class probabilities should also be inspected.
- The saved Test backtest is weak on the three-way outcome task: accuracy is 0.440 and macro F1 is 0.305 in the inspected export. Test draw prediction is supported as a class, but performance is not strong evidence of dependable forecasts.
- No cricket baseline comparison, confidence interval, or external test season has been saved. Do not describe these scores as beating experts, betting markets, or a naive model.
- Calibration is applied through `CalibratedClassifierCV`, but its internal folds are not chronological. Outer test folds are chronological; the probability calibration process can be made more time-faithful.
- Venue, toss, weather, pitch, lineup, injuries, and live conditions are absent from the production historical feature list. The model cannot adjust for those match-specific facts.
- Same-date historical games receive the same prior state because date-only data cannot reliably order them.
- Results/history may be stale if the Cricsheet archive is not updated and the models are not retrained. Metadata indicates training timestamp 2026-10-07; the training data ends on 2026-08-23 for Test, 2026-07-19 for ODI, and 2026-07-26 for T20I.
- SHAP is optional and computationally more expensive than just returning probabilities. It can fail without failing the prediction.
- The dashboard only predicts validated future registry fixtures; the verified registry is currently stale under its configured freshness rule. An artifact by itself does not create a schedule.
- Supabase persistence is optional and uses configuration loaded server-side. A prediction can be returned while history storage is unavailable; the response distinguishes these states.
- Backtest records are not archived live predictions. `prediction_timestamp` is null and `verified_pre_match` is false; their actual historical result is used to score the retrospective estimate.

## 12. Interview preparation

### Two-minute project explanation

“I built an India men's international cricket analytics workflow around Cricsheet match data. An ingestion step validates the men's/international/team/format fields and normalizes the archive into a match-level CSV with innings summaries and clean result labels. A shared chronological feature builder computes ratings, recent form, head-to-head rates, and format-specific team statistics strictly from earlier matches. I train separate calibrated scikit-learn logistic-regression classifiers for Test, ODI, and T20I; Test predicts India win, draw, or opponent win, while limited-overs formats are binary. The evaluator uses expanding chronological windows and saves held-out probabilities, confusion matrices, calibration bins, log loss, Brier score, and other metrics as a historical backtest. FastAPI loads a joblib artifact by format and serves a prediction only after a fixture is validated; Next.js proxies that request and labels it as a model estimate. Supabase can store timestamped prediction events and separately verified actual results. The current artifacts and evaluations are real, but the model is a baseline with limited India-only features, no saved benchmark comparison, and a stale fixture registry currently prevents fixture-level live estimates.”

### Resume-friendly description

> Built a Cricsheet-based India men's cricket analytics pipeline that normalizes 1,021 international matches, engineers lagged team features, trains separate sigmoid-calibrated logistic-regression models for Test/ODI/T20I, evaluates them with expanding chronological backtests, and serves fixture-gated probability estimates through FastAPI and Next.js with optional Supabase prediction history.

Use this wording only if you are comfortable explaining that the saved evaluation is an early baseline and current registry freshness may make upcoming predictions unavailable.

### Interview questions and beginner-friendly answers

1. **What problem does the project solve?** It turns historical India match records into repeatable team analytics and probability estimates for a verified future fixture.
2. **Where does the training data come from?** The checked-in archive is Cricsheet's India men's JSON archive, normalized by `src/sports/cricket/data.py`.
3. **Why are IPL matches excluded?** The intended population is India men's international cricket; the importer requires `team_type` to be `international` before mapping formats.
4. **What is the target variable?** A match outcome label: `india`, `opponent`, and `draw` for Tests; `india` or `opponent` for ODI/T20I.
5. **Why does Test have a draw class?** A Test can finish without either side winning, and the source records true draws. Treating them as losses would make the target inaccurate.
6. **What happens to ODI/T20I ties and no-results?** They remain unresolved statuses and do not become supervised win/loss training labels.
7. **What model is actually trained?** The standard pipeline fits one `StandardScaler` + `LogisticRegression` model wrapped in sigmoid probability calibration per format.
8. **Why use three models?** Format rules, scoring patterns, and outcomes differ; the code assigns different feature sets and Test has an additional draw class.
9. **Does the project train XGBoost for cricket?** Not in the standard training script. An optional backend exists, but current cricket metadata says logistic regression. XGBoost is used in the separate football stack.
10. **What does logistic regression do?** It learns weights for input features and converts a weighted score into class probabilities. It is a classification algorithm despite the word “regression.”
11. **Why scale the features?** Elo values and rates have different numeric ranges. Scaling helps the linear optimizer treat feature magnitudes consistently.
12. **What is probability calibration?** It adjusts model confidence so predictions assigned similar probabilities can better match observed frequencies. Here it uses scikit-learn's sigmoid calibration.
13. **What features are used?** Prior Elo, recent India win rate, prior head-to-head rate/count, and recent team-level innings statistics; Test includes draw tendency and Test stats.
14. **Are toss and venue inputs used by the current model?** No. The production `HISTORY_FEATURES` used by `train_cricket_models` omit them. An older feature builder has such fields, but it is not the current historical trainer.
15. **How do you avoid using the match result to predict itself?** `build_historical_features` emits a row before it updates ratings and rolling statistics with that match.
16. **How do you split training and testing?** `walk_forward_historical` sorts chronologically, trains on earlier rows, and predicts later blocks in an expanding window.
17. **What does expanding window mean?** Each evaluation round adds older observed matches to the training set while the test block moves forward in time.
18. **Why not randomly shuffle the matches?** A random split could let later seasons influence predictions for earlier matches and misrepresent forecasting use.
19. **Is there any leakage left?** The outer evaluation uses only past rows for later test blocks, but the sigmoid calibrator's internal CV is stratified rather than chronological. That is a limitation to disclose and improve.
20. **What is accuracy?** The fraction of predicted classes equal to the actual class. It does not show which class is missed.
21. **Why report macro F1?** It gives each outcome class equal weight and helps reveal poor performance on less common outcomes.
22. **What does log loss measure?** It penalizes confidently wrong probability assignments, not just a wrong top label. Lower values are better.
23. **What is the Brier score?** The average squared difference between the probability assigned to each class and the one-hot actual outcome. Lower is better.
24. **What do the saved metrics say?** The inspected Test/ODI/T20I backtests have 159/437/209 rows and accuracies 0.440/0.634/0.722. These are baseline measurements, not guarantees.
25. **Does this prove the model beats a baseline?** No. The repository does not save a cricket majority-class, Elo-only, or market benchmark comparison for these outputs.
26. **What is overfitting?** A model learns quirks in training data that do not generalize. Chronological holdouts help test generalization, but limited seasons/classes and no external test set leave risk.
27. **What does SHAP do here?** The optional permutation explainer measures how changing features shifts a model's predicted class probability relative to a background sample.
28. **Does SHAP create or validate the prediction?** No. It explains a prediction from the model; the code keeps the prediction available if the explanation fails.
29. **How are artifacts saved?** The training service saves model, SHAP background rows, and metadata in a compressed joblib bundle per format, plus readable JSON metadata.
30. **How does inference select the model?** `CricketPredictionService._load(fmt)` loads `test.joblib`, `odi.joblib`, or `t20i.joblib` based on the validated format.
31. **How does the dashboard call the model?** Browser code posts a fixture ID and format to a same-origin Next.js route; the server checks the verified fixture and calls FastAPI.
32. **Can the model make an upcoming schedule?** No. It only estimates outcomes after receiving fixture details. Fixture existence and date must come from a verified schedule source or registry.
33. **What is the difference between a prediction and a backtest?** A live prediction is timestamped at request time for an eligible future fixture; a backtest is a retrospective held-out estimate and is labelled separately.
34. **How are actual results kept separate?** The schema stores nullable `actual_outcome` separately; `attach_verified_cricket_result` accepts it only for a finished fixture and does not copy the predicted class.
35. **What does Supabase do?** It optionally stores/retrieves prediction events. It is not the feature store or training database; CSV/JSON history is used for model fitting.
36. **Is MLflow tracking the cricket models?** Not in the verified cricket train/load path. MLflow code belongs to the retained WC26/football stack.
37. **What does an unavailable prediction mean?** The fixture may be missing/stale, the backend may be unreachable, the model artifact may be absent, or the model may lack sufficient prior opponent history. The API returns an unavailable state instead of fake probabilities.
38. **What would you improve next?** Use time-aware calibration, add and compare simple baselines, broaden opponent context, evaluate on a later untouched period, and refresh fixture verification before enabling future predictions.

## 13. Learning roadmap

| Order | Learn | Why it matters here | First project file(s) |
|---|---|---|---|
| 1. Python and data structures | Functions, dictionaries, lists, dataclasses, exceptions, file paths. | The importer and service are ordinary Python modules with explicit schemas. | `src/sports/cricket/data.py`, `src/sports/cricket/service.py` |
| 2. JSON, CSV, and data validation | Parsing, schemas, missing values, duplicate keys, provenance. | Raw Cricsheet JSON is normalized to a validated match-level CSV. | `src/sports/cricket/data.py`, `data/processed/cricket/manifest.json` |
| 3. Cricket outcome definitions | Results, draws, ties, no-results, overs, legal deliveries, innings. | Correct target labels and run rates depend on cricket rules. | `src/sports/cricket/data.py`, `tests/test_cricket_data.py` |
| 4. pandas and NumPy basics | DataFrames, grouping, sorting, arrays, means, rolling windows. | Feature generation, model inputs, and evaluation use both libraries. | `src/sports/cricket/features.py` |
| 5. Feature engineering | Lagged inputs, rolling form, Elo, head-to-head statistics. | These are the model's actual signal sources and leakage boundary. | `src/sports/cricket/features.py`, `src/sports/cricket/config.py` |
| 6. Classification | Labels, multiclass vs binary classification, logistic regression, probability output. | Understand the three separate models and Test draw class. | `src/sports/cricket/models.py` |
| 7. Scaling and regularization | Standardization, coefficient size, `C`, solver behavior. | LogisticRegression runs inside a StandardScaler pipeline; `C=0.5` controls regularization. | `src/sports/cricket/models.py` |
| 8. Probability calibration | Reliability, sigmoid/Platt scaling, calibration data. | The model serves probability distributions, and internal CV affects them. | `src/sports/cricket/models.py`, `src/sports/cricket/evaluation.py` |
| 9. Temporal validation | Expanding windows, cutoff dates, rolling-origin validation. | Sports forecasting must respect time and avoid future information. | `src/sports/cricket/evaluation.py` |
| 10. Classification metrics | Confusion matrices, precision, recall, F1, macro averages. | Outcome imbalance makes accuracy alone misleading. | `src/sports/cricket/evaluation.py`, `data/processed/cricket/evaluations/` |
| 11. Proper probability scores | Log loss, Brier score, calibration bins. | Scores measure probability quality, not only winner picks. | `src/sports/cricket/evaluation.py` |
| 12. Explainability | SHAP, background data, feature attribution limits. | The API can return model-linked feature contributions. | `src/sports/cricket/models.py:CricketModel.explain` |
| 13. Artifact design | Serialization, metadata, versioning, reproducibility. | Format-specific joblib bundles power inference. | `src/sports/cricket/service.py`, `models/cricket/*.metadata.json` |
| 14. API and frontend contracts | HTTP methods, JSON validation, server proxies, timeouts. | The UI verifies a fixture before asking the model. | `src/serving/app.py`, `dashboard/src/app/api/cricket/predict/route.ts` |
| 15. Persistence and event history | Unique keys, append-only records, nullable verified result. | Stored predictions must not be confused with actual outcomes or backtests. | `src/ingestion/supabase_store.py`, `supabase/schema.sql` |
| 16. MLOps and monitoring | Model freshness, drift, service health, deployment configuration. | Installed tools and legacy tracking should be separated from active cricket deployment. | `src/monitoring/`, `src/models/layer1_ensemble/tracking.py`, `render.yaml` |

## 14. Practical exercises

These exercises are designed to be read-only or use temporary files and test mocks. Do not overwrite the checked-in dataset, artifacts, fixture registry, or Supabase records while learning.

1. **Read the provenance:** inspect the manifest and write down source URL, archive hash, date range, and format counts.
2. **Trace one normalized match:** choose a row from the CSV and match its result/team/innings fields back to the normalization code. Do not print environment files.
3. **Check target counts:** write a small read-only pandas snippet to count resolved outcome labels per format and compare them with the manifest.
4. **Inspect feature definitions:** print `HISTORY_FEATURES` and explain why Test differs from ODI/T20I.
5. **Verify lag behavior:** run `tests/test_cricket_phase3.py::test_historical_features_are_lagged_and_exclude_post_match_fields` and describe why changing a match's result does not change its own pre-match feature row.
6. **Test same-day behavior:** run the corresponding same-date test and explain why both matches share prior state.
7. **Hand-calculate a feature:** for a tiny fictional set of past outcomes, compute recent India-win rate and draw tendency by hand. Label it a toy example.
8. **Inspect training metadata:** compare the three JSON metadata files and list their feature counts, training rows, version strings, and training date ranges.
9. **Inspect artifact code without retraining:** read `_load` and identify the expected filename for each format. Avoid overwriting or re-saving artifacts.
10. **Understand metrics:** select one row from an evaluation ledger and verify that its probability keys match the format and that they sum to one.
11. **Interpret a confusion matrix:** identify which actual class is most often predicted incorrectly for ODI and for Test.
12. **Compare accuracy to macro F1:** explain why ODI accuracy can be much higher than macro F1 given its class distribution.
13. **Find calibration caveats:** trace where `cv` is set in `CricketModel.fit`; propose, but do not apply, a time-aware calibration design.
14. **Test the missing-artifact response:** use the existing temporary-directory test in `tests/test_serving.py`; verify it does not return probabilities.
15. **Trace frontend validation:** identify which server route prevents a browser from choosing an arbitrary opponent or fixture ID.
16. **Check registry freshness safely:** use the registry validator with a fixed test clock or test fixture and explain why stale entries should not be predicted.
17. **Separate the ledgers:** compare the historical evaluation JSON with the Supabase event schema. Point out the null prediction timestamp on backtests.
18. **Explain a hypothetical probability row:** use invented round numbers in a notebook or on paper, state clearly that they are illustrative, and show why a 60% estimate can lose.
19. **Build a null baseline in a scratch script:** compute a majority-class predictor only for an isolated chronological evaluation and record its cutoff. Do not compare it to saved model scores unless evaluated over the identical held-out rows.
20. **Write a short model card:** describe intended users, data source/date range, outcomes, metrics, known limitations, and conditions that make inference unavailable.

## Verified facts vs. unknowns

### Verified from repository code, tests, artifacts, or saved exports

- [x] Cricsheet is the historical source; the archive manifest reports 1,021 India men's international matches through 2026-08-23.
- [x] Supported formats are Test, ODI, and T20I; T20I is derived only from international `T20`/`IT20` records.
- [x] Resolved target labels are India, draw (Test only), and opponent; unresolved ties/no-results are excluded from classifier fitting.
- [x] Current standard training fits three separate StandardScaler + LogisticRegression + sigmoid-calibrated classifiers.
- [x] Current workspace contains one `.joblib` artifact and a metadata JSON per format; training timestamps are 2026-10-07, with per-format data ends Test 2026-08-23, ODI 2026-07-19, and T20I 2026-07-26.
- [x] The saved evaluation exports contain 159 Test, 437 ODI, and 209 T20I chronological held-out prediction records with the metrics listed above.
- [x] Cricket explanations use SHAP permutation explanations when available; the API tolerates explanation failure.
- [x] The dashboard has server-side fixture and prediction proxies, plus a separate prediction-history display.
- [x] Prediction events and actual outcomes are separate fields in the Supabase schema; backtests are separately labelled.
- [x] As of 2026-10-29, all seven registry entries exceed their seven-day verification freshness limit, so the registry validator excludes them.

### Unknown or not verified

- [ ] Whether a deployed production API currently has these local artifacts, matching data files, or matching software versions.
- [ ] Whether every locally present model binary can be loaded in a clean environment with the exact pinned dependency set; metadata and file presence were verified, but this guide task did not retrain models or run inference.
- [ ] Whether a future fixture list has been reverified since 2026-10-17; the current registry entries are stale by the configured rule.
- [ ] Whether Supabase credentials/table access are available in a particular runtime. No secret values are inspected here, and no connection is tested.
- [ ] Whether SHAP is available and succeeds for every production prediction; code explicitly supports unavailable explanations.
- [ ] Whether logistic regression is better than XGBoost, Elo-only, majority-class, bookmaker, or expert baselines; no saved controlled cricket benchmark establishes this.
- [ ] Whether the model is well calibrated on future matches, seasons, venues, squads, or opponents outside the archived distribution.
- [ ] Whether the optional XGBoost cricket backend has been used to train any separate artifact; no such artifact is identified by the standard trainer metadata.
- [ ] Whether Render/Kubernetes configuration has been deployed for the current cricket app. Configuration files alone are not deployment evidence.

## Files to read first

1. `src/sports/cricket/config.py` — formats, outcomes, and feature lists.
2. `src/sports/cricket/data.py` — Cricsheet normalization and validation.
3. `src/sports/cricket/features.py` — actual lagged history features and fixture feature construction.
4. `src/sports/cricket/models.py` — classifier, probability calibration, and SHAP explanation.
5. `src/sports/cricket/evaluation.py` — walk-forward folds, ledger, and metrics.
6. `src/sports/cricket/service.py` — training, artifact metadata, loading, and prediction flow.
7. `scripts/ingest_cricsheet.py` and `scripts/train_cricket_models.py` — executable command entry points.
8. `src/serving/app.py` — FastAPI cricket endpoints and the separate legacy endpoints.
9. `dashboard/src/lib/server-fixtures.ts` and `dashboard/src/app/api/cricket/predict/route.ts` — fixture validation and server-side inference proxy.
10. `tests/test_cricket_phase3.py`, `tests/test_serving.py`, and `tests/test_cricket_data.py` — checks for leakage, evaluation, inference, and normalization.
11. `data/processed/cricket/manifest.json`, `models/cricket/*.metadata.json`, and `data/processed/cricket/evaluations/*.json` — provenance, artifact metadata, and saved results.
