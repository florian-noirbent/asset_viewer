# Agent Instructions

- Do not leave backward-compatible aliases, wrappers, or temporary code behind unless the user explicitly requests them.
- Prefer complete migrations over transitional shims.
- Remove obsolete code, settings, documentation, and tests as part of the same change.
- start by reproducing errors in a test before attempting to solve the issues.
- follow coding best practices (SOLID, DRY, KISS, ...), and plan to use standard design patterns.
- don't git commit yourself unless prompted.
- run and validate: black, ruff, mypy, esling, prettier, unit test and e2e integration test before finishing a task.
- update unit and integration test with each feature and debug.
