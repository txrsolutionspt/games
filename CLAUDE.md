# Repository-wide agent rules

## One branch per pull request

After a pull request is merged into `main`, do not keep committing to that
same branch for the next piece of work — create a fresh branch (off the
latest `main`) for it instead, so every PR maps to its own branch and old,
merged branches aren't reused or stacked on.

This applies any time a task's branch isn't explicitly pinned by the task
itself. If a task description does pin a specific branch name to develop
on, follow that instruction for that task instead.
