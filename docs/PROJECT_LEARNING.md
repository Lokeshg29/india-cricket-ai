# Phase 1B — Premium UI

## UI technologies

The dashboard uses React 19, Next.js App Router, TypeScript, Tailwind CSS 4, custom CSS, Framer Motion (already installed), and Recharts. This phase added no dependencies.

## Files and structure

Phase 1B updated `dashboard/src/app/page.tsx`, `components/Hero.tsx`, `components/IndiaNightMap.tsx`, `components/Nav.tsx`, `components/cricket/PredictionCards.tsx`, `components/ResultCards.tsx`, `components/cricket/Panels.tsx`, `app/globals.css`, and `lib/site.ts`. These files handle the homepage composition, hero and map, navigation, match/prediction presentation, and shared visual styles. No route data or backend files changed.

The app is composed from shared components: header and format controls, hero, summary strip, match sections, prediction history, analytics, then footer. `dashboard/src/app/page.tsx` composes the homepage; `dashboard/src/components/cricket/FormatPage.tsx` uses shared components for Test, ODI, and T20I routes. The existing `SportTabs` component supplies the format links.

## Concepts to learn

- **React and Next.js:** component composition, props, list rendering, App Router segments, server/client component boundaries, and linking between page sections.
- **TypeScript:** shared data types make the UI consume existing cricket exports without changing their shape.
- **Tailwind and CSS:** responsive breakpoints, custom properties, CSS Grid/Flexbox, pseudo-elements, keyframes, transitions, and `prefers-reduced-motion`.
- **Motion:** the hero uses a short entrance animation; cards and controls use small hover/selection transitions. Reduced-motion preferences disable these effects.
- **Data honesty:** badges and prediction details are rendered from existing export fields; the interface does not create new match or model values.

To understand the implementation, start with `dashboard/src/app/page.tsx`, follow its imports into `components/`, then review `dashboard/src/lib/cricket.ts` for the exported data types and `globals.css` for shared visual behavior.

# Phase 2 — Historical Cricket Data

## Source and files

The first historical data foundation uses Cricsheet's India men's JSON archive. The original ZIP is retained at `data/raw/cricsheet/india_male_json.zip`; the importer reads it in memory without extracting or changing the archive. `data/raw/cricsheet/README.md` records provenance and checksum. The reproducible importer is `scripts/ingest_cricsheet.py`, its normalized schema and validation live in `src/sports/cricket/data.py`, and the match-level output and manifest are under `data/processed/cricket/`.

The archive contains 1,021 supported India men's international matches from 2001 through 2026: 526 ODIs, 276 T20Is and 219 Tests. Domestic T20 and other domestic matches are excluded by requiring Cricsheet's international team type. Cricsheet T20 records become T20I only after that filter. The manifest retains source format counts, JSON data versions, exclusions, archive SHA-256, date range and result/status counts.

## Schema and labels

Each CSV row represents a match and includes match ID, format, date/season/year, venue/city/country when supplied, teams, India and opponent, toss, innings summaries, result, winner, status and source provenance. Innings are a JSON-encoded list with batting team, runs, wickets, legal deliveries, declaration/forfeiture/super-over flags and target fields. Missing source values remain empty; the importer does not invent venue country or home/away status.

Test targets are `INDIA_WIN`, `DRAW` or `OPPONENT_WIN`. ODI and T20I results use India/opponent wins. Limited-overs ties and no-results remain in the history with a null training result and explicit status; a source eliminator or bowl-out winner is retained as a completed win. They must not be silently treated as losses. All rows are marked `HISTORICAL_DATA` and cite Cricsheet. Phase 3 connects this dataset to the historical cricket model pipeline; unrelated dashboard sections remain `DEMO DATA`.

## Rebuild and validation

Run `python scripts/ingest_cricsheet.py` to recreate the processed CSV and manifest from the checked-in raw archive. The importer uses Python standard-library ZIP, JSON, CSV, hashing and date modules. Focused normalization and archive tests live in `tests/test_cricket_data.py`; cricket model tests remain separate. Phase 3 adds `build_historical_features` to map result labels and generate lagged Cricsheet features. The original `build_features` path remains for synthetic demo exports.

## Concepts to learn

