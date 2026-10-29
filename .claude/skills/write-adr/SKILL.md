---
name: write-adr
description: Record an architecture decision (ADR) for the MISSENCE project in docs/adr using the project template.
---

# Write an ADR

1. Next number = highest in `docs/adr/` + 1, zero-padded to 4 digits. File: `NNNN-kebab-title.md`.
2. Use the template in `docs/adr/README.md`: Status, Date (absolute, YYYY-MM-DD), Context (forces, constraints, evidence), Decision (full sentences), Consequences (positive, negative, follow-ups).
3. Never edit an accepted ADR's decision; supersede it with a new ADR and set the old one's status to `Superseded by NNNN`.
4. Add the row to the index table in `docs/adr/README.md`, and link the ADR from the affected architecture/runbook pages.
