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
documentation in the same commit — all of these that apply:**

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
- **`ROADMAP.md`** — the feature backlog (what's proposed/planned, with
  status and priority — a product-owner view, not an architecture one).
  Update it whenever a feature idea is raised (add it), a priority or
  status changes (update it), or a backlog item ships (delete its entry
  here — it belongs in `CHANGELOG.md` now, not both places).

A version bump with no matching documentation update is an incomplete
change, the same way a version bump is incomplete without the code change
it's meant to track.

## One branch per PR — never reuse a branch name across merges

**Rule: once a PR merges, start the next round of work on a brand-new
branch cut from the now-updated `main` — don't reset/force-push the same
branch name to build the next PR on top of it.**

Earlier PRs in this project's history reused a single branch name across
many merges, resetting it onto `main` before each new round of commits.
That worked, but it meant the branch name tracked a moving target rather
than mapping to one finished PR, and repeated force-pushes leave no
stable record of what any individual PR actually contained.

Going forward: after a PR merges, branch the next round of work off the
updated `main` under its own new name (e.g. `claude/farm-<short-topic>`),
so every branch corresponds to exactly one PR and stays around as a
stable, inspectable record of it — never recycled, never force-pushed
over for unrelated follow-up work.
