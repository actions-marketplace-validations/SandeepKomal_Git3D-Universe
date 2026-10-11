# Changelog

All notable changes to Git3D Universe are documented here.

## [2.0.0] - 2026-10-10

A new look of Git3D Universe's own. The 3D grid of bars, the neon edges and the colour wave are gone; they now live on in the separate Neon Arena project.

### The year as a 3D pie
- The contribution calendar becomes a ring of month wedges standing on a floating disc, read clockwise from the top like a clock face. Each wedge spans its month's share of the year (partial months at either end are thinner), rises with that month's contributions and carries the month's name on its top.
- The busiest month is outlined in gold, with its name and total in a label floating in clear sky above the pie.
- A glowing core sits in the middle of the ring.
- Wedges are cut into narrow segments and painted back to front, with a hairline stroke in each face's own colour so segments join without seams.

### Planets orbit the pie
- Repository planets now circle the pie, passing behind it on the far side and in front of it on the near side. Far-side names hide only while they would overlap the pie.

### Contribution mix
- A small upright 3D pie in the top-left, facing the viewer, shows how the year splits between commits, pull requests, issues and code review, as shares of those four (like GitHub's activity overview). Each slice's share and name sit beside it on a short leader line, so the split never relies on colour alone. Its four colours were checked for colour-blind separation in both themes.
- The GitHub query now also reads `totalCommitContributions`, `totalPullRequestContributions`, `totalIssueContributions` and `totalPullRequestReviewContributions`. No new scopes are needed.

### Cosmic themes
- `aurora` is deep space (navy sky, stars, indigo and teal nebulas) and `daylight` a soft dawn sky. Both use one cosmic colour wheel for the months: teal, sky, indigo, violet, rose and gold.

### Removed
- The top-left stats card and its weekly sparkline. The headline numbers remain in the image's accessible title and description, so workflows that check the SVG for them keep passing.
- The isometric terrain, floor grid, peak-day beacon, neon-tube edges, colour wave and the `ramp`, `wave`, `edgeBack`, `edgeFront`, `neonFrame` and related theme tokens. `prismFaces` is removed from `src/geometry.mjs`.

## [1.3.1] - 2026-10-09

### Fixed
- Planets on the far side of their orbit show their names again whenever the name sits in clear sky. A name is hidden only while it would overlap the grid or the bars, so it is never drawn over the terrain or cut off.
- How it works: the terrain's outline (the plate's top surface and every bar's box) is passed to the orbit renderer. Each name's position is sampled at 72 points around its orbit, using the same paced timing as the animation, and a discrete visibility animation shows the name only where it is clear. Near-side names always show. Static images follow the same rule.
- Names now sit in their own layer above the planets.

## [1.3.0] - 2026-10-09

### Colour wave
- In animated mode a soft colour wave rolls across the contribution grid. There's one glowing strip per week, fading in and out in turn, so the wave travels along the year. Each pass takes the next colour from the theme's `wave` palette: pink, blue, green, purple.
- The wave sits between the floor and the bars, so bars stay solid in front. It costs one small polygon per week and is left out of static (`no-motion`) images.

### Neon-tube edges
- The plate's edges are glowing neon tubes, each a thick bright core with a soft halo: hot pink along the back and neon green along the front, in both themes.
- In the day theme the cards also get a glowing pink-to-green neon frame.

### White day theme, same neons as night
- `daylight` is pure white, with no grey gradient, tinted clouds or haze.
- It uses exactly the same neon palette as `aurora`: neon blue `#00b7ff` → neon green `#39ff14` → neon purple `#bc13fe` → neon pink `#ff10f0`, with a radium-yellow `#e6ff00` peak day. The planets, wave and neon-tube edges match too. Bar tops are outlined in a deeper shade of their own colour, so the neons stay crisp on white.
- Grid lines between the empty squares are thicker (1.2px), fully opaque and a darker lavender-grey, so the grid stays visible on white.
- New theme tokens `borderA`, `borderB`, `edgeBack`, `edgeFront`, `neonFrame`, `wave` and `waveOpacity`. A test keeps the two palettes in sync.

## [1.2.1] - 2026-10-09

### Fixed
- Planet names are never cut off. Before, the scene was split into front and back halves along a horizontal line, so a name could straddle the line and have part of it drawn behind the terrain. Now each planet and its name switch between the back and front layers together, as one unit.
- Names show only while a planet is in front of the terrain. A planet behind the terrain is drawn without its name, rather than with a name partly hidden by the bars.

## [1.2.0] - 2026-10-09

### Radium (neon) colour schemes
- `aurora` (night): fluorescent colours on a near-black sky. Activity goes neon blue `#00b7ff` → neon green `#39ff14` → neon purple `#bc13fe` → neon pink `#ff10f0`, and the peak day glows radium yellow `#e6ff00`.
- Night mode outlines each bar top in a lighter tint of its own colour, like a neon tube (new `neonEdges` theme flag).
- `daylight` (day): slightly deeper neons that stay readable on white (`#0091ff` → `#1fc700` → `#a100ff` → `#ff00b8`), with a neon-orange `#ff6a00` peak.
- Each activity level has its own colour, so busy profiles show an even mix.
- Planets always use the theme's neon palette, one distinct colour each, instead of GitHub language colours. They have a stronger neon halo at night.

### Fixed
- Planet labels now share their planet's depth layer. When a planet passes behind the terrain, its name is hidden with it instead of floating on top of the grid and bars.

## [1.1.0] - 2026-10-08

### 3D scene redesign
- Hero layout: the terrain now runs corner to corner on a 1280×760 canvas. Cells are about twice the size, the camera is lower, and bars stand up to about 185px tall.
- Colour levels follow the quartiles of active days (new `levelByRank`), so one very busy day no longer pushes every other day into the lowest colour.
- Cards moved into the corners the terrain leaves empty: identity and stats top-left, intensity and peak bottom-right.
- Stronger contrast between bar tops and sides.
- Planets are lit 3D spheres: a highlight toward the scene light, tilted cloud bands and a drifting storm spot, a terminator shadow, a specular glint, and an atmosphere rim. The lead planet has a banded ring that casts a shadow on the body. Repos without a language colour get a colour from the new `planets` theme palette.
- Orbits are much clearer: each one has a soft glow, a crisp core line and a fine highlight line (new `ringHi` theme token). The near half is brighter than the far half, the outer orbit is drawn as round dots, and in animated mode a light pulse travels along each near half.
- Empty days now take a soft colour band that drifts across the year (new `floor` theme token), so the whole year reads as a solid shape even on quiet profiles.
- Orbits now have real depth: rings are split into far and near arcs, and planets pass behind the terrain on the far side and in front of it on the near side.
- Planets scale with distance (larger when near), have a soft atmosphere and rim highlight, and the most-starred repository gets its own ring.
- Planet labels show star counts, stay above the scene, and dim on the far side instead of being clipped.
- Added a light beam and callout above the busiest day.
- Added month labels along the front edge of the plate.
- The plate now has a ground shadow, a front rim light, a gradient top, and shades only the faces that point toward the viewer. Before this, the hidden right-end face was shaded.
- Added a fading floor grid, background nebula clouds, and gently twinkling stars (animated mode only).
- Redesigned the stats card: eyebrow title, fixed the sparkline drawing over its caption, gradient area fill, and an end-point marker.
- Replaced the loose legend with a legend card: the intensity ramp drawn as small 3D prisms, the peak day, and a note on what planet size means.
- Added `<title>` and `<desc>` for screen readers.
- New theme tokens: `nebulaA`, `nebulaB`, `grid`, `shadow`.
- Regenerated the preview SVGs from the renderer.

### Fixed
- Repo fields are normalised before rendering, so a non-numeric star count or a missing repo name can no longer produce broken geometry or a crash.

## [1.0.1] - 2026-10-04

### Dark theme and documentation patch
- Improved `aurora` dark-theme terrain contrast.
- Added visible contribution-cell edges for clearer 3D grid separation.
- Improved visibility of low-activity and empty grid cells in dark mode.
- Preserved the existing daylight theme.
- Added rendering test coverage for terrain edge styling.
- Updated profile usage documentation for the `v1.0.1` Marketplace release.


## [1.0.0] - 2026-10-02

### Marketplace release
- Prepared the first stable GitHub Marketplace release.
- Added reusable composite Action metadata.
- Added security, privacy, EULA, provenance, and third-party licensing documentation.
- Added CodeQL, Dependabot, CI hardening, release automation, and structured issue/PR templates.
- Added timezone-aware profile workflow guidance with automatic daylight/aurora theme selection.
- Added deterministic sample preview guidance.

## [0.1.0]

### Initial project
- Added the 3D isometric contribution renderer.
- Added aurora and daylight themes.
- Added deterministic rendering and GitHub GraphQL profile retrieval.
- Added CLI usage and automated tests.
