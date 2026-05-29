# Agent Instructions

- Do not leave backward-compatible aliases, wrappers, or temporary code behind unless the user explicitly requests them.
- Prefer complete migrations over transitional shims.
- Remove obsolete code, settings, documentation, and tests as part of the same change.
- Keep public behavior stable only when it is still part of the requested target design.
- don't commit yourself unless prompted