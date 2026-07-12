# Vendored Libraries

| File | Library | Version | Source |
|------|---------|---------|--------|
| `babylon.min.js` | Babylon.js (UMD/global build) | 9.16.1 | `https://registry.npmjs.org/babylonjs/-/babylonjs-9.16.1.tgz` (`package/babylon.js`) |

Vendored (rather than loaded from a CDN) so the game works by pushing static
files to GitHub Pages with no build step and no runtime third-party dependency,
per the No-Build-Step Constraint in `../design.md`.

To upgrade: download the new `babylonjs` npm tarball, extract `package/babylon.js`
(this is the minified UMD build despite the name), replace `babylon.min.js`, and
update this table.
