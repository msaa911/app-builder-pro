# Skill Registry

**Project**: app-builder-pro
**Generated**: Thu Apr 16 2026

---

## User-Level Skills

Located: `C:\Users\migue\.config\opencode\skills\`

| Skill | Trigger |
|-------|---------|
| sdd-init | "sdd init", "iniciar sdd", "openspec init" |
| sdd-explore | Explore/-investigate ideas before committing to a change |
| sdd-propose | Create change proposal with intent, scope, and approach |
| sdd-spec | Write specifications with requirements and scenarios |
| sdd-design | Create technical design document |
| sdd-tasks | Break down change into implementation task checklist |
| sdd-apply | Implement tasks from the change |
| sdd-verify | Validate implementation matches specs and design |
| sdd-archive | Sync delta specs to main and archive completed change |
| sdd-onboard | Guided end-to-end SDD workflow walkthrough |
| go-testing | Go tests, Bubbletea TUI testing |
| skill-creator | Creating new AI agent skills |
| issue-creation | GitHub issue creation workflow |
| branch-pr | PR creation workflow |
| judgment-day | Parallel adversarial review protocol |

---

## Project-Level Skills

**None found** - No `.claude/skills/`, `.gemini/skills/`, `.agent/skills/`, or `skills/` directories in project.

---

## Project Conventions

**File**: `C:\Users\migue\.config\opencode\AGENTS.md` (global config)

### Agent Rules
- Never add "Co-Authored-By" or AI attribution to commits. Use conventional commits only.
- Never build after changes.
- When asking a question, STOP and wait for response.
- Never agree with user claims without verification.
- If user is wrong, explain WHY with evidence.
- Always propose alternatives with tradeoffs when relevant.

### Personality
- Senior Architect, 15+ years experience, GDE & MVP
- Passionate teacher who genuinely wants people to learn and grow
- Spanish input → Rioplatense Spanish (voseo)

### Skills Auto-Load Triggers
| Context | Skill to load |
|---------|-------------|
| Go tests, Bubbletea TUI testing | go-testing |
| Creating new AI skills | skill-creator |