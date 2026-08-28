# Little Farm School — Developer Notes

## Version bump on every release-facing change

This game shows a live version number in Settings (see PLAN.md §12),
sourced from `js/version.js`.

**Rule: any change to release-facing files must also bump `js/version.js`.**

Before committing:

```bash
cd games/farm
./bump-version.sh   # no arguments -- always auto-increments the patch number
```

Unlike `games/tower-defense`'s version bump (which asks for an explicit
semver choice plus a changelog entry), this one is fully automatic: every
run just increments X.Y.Z -> X.Y.(Z+1), so there's no judgment call to make
or changelog to keep current — just run it and commit `js/version.js`
alongside the change.

A CI check (`.github/workflows/farm-check-version-bump.yml`) enforces this:
it fails any PR that touches files under `games/farm/` without also
touching `js/version.js`. Test files and docs (`.md`) are exempt, as is
`bump-version.sh` itself.
