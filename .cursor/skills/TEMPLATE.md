# Project skill template

Copy this file into a new directory under `.cursor/skills/`:

```
.cursor/skills/your-skill-name/SKILL.md
```

Replace `your-skill-name` with a lowercase, hyphenated identifier (max 64 characters).

---

```markdown
---
name: your-skill-name
description: >-
  What this skill does and when to use it (third person; include trigger terms).
disable-model-invocation: true
---

# Your Skill Name

## Instructions

Step-by-step guidance for the agent.

## Examples

Concrete examples of expected inputs and outputs.
```

## Optional files

```
your-skill-name/
├── SKILL.md          # Required
├── reference.md      # Optional — detailed docs (link from SKILL.md)
├── examples.md       # Optional — usage examples
└── scripts/          # Optional — utility scripts the agent can run
```

## Notes

- Project skills live in `.cursor/skills/` and are shared with everyone who clones the repo.
- Keep `SKILL.md` under ~500 lines; move long reference material into separate files.
- Omit `disable-model-invocation` (or set it to `false`) only when the agent should auto-apply the skill from context.