- **Data provenance:** raw source archive, immutable input, source URL and checksum make the derived table auditable and repeatable.
- **Schema normalization:** formats, teams, results and innings are converted into a stable match-level representation while missing source fields remain missing.
- **Target definition:** unresolved ties and no-results are not losses; format-specific target classes prevent false labels.
- **Leakage control:** match outcomes and innings totals are labels or post-match data, not pre-match predictors. Any future evaluation should split chronologically and construct features only from earlier matches.
- **Data contracts:** validation rejects duplicate IDs/identities, malformed teams/dates, invalid targets and inconsistent winner/status metadata before export.

# Phase 3 — India Cricket Prediction Engine

## What the engine does

The engine reads the 1,021-match Cricsheet India men's international table. It builds Test, ODI and T20I features separately, fits a calibrated logistic regression for each format, evaluates with expanding chronological holdouts, saves local model artifacts, and exports evaluation results to the dashboard. The dashboard prediction cards are labelled `HISTORICAL BACKTEST`. They are simulated holdout estimates, not calls preserved from before those matches. Upcoming fixtures are placeholders and show `Prediction unavailable`; there is no live schedule or score feed.

Rebuild the source table with `python scripts/ingest_cricsheet.py`, then run `python scripts/train_cricket_models.py` and `python scripts/export_cricket_data.py`. Training saves ignored `.joblib` files under `models/cricket/`, full per-format ledgers under `data/processed/cricket/evaluations/`, and a compact dashboard evaluation export. The analytics exporter reads the normalized CSV and rewrites results, form, head-to-head and stadium aggregates using Cricsheet matches only. Player scorecards and the future fixture list remain unavailable because the normalized dataset does not contain reliable player tables or an official schedule. The local FastAPI endpoint is `POST /cricket/predict` with a format and known opponent. It refuses dates inside the model's training range, unknown opponents, or missing artifacts/features. Outputs are labelled `MODEL PREDICTION`; this endpoint does not discover fixtures or live information.

## Concepts: concept, why, project use, next step

