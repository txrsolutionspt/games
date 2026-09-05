# Map editor — documentation rule

## Every change updates docs, not just code

This app has shipped a lot of features across many small PRs (full-bleed
map, categories, selection states, measurement + search, multiple maps,
PWA support, file attachments, and assorted bug fixes) without any of it
being written down anywhere a user or a future contributor could find it.
`TODO.md` drifted out of date almost immediately and there was no
user-facing changelog or README at all. That gap is the reason this rule
exists.

**Rule: any PR that adds/changes a user-facing feature or fixes a
user-visible bug in `games/maps/` must also update, in the same PR:**

1. **`CHANGELOG.md`** (user-facing) — add a dated entry describing what
   changed, in plain language a user of the app would understand (not
   implementation detail). New feature, behavior change, or bug fix — all
   of it goes here.
2. **`TODO.md`** (project management) — keep it truthful:
   - Move/remove anything the change just finished from "Deferred
     features" or "Known rough edges".
   - Add new deferred items or rough edges the change surfaced or left
     behind on purpose.
   - Update "Architecture notes" if the change touches the data model,
     persistence, or a structural decision described there.

A change that's purely internal (refactor, test-only, dependency bump)
with no user-visible effect doesn't need a `CHANGELOG.md` entry, but should
still update `TODO.md` if it changes an architecture note's accuracy.

Do this as part of the same commit/PR as the change — not as separate
follow-up work, and not only when asked. Treat "add this to the PR" as
already asked, for every future change in this directory.
