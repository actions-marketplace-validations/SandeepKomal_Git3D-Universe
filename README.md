# Git3D Universe

<p align="center">
  <strong>Turn GitHub activity into a living 3D contribution universe.</strong>
</p>

<picture>
  <source media="(prefers-color-scheme: light)" srcset="./preview-light.svg">
  <img alt="Git3D Universe: a year of contributions as a 3D pie of month wedges round a glowing core, with top repositories orbiting as planets and a small pie of the contribution mix" src="./preview-dark.svg">
</picture>

Git3D Universe turns your GitHub year into a small solar system, drawn as one self-contained SVG:

- **The year as a 3D pie:** one wedge per month, read clockwise like a clock face. Each wedge rises with that month's contributions and carries its name, and the busiest month is outlined in gold with its total.
- **A glowing core** sits in the middle of the ring.
- **Planets:** your top repositories orbit the pie, passing behind it and in front of it, sized by stars.
- **Contribution mix:** a small upright 3D pie in the top-left shows how your year splits between commits, pull requests, issues and code review, with each share labelled beside its slice.
- **Night and day:** `aurora` is deep space and `daylight` a soft dawn sky, with the same cosmic colour wheel.

It can be used locally as a Node.js CLI or directly as a reusable GitHub Action.

## GitHub Marketplace

Git3D Universe is published as a reusable GitHub Action. The stable release is `v2.0.0`.

Use the reviewed release tag or an immutable commit SHA in consuming workflows rather than tracking `main`.

## Use on your profile

This workflow installs Git3D Universe directly from the published Action.

### Step 1 — Add the workflow

Create this file in your profile repository:

`.github/workflows/git3d-universe.yml`

The workflow refreshes the SVG once per hour, chooses a light or dark theme from your local timezone, validates the generated SVG, and commits it back to the repository.

For production, use the stable release tag `v2.0.0` or an immutable commit SHA.

```yaml
# Copy this file into:
#
# .github/workflows/git3d-universe.yml
#
# Change the timezone below to your own IANA timezone.

name: Git3D Universe

on:
  workflow_dispatch:

  # Check once per hour.
  # The actual theme is calculated using the configured
  # local timezone.
  schedule:
    - cron: "17 * * * *"

permissions:
  contents: write

concurrency:
  group: git3d-universe
  cancel-in-progress: true

env:
  # Examples:
  # India: Asia/Kolkata
  # New York: America/New_York
  # London: Europe/London
  # Tokyo: Asia/Tokyo
  GIT3D_TIMEZONE: Asia/Kolkata

  GIT3D_DAY_START: "06"
  GIT3D_NIGHT_START: "18"

jobs:
  generate:
    name: Generate Git3D Universe
    runs-on: ubuntu-latest

    steps:
      - name: Checkout profile repository
        uses: actions/checkout@f548e57e544e1ff5a4c46bf1e1b8685f8e4a348a # v7.0.1
        with:
          fetch-depth: 0

      - name: Determine local theme
        id: theme
        shell: bash
        env:
          TIMEZONE: ${{ env.GIT3D_TIMEZONE }}
          DAY_START: ${{ env.GIT3D_DAY_START }}
          NIGHT_START: ${{ env.GIT3D_NIGHT_START }}
        run: |
          set -euo pipefail

          if ! TZ="${TIMEZONE}" date >/dev/null 2>&1; then
            echo "ERROR: Invalid IANA timezone: ${TIMEZONE}"
            exit 1
          fi

          HOUR=$(TZ="${TIMEZONE}" date +%H)
          LOCAL_DATE=$(TZ="${TIMEZONE}" date '+%Y-%m-%d %H:%M:%S %Z')

          echo "Local time: ${LOCAL_DATE}"

          if [ "${HOUR}" -ge "${DAY_START}" ] && [ "${HOUR}" -lt "${NIGHT_START}" ]; then
            THEME="daylight"
            MODE="DAY"
          else
            THEME="aurora"
            MODE="NIGHT"
          fi

          echo "Theme: ${THEME}"
          echo "Mode: ${MODE}"

          echo "theme=${THEME}" >> "$GITHUB_OUTPUT"
          echo "mode=${MODE}" >> "$GITHUB_OUTPUT"

      - name: Generate Git3D Universe
        uses: SandeepKomal/Git3D-Universe@v2.0.0
        with:
          username: ${{ github.repository_owner }}
          github-token: ${{ secrets.GITHUB_TOKEN }}
          theme: ${{ steps.theme.outputs.theme }}
          output: profile/git3d-universe.svg

      - name: Validate Git3D Universe
        env:
          SVG: profile/git3d-universe.svg
          EXPECTED_LOGIN: ${{ github.repository_owner }}
        run: |
          set -euo pipefail

          test -s "${SVG}"
          grep -q "<svg" "${SVG}"
          grep -q "</svg>" "${SVG}"
          grep -qi "@${EXPECTED_LOGIN}" "${SVG}"
          grep -q "contributions" "${SVG}"
          grep -q "active days" "${SVG}"
          grep -q "current streak" "${SVG}"
          grep -q "longest streak" "${SVG}"

          if grep -q "Ada Example" "${SVG}" || grep -q "ada-example" "${SVG}"; then
            echo "ERROR: Sample profile detected."
            exit 1
          fi

          SIZE=$(wc -c < "${SVG}")
          if [ "${SIZE}" -lt 5000 ]; then
            echo "ERROR: Generated SVG is unexpectedly small."
            exit 1
          fi

      - name: Commit Git3D Universe
        run: |
          set -euo pipefail

          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"

          git add profile/git3d-universe.svg

          if git diff --cached --quiet; then
            echo "No changes detected."
            exit 0
          fi

          git commit -m "chore: update Git3D Universe (${{ steps.theme.outputs.mode }})"
          git push origin main

### Step 2 — Add Git3D Universe to your README

After the workflow runs once, it creates:

`profile/git3d-universe.svg`

Add this Markdown to your profile README:

```md
![Git3D Universe](./profile/git3d-universe.svg)
```

Do not paste the generated SVG into `README.md`; keep it as the generated file and reference it with a normal Markdown image.

### Inputs

| Input | Required | Default | Description |
| --- | --- | --- | --- |
| `username` | No | Current repository owner | GitHub username to visualize |
| `github-token` | Yes | — | Token used to query GitHub's GraphQL API |
| `theme` | No | `aurora` | `aurora` or `daylight` |
| `output` | No | `profile/git3d-universe.svg` | Output SVG path |
| `no-motion` | No | `false` | Disable SVG orbit animation |

### Permissions and token handling

Start with the least privilege your workflow needs. The example grants `contents: write` because it is intended to commit the generated SVG back to a profile repository.

The Action passes the supplied token through the `GITHUB_TOKEN` environment variable. It does not place the token in command-line arguments.

The Action generates the SVG file; it does not edit `README.md`. Your workflow commits the SVG to the repository, and your README displays it with a normal Markdown image reference such as `![Git3D Universe](./profile/git3d-universe.svg)`.

The renderer requests GitHub data directly from `https://api.github.com/graphql` and does not use a hosted rendering service.