1. **Cricsheet and source data.** **Why:** match scores need a traceable source. **Here:** Cricsheet supplies dated men's international scorecards and innings summaries; ties/no-results are preserved. **Next:** learn JSON schemas, missing-data checks, licensing and provenance.
2. **Feature engineering.** **Why:** models need numeric clues that summarize earlier performance. **Here:** `features.py` transforms earlier matches into a pre-match feature row. **Next:** practice pandas transforms and inspect one row by hand.
3. **Elo and opponent strength.** **Why:** beating a strong opponent carries different evidence than beating a weak one. **Here:** each format tracks India and opponent Elo ratings; pre-match ratings/difference are features, updated only after the match. **Next:** derive Elo's expected-score formula and experiment with its K factor.
4. **Recent form.** **Why:** team strength changes over time. **Here:** India win rate uses at most the previous ten resolved matches in that format, never the current result. **Next:** compare windows using only chronological validation.
5. **Head-to-head.** **Why:** some matchup patterns differ by opponent. **Here:** win rate and resolved-match count use earlier India-versus-opponent results. **Next:** test whether head-to-head helps beyond Elo with a future ablation study.
6. **Batting and bowling features.** **Why:** runs, wickets and legal deliveries describe team performance. **Here:** prior innings summaries supply batting average, run rate, wickets lost, bowling economy/average, bowling wickets and (for Tests) first-innings runs. **Next:** study correct aggregation denominators and innings with zero dismissals.
7. **Features omitted on purpose.** **Why:** unavailable or post-match facts can create false certainty or leakage. **Here:** country is empty, so home/away is not inferred; toss is omitted because it is not known before the toss. Batter-level strike rate, boundaries and over-phase aggregates are absent from the normalized table. **Next:** verify/enrich a source before adding these features.
8. **Why separate Test/ODI/T20I?** **Why:** Tests can draw and last days; formats have different scoring patterns. **Here:** Test has India/draw/opponent outcomes; ODI/T20I have India/opponent outcomes, each with its own feature set and model. **Next:** compare separate models to a shared model without mixing validation dates.
9. **Logistic regression and XGBoost.** **Why:** logistic regression is a stable, interpretable baseline for a modest dataset and yields probabilities. **Here:** standardized inputs feed logistic regression, then sigmoid calibration. The optional XGBoost wrapper remains, but this backtest uses logistic regression; no evidence yet shows XGBoost is better here. **Next:** learn regularization and compare XGBoost on identical chronological folds.
10. **Training and probability predictions.** **Why:** the goal is a distribution over outcomes, not just a winner label. **Here:** the model learns from earlier labeled matches; probabilities sum to one. A 0.60 India probability is the model's estimated chance under learned patterns, not a guarantee. **Next:** study class imbalance and compare a simple base-rate baseline.
11. **Walk-forward evaluation.** **Why:** random shuffling can let future matches influence predictions for the past. **Here:** expanding windows train on earlier matches and predict later blocks. Saved records include match ID, class probabilities, predicted/actual class, correctness, model version, training cutoff and evaluation time. **Next:** learn rolling-origin validation and keep preprocessing inside each fold.
12. **Accuracy, precision, recall and F1.** **Why:** a single score hides different errors. **Here:** accuracy is total correct; ODI/T20I precision, recall and F1 treat India win as positive; Test uses macro F1 to weight its three classes equally. **Next:** inspect confusion matrices and identify which outcome is missed.
13. **Log loss and Brier score.** **Why:** overconfident wrong probabilities should be penalized. **Here:** log loss penalizes low probability on the actual class; multiclass Brier averages squared differences from a one-hot result. Lower is better. **Next:** calculate both for a tiny example by hand.
14. **Calibration.** **Why:** predictions near 70% should happen about seven times in ten over comparable cases. **Here:** sigmoid calibration is fitted inside each training fold; confidence-bin summaries are exported. Small bins are noisy. **Next:** learn reliability diagrams and compare calibrated with uncalibrated predictions.
15. **SHAP.** **Why:** users need to know what moved a prediction. **Here:** SHAP's permutation explainer attributes changes in the calibrated predicted-class probability relative to a training background sample, returning positive and negative factors. If SHAP fails, prediction remains available and explanation status says unavailable. **Next:** learn Shapley values, feature dependence and correlated-feature attribution.
16. **Model versioning and artifacts.** **Why:** predictions must identify the fitted model that produced them. **Here:** metadata records format, model type, feature version, Cricsheet date range, training time and walk-forward metrics; local joblib binaries are ignored by Git and rebuilt by the script. **Next:** learn artifact checksums and the existing MLflow registry.
17. **Prediction flow through the application.** **Why:** model, data and UI contracts must agree. **Here:** Cricsheet CSV → lagged feature builder → format model → calibrated probabilities → optional SHAP → `POST /cricket/predict`; dashboard pages separately read stored backtest metrics and history. **Next:** add a verified fixture source and check feature availability before automating future predictions.

## Actual evaluation from this source snapshot

The scores below are computed by the chronological backtest export, not hand-entered. Folds use a 60-match minimum training window and 20-match prediction steps. Evaluation counts exclude the initial training period and unresolved limited-overs matches.

| Format | Holdout predictions | Accuracy | Precision | Recall | F1 / Macro F1 | Log loss | Brier |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Test | 159 | 0.440 | — | — | Macro F1 0.305 | 1.216 | 0.642 |
| ODI | 437 | 0.634 | 0.649 | 0.932 | F1 0.765 | 0.663 | 0.470 |
| T20I | 209 | 0.722 | 0.736 | 0.967 | F1 0.836 | 0.616 | 0.424 |

These are first-baseline measurements, not a promise about future accuracy. India-only matches limit opponent form, classes are imbalanced, and there is no external baseline or uncertainty interval yet. Test log loss and macro F1 show that the three-way Test problem remains difficult.

## Phase 3 dashboard data, frontend requests and labels

### 1. How real historical data becomes analytics

The checked-in Cricsheet archive contains international matches. The ingestion script filters that source to India's men's international matches, normalizes match dates, format, teams, outcomes, venues and innings summaries, and writes `data/processed/cricket/india_internationals.csv`. The dashboard exporter reads only that normalized file. It groups resolved outcomes by format and opponent, calculates a rolling form series from past results, and calculates win rates at stadiums that have enough resolved matches. Unresolved ties and no-results stay out of win/loss totals; Test draws remain draws. The filter excludes domestic competitions, including IPL, before analytics are built.

