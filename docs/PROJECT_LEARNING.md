# Phase 1B — Premium UI

## UI technologies

The dashboard uses React 19, Next.js App Router, TypeScript, Tailwind CSS 4, custom CSS, Framer Motion (already installed), and Recharts. This phase added no dependencies.

## Files and structure

Phase 1B updated `dashboard/src/app/page.tsx`, `components/Hero.tsx`, `components/IndiaNightMap.tsx`, `components/Nav.tsx`, `components/cricket/PredictionCards.tsx`, `components/ResultCards.tsx`, `components/cricket/Panels.tsx`, `app/globals.css`, and `lib/site.ts`. These files handle the homepage composition, hero and map, navigation, match/prediction presentation, and shared visual styles. No route data or backend files changed.

The app is composed from shared components: header and format controls, hero, summary strip, match sections, prediction history, analytics, then footer. `dashboard/src/app/page.tsx` composes the homepage; `dashboard/src/components/cricket/FormatPage.tsx` uses shared components for Test, ODI, and T20I routes. The existing `SportTabs` component supplies the format links.

The homepage is composed from shared components: header and format links, hero, summary strip, match sections, prediction history, analytics, then footer. Format routes reuse the same header, hero, match cards, and analytics panels while receiving format data through props.

## Concepts to learn

- **React and Next.js:** component composition, props, list rendering, App Router segments, server/client component boundaries, and linking between page sections.
- **TypeScript:** shared data types make the UI consume existing cricket exports without changing their shape.
- **Tailwind and CSS:** responsive breakpoints, custom properties, CSS Grid/Flexbox, pseudo-elements, keyframes, transitions, and `prefers-reduced-motion`.
- **Motion:** the hero uses a short entrance animation; cards and controls use small hover/selection transitions. Reduced-motion preferences disable these effects.
- **Data honesty:** badges and prediction details are rendered from existing export fields; the interface does not create new match or model values.

To understand the implementation, start with `dashboard/src/app/page.tsx`, follow its imports into `components/`, then review `dashboard/src/lib/cricket.ts` for the exported data types and `globals.css` for shared visual behavior.
