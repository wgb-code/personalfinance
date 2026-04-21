# /spec-draft

**Description**: Refine a brief theme into a detailed, production-ready SPEC + TASKS + SECURITY via spec-architect agent.

**Usage**: `/spec-draft "brief theme or requirement"`

**Invokes**: `spec-architect` subagent

---

## What Happens

The `spec-architect` subagent runs a 4-phase workflow:

### Phase 1: Silent Indexing
Agent reads your project's knowledge base (requirements, stack, schema, security laws, constitution, prior specs) in parallel.

### Phase 2: Proposal + Questions
Agent proposes a module number and slug, outlines what it understood, maps to your tech stack and database, and asks 3–5 critical clarifying questions.

**You respond** (via structured or free-form prompts).

### Phase 3: Consolidated Plan
Agent presents a complete plan (objective, Gherkin criteria, 15 security laws mapping, dependencies, out of scope).

**You confirm** (or request adjustments, which loops back to Phase 2).

### Phase 4: File Generation
Agent generates **3 production-ready files** in `specs/modules/NN-slug/`:
- `spec.md` — detailed specification (personas, business rules, acceptance criteria, dependencies, success metrics)
- `tasks.md` — TDD checklist (one task per Gherkin criterion, with RED/GREEN/REFACTOR/SECURITY phases)
- `security.md` — security audit template (15 Laws mapped to tests and evidence)

And updates `specs/_progress.md` to mark the module's spec as "Pronto".

---

## Example

```
/spec-draft "Quero atacar contas fixas agora"
```

Agent responds:
```
## Module Proposed
- Number/slug: 04-fixed-bills
- In fixed order: YES (next after 03-categories)

[... mapping, assumptions, 5 critical questions ...]
```

You answer the questions. Agent proposes the full plan. You confirm. Files are generated in `specs/modules/04-fixed-bills/`. Done.

---

## Alternative: Low-Level Scaffold

For manually crafted specs (rare), use `/spec-new <number> <slug>` to copy a blank template.

---

## Next Step

After generation, run `/spec-review NN-slug` to validate the spec before starting implementation with `/module-start NN-slug`.

