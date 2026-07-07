# Tower Defense — Developer Notes

## Version bump on every release

This game displays a live version number and git hash on-screen (see
`VERSION-SYSTEM.md`), sourced from `version.js`. That display is only
useful if it's actually kept current — it drifted out of date for three
merged feature PRs in a row before this rule was added.

**Rule: any PR that changes gameplay/release-facing files
(`game.js`, `index.html`, `style.css`) must also update `version.js`.**

Before opening the PR:

```bash
cd games/tower-defense
./update-version.sh X.Y.Z   # bump per semver: patch=fix, minor=feature, major=breaking
```

Then add a short entry to the `changelog` in `version.js` describing what
shipped, and commit `version.js` alongside the feature change.

A CI check (`.github/workflows/check-version-bump.yml`) enforces this: it
fails any PR that touches `game.js`/`index.html`/`style.css` under
`games/tower-defense/` without also touching `version.js`. Test files,
docs, and roadmap files are exempt.
