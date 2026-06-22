---
name: cos-output-conventions
description: "Default output formats by deliverable type. Prevents drift on 'should this be markdown or docx?' — answer is here. Skills should follow these defaults unless the user specifies otherwise."
metadata: 
  node_type: memory
  type: reference
  originSessionId: e23eb99c-920c-4813-a195-79c71f997038
---

## The rule of thumb

- **Working drafts, internal docs, structured notes:** `.md` in the workspace.
- **External-facing formal deliverables:** `.docx` saved to the right Drive subfolder.
- **Tabular data:** `.xlsx`.
- **Presentations:** `.pptx`.
- **Shareable interactive artifacts:** single-file `.html` published via [[poc-publish]].
- **System internals (skills, agents, memory):** `.md` with frontmatter per [[cos-system-architecture]].
- **Reusable shell scripts:** `.sh` (executable, `chmod +x`) under `/Chief of Staff/scripts/`.
- **Live dashboards / status pages:** Cowork artifacts via `create_artifact`.

## By deliverable type

| Deliverable | Format | Lives at |
|---|---|---|
| POC scope doc | `.md` | `/Chief of Staff/pocs/<slug> — scope — <date>.md` |
| POC artifact (interactive) | `.html` (single self-contained file) | `/Chief of Staff/pocs/<slug>/index.html` then GitHub Pages |
| POC repo README | `.md` | `/Chief of Staff/pocs/<slug>/README.md` then GitHub |
| Cover letter (per-role) | Google Doc → exported `.pdf` for submission | `/Drive/Resume, Cover Letters, Case Studies/<Company (Role)>/` per [[cos-drive-governance]] |
| Resume (per-role tailored) | Google Doc → exported `.pdf` for submission | Same Drive subfolder per [[cos-drive-governance]] |
| Weekly review | `.docx` + chat summary | `/Chief of Staff/Weekly review YYYY-MM-DD.docx` |
| Daily briefing | Chat-only output (no file) | N/A — ephemeral |
| EOD review | Chat-only output (no file) | N/A — ephemeral |
| Company deep-dive | `.md` | `/Chief of Staff/research/<Company> — deep-dive — <date>.md` |
| Market scan (bi-weekly) | `.md` + chat exec summary | `/Chief of Staff/market-scans/YYYY-MM-DD.md` |
| Learning sprint plan | `.md` | `/Chief of Staff/learning/sprint — <topic> — <date>.md` |
| Case study dossier | `.md` memory entry | `<memory>/cos_case_<company>_<topic>.md` |
| System refactor report | `.md` | `/Chief of Staff/system-refactor/report — YYYY-MM-DD.md` |
| Trello card | Trello (via [[trello-sync]]) | N/A — connector-mediated |
| Email reply / draft | Chat + draft in Gmail (via connector) | Drafts folder; sent after Jason approves |
| Slack / LinkedIn message | `.md` draft in chat for Jason to copy-paste | N/A — no posting back |
| Meeting notes from transcript | `.docx` in per-role Drive folder FIRST (per [[cos-feedback-meeting-notes]]) | `/Drive/<Company (Role)>/<Meeting type> — <date>.docx` |
| Scheduled-task SKILL.md | `.md` thin pointer per [[cos-system-architecture]] Path A | `/Documents/Claude/Scheduled/<taskId>/SKILL.md` (managed by tool) |

## When in doubt

- Default to `.md` in the workspace if you're not sure.
- Promote to `.docx` if Jason will share externally OR if it's a formal weekly/monthly deliverable.
- Promote to a Cowork artifact if it's a live, reloadable view of changing data.
- Use `.pptx` ONLY when explicitly requested ("make a deck"); never default to slides.

## Why

Before this entry, format defaults were implicit in each skill. Drift was possible: a new skill might write `.docx` where `.md` was right, or vice versa. This codifies the table so format choice is a one-look decision, not a re-derivation.

## How to apply

- When designing a new skill: consult the table to pick the output format.
- When a skill's output type isn't listed here: add it — this should be the canonical list.
- When the user asks for a different format than the default ("save this as a doc, not markdown"): the user's choice wins for that instance, but the default stays unless they ask to change it system-wide.