The CSV is match-level rather than player-level, so it cannot support honest player scorecards. Venue names are not enough to decide whether a match was at home, away or neutral, so the dashboard does not infer those categories. It also does not add fixtures to the schedule when no official source is available.

### 2. How the frontend calls a prediction API

The dashboard renders its existing upcoming-match cards from format JSON exports. A card is eligible for inference only when the fixture has a future date, a real data label and `fixture_source: OFFICIAL_FIXTURE_FEED`. The browser sends only the format and match ID to the dashboard's same-origin `/api/cricket/predict` route. That server route looks the ID up in the exported fixture list; it does not trust an opponent or probability posted by the browser. It then sends the verified opponent and date to the FastAPI `/cricket/predict` service using the server-only `CRICKET_API_URL` environment variable.

FastAPI must have the appropriate trained format artifact and enough prior history. The route checks that returned probabilities are finite, in range, add to one, and include the draw class for Test. Only then does the card display probabilities and the `MODEL PREDICTION` label. No backend credentials are bundled into browser code. This repository currently has no official upcoming-fixture provider and its schedule export is empty, so the UI makes no prediction request and explains that the schedule and estimates are unavailable. Setting `CRICKET_API_URL` alone does not create fixtures.

To use a locally running API, train artifacts, start `uvicorn src.serving.app:app --host 127.0.0.1 --port 8000`, and put `CRICKET_API_URL=http://127.0.0.1:8000` in the dashboard's ignored `.env.local`. When a verified fixture feed is added, its exporter must mark each actual future fixture with `fixture_source: OFFICIAL_FIXTURE_FEED` and a historical/live source label before inference can run.

### 3. How to read data labels

- **HISTORICAL DATA** means a completed result or aggregate computed from Cricsheet. It describes past matches; it is not a forecast.
- **HISTORICAL BACKTEST** means a model predicted held-out past matches during chronological evaluation. The source has dates but no archived prediction timestamp, so those records are not proof of calls made before kickoff.
- **MODEL PREDICTION** means the trained model returned probabilities for an eligible fixture at request time. It is still an estimate, not a result.
- **DEMO DATA** means illustrative placeholders. Do not treat them as official schedules, results, or measured player performance.
- **UNAVAILABLE** means the current source does not support that section or a usable service/artifact is not configured. Empty or unavailable values are preferable to invented numbers.

### 4. Why a model cannot create an upcoming schedule

A prediction model answers a question about a match after it receives inputs such as format, opponent and date. It does not know that a match has actually been arranged. Inventing an opponent/date would turn an ordinary hypothetical into a false fixture claim. A schedule must come from an official or otherwise verified fixture source; only then can the application decide whether the trained model has enough prior history and a compatible artifact to estimate its outcome.

## What's real and what remains

- **Genuinely historical:** format results, recent results, rolling form, resolved head-to-head and recorded-stadium aggregates exported from Cricsheet; IPL/domestic T20 is excluded.
- **Genuinely ML-driven:** format-specific logistic models fitted from Cricsheet, sigmoid-calibrated probabilities, chronological holdout predictions, computed metrics, and SHAP factors when available.
- **Historical only:** evaluation and prediction-history cards. The source has match dates but no archived prediction timestamps, so these are not verified pre-match proof.
- **Unavailable:** upcoming fixtures, player-level scorecards and prediction trends. There is no verified fixture feed or player-level normalized data, and the dashboard hides older demo schedule rows.
- **Not live:** no live fixture, toss, score, roster or result integration. The local inference endpoint needs trained artifacts.
- **Data limitations:** venue country is empty; home advantage cannot be assigned safely. The India-only archive lacks each opponent's broader results. Batter strike rate, boundaries and over-phase stats are absent from normalized summaries. Match dates cannot order kickoff times within the same day, so same-day rows share pre-day feature state.
- **Recommended Phase 4:** add a documented and permitted fixture/results source with opponent-wide history and venue-country validation; record genuine timestamped pre-match calls; then add home/away and opponent-form features, compare against baselines, and monitor calibration before automating predictions.
