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

Test targets are `INDIA_WIN`, `DRAW` or `OPPONENT_WIN`. ODI and T20I results use India/opponent wins. Limited-overs ties and no-results remain in the history with a null training result and explicit status; a source eliminator or bowl-out winner is retained as a completed win. They must not be silently treated as losses. All rows are marked `HISTORICAL_DATA` and cite Cricsheet. The dashboard exports and visible UI remain `DEMO DATA`; this Phase 2 dataset is not wired into the UI or model pipeline.

## Rebuild and validation

Run `python scripts/ingest_cricsheet.py` to recreate the processed CSV and manifest from the checked-in raw archive. The importer uses Python standard-library ZIP, JSON, CSV, hashing and date modules. Focused normalization and archive tests live in `tests/test_cricket_data.py`; existing cricket model tests remain separate. The current cricket feature builder expects lowercase winner labels and a venue-type feature. A later adapter must deliberately map the normalized labels and enrich venue context before using these rows for training or evaluation.

## Concepts to learn

- **Data provenance:** raw source archive, immutable input, source URL and checksum make the derived table auditable and repeatable.
- **Schema normalization:** formats, teams, results and innings are converted into a stable match-level representation while missing source fields remain missing.
- **Target definition:** unresolved ties and no-results are not losses; format-specific target classes prevent false labels.
- **Leakage control:** match outcomes and innings totals are labels or post-match data, not pre-match predictors. Any future evaluation should split chronologically and construct features only from earlier matches.
- **Data contracts:** validation rejects duplicate IDs/identities, malformed teams/dates, invalid targets and inconsistent winner/status metadata before export.
