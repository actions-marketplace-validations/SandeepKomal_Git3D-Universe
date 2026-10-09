# Licensing and Provenance

## Copyright

Copyright (c) 2026 Sandeep Komal Pothu.

The repository is maintained and published from the **SandeepKomal/Git3D-Universe** GitHub repository.

## Source-code license

Git3D Universe is released under the MIT License. See [LICENSE](./LICENSE) for the complete license text.

The MIT license permits use, copying, modification, publication, distribution, sublicensing, and sale of the licensed software, subject to retention of the copyright and permission notice and the other terms in the license.

## Current project provenance

The current repository is an independent implementation of the Git3D Universe renderer, command-line interface, GitHub data retrieval, themes, tests, and Marketplace wrapper.

The repository currently has no declared npm runtime dependencies. The Marketplace wrapper uses the GitHub-maintained `actions/setup-node` action; its applicable notice is recorded in [THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md).

No third-party fonts, icons, templates, or image libraries are intentionally bundled by the current source tree.

## Visual design provenance

The rendered scene is composed entirely by the project's own code in `src/render.mjs`, `src/geometry.mjs`, and `src/themes.mjs`. That includes the projected terrain and plate, the colour band on empty days, the split-depth orbit layers and their glow, core and highlight lines, the lit 3D planets (gradients, cloud bands, storm spot, terminator, specular glint, atmosphere rim and banded ring), the peak-day beacon, the floor grid, the nebula backdrop, the stats and legend cards, and the prism legend. All colour values are defined in `src/themes.mjs`. No external images, icon sets, fonts, SVG templates, or generated artwork are embedded. The font stack refers only to fonts already installed on the viewer's system.

## Release review

### v1.1.0 (2026-10-08)

- **Third-party code:** none added. All changes are original code in `src/` and `test/`.
- **Assets:** no images, icon sets, fonts, SVG templates or generated artwork added. The preview SVGs are produced by the project's own renderer from built-in sample data.
- **Dependencies:** still none at runtime or for development. `action.yml` is unchanged and still pins `actions/setup-node` by commit SHA, as recorded in [THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md).
- **Design references:** other contribution visualizers were viewed only as rendered output, never as source code. Their signature visual elements were deliberately not reproduced.
- **Security hardening:** repository fields are normalised before rendering (SandeepKomal/Git3D-Universe#19). Hostile-input checks found no markup injection.
- **Maintainer sign-off:** recorded by merging the pull request that added this section.

## Contributions

Contributors retain whatever rights they have in their contributions and grant the project the rights necessary to distribute those contributions under the project's applicable license, subject to the project's contribution terms and GitHub's hosting terms.

Before accepting externally contributed code or assets, maintainers should confirm that the contributor has the right to submit them and that any third-party obligations are documented.

## Generated assets

The repository contains generated SVG previews used for documentation and examples. Generated output is produced from the project's renderer and sample data.

Third-party provenance or metadata embedded in an individual generated asset, if any, should not be interpreted as a separate license for the underlying Git3D Universe source code. Any externally sourced material intentionally included in an asset must be documented in [THIRD-PARTY-NOTICES.md](./THIRD-PARTY-NOTICES.md).

## Trademarks and services

Git3D Universe is an independent project. GitHub names, logos, and other trademarks remain the property of their respective owners. The project uses GitHub's APIs and GitHub Actions but does not claim ownership of GitHub branding.

## Legal note

This file describes the project's intended licensing and provenance posture based on the current repository contents. It is not legal advice.
