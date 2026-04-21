# /spec-new

**Description**: Create a blank SPEC module scaffold for manual population.

> **Recommended**: For automated spec generation from a brief theme, use `/spec-draft` instead.
> Use `/spec-new` only when you already have all the content in your head and just want a raw scaffold to fill in manually.

**Usage**: `/spec-new <number> <slug>`

**Example**: `/spec-new 04 fixed-bills`

---

## What It Does

Copies the template from `specs/_module-template/` into `specs/modules/NN-slug/` with three blank files ready for you to populate:

- `spec.md` — module specification
- `tasks.md` — TDD checklist (red/green/refactor/security)
- `security.md` — 15 Laws security audit template

All sections are outlined but empty. You fill in based on your understanding.

---

## When to Use This

- You have all the details locked in your head already
- You want direct control over every sentence
- Prior modules are fully implemented and dependencies are crystal clear
- You're confident enough to skip the structured questioning phase

For most cases, `/spec-draft` is **faster and more thorough**.

---

## Next Step

After creation, populate the three files and run `/spec-review NN-slug` before starting `/module-start NN-slug`.

