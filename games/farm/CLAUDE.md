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
semver choice), this one is fully automatic: every run just increments
X.Y.Z -> X.Y.(Z+1), so there's no judgment call to make — just run it and
commit `js/version.js` alongside the change.

A CI check (`.github/workflows/farm-check-version-bump.yml`) enforces this:
it fails any PR that touches files under `games/farm/` without also
touching `js/version.js`. Test files and docs (`.md`) are exempt, as is
`bump-version.sh` itself.

## Documentation is part of every change, not a follow-up

**Rule: every change that adds or changes a feature also updates
documentation in the same commit — both of these, whichever apply:**

- **`CHANGELOG.md`** — a one-line, player-facing entry under the new
  version number, written for someone playing the game, not reading the
  code (see existing entries for the tone/length). Skip only for changes
  with no player-visible effect (internal refactors, test-only changes, a
  change reverted before it ever shipped).
- **`PLAN.md`** — the architecture doc. Update the relevant section (or
  add a new one) so it still accurately describes how the game actually
  works; don't leave it describing removed/changed behavior. This is the
  project's "for developers" documentation — treat it as required, not
  optional polish tacked on at the end.

A version bump with no matching `CHANGELOG.md`/`PLAN.md` update is an
incomplete change, the same way a version bump is incomplete without the
code change it's meant to track.