Depending on the GitHub data being requested and the token available to the workflow, additional user-level read access may be required. Store personal tokens only as encrypted GitHub Actions secrets and never commit them to the repository.

## Local CLI

```bash
npm install
npm run sample
npm test
```

Generate a profile visualization:

```bash
GITHUB_TOKEN=<token> node src/cli.mjs --user YOUR_LOGIN --out profile/git3d-universe.svg
```

Options:

```text
--theme aurora|daylight
--no-motion
--sample
--help
```

## Themes

- `aurora` — deep space: navy night sky, stars, and the cosmic colour wheel (teal, sky, indigo, violet, rose, gold)
- `daylight` — soft dawn sky with the same colour wheel, a little deeper for a light background

## Security properties

The project escapes profile and repository text before inserting it into SVG markup and validates repository language colors before using them as SVG values.

Runtime code currently declares no npm dependencies.

See [SECURITY.md](./SECURITY.md) for vulnerability reporting and the security model.

See [THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md) for external Action/dependency and asset notices.

## Repository layout

| Path | Purpose |
| --- | --- |
| `action.yml` | Root GitHub Action metadata and runner wrapper |
| `src/cli.mjs` | Command-line entrypoint |
| `src/stats.mjs` | Contribution statistics |
| `src/geometry.mjs` | 3D projection |
| `src/pie.mjs` | The 3D month pie, its core and the busiest-month label |
| `src/themes.mjs` | Theme color tokens |
| `src/render.mjs` | SVG scene composition: planets, the contribution-mix pie, the legend card |
| `src/github.mjs` | GitHub GraphQL data retrieval |
| `src/sample.mjs` | Deterministic sample data |
| `test/` | Unit and rendering tests |

## Support

For bugs and feature requests, use the [GitHub issue tracker](https://github.com/SandeepKomal/Git3D-Universe/issues).

For security vulnerabilities, follow [SECURITY.md](./SECURITY.md) and do not disclose sensitive details in a public issue.

For licensing and provenance information, see [EULA.md](./EULA.md) and [ORIGINALITY-AND-LICENSING.md](./ORIGINALITY-AND-LICENSING.md).

For privacy information, see [PRIVACY.md](./PRIVACY.md).

## Copyright and licensing

Copyright (c) 2026 Sandeep Komal Pothu.

Git3D Universe is released under the MIT License. The complete license text is available in [LICENSE](./LICENSE).

The repository currently declares no npm runtime dependencies and does not bundle third-party fonts, images, icons, templates, or rendering libraries. The Marketplace wrapper does invoke the GitHub-maintained `actions/setup-node` action; its license is documented in [THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md).

This documentation describes the project's current licensing, provenance, and security posture; it is not legal advice.
