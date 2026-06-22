---
name: cos-feedback-soar-not-star
description: "Jason prefers SOAR (Situation / Objectives / Actions + Deliverables / Result) over STAR for behavioral storytelling. Apply to interview story banks, case study dossiers, resume bullets, and any structured retelling of past work. Especially load-bearing for case studies — the Deliverables coupling is the tangible proof anchor that distinguishes a credible retelling from a generic one."
metadata:
  node_type: memory
  type: feedback
  originSessionId: a52202d3-21fa-4b53-8ec1-3542103e7d90
---

**Rule:** Use SOAR, not STAR, for any structured behavioral retelling of past work.

**The substitution:**

| STAR | SOAR | Why the swap |
|---|---|---|
| **Situation** | **Situation** | Same — the context |
| **Task** | **Objectives** | "Task" sounds tactical and assigned-down; "Objectives" names the actual goal Jason was working toward, including ambiguity and self-defined targets |
| **Action** | **Actions + Deliverables** | The single biggest change. Every action gets coupled with the tangible proof — the artifact, the doc, the rollout, the named system. "I did this, and here's the tangible proof." Without the deliverable, an action is just claim; with it, it's evidence. |
| **Result** | **Result** | Same — the outcome |

**Why:** Established 2026-05-29 after the Collin VP prep workspace shipped with STAR. Jason's words: *"I appreciate using the STAR format, but I prefer the SOAR format. Instead of tasks, it's objectives, and then when we think about actions, I like to couple that with deliverables. I did this, and here's the tangible proof. Good for memory especially for case studies."*

The Action↔Deliverable coupling is the load-bearing change. It forces evidence at every step rather than letting "I led X" or "I built Y" stand as unsupported claim. Maps directly to Jason's [[cos-values]] Evidence-Over-Opinion (6) and Practice-Before-Process (1) — practice is what produced the deliverable; the deliverable is the artifact of the practice.

## How to apply

For each action in the retelling, follow the same pattern:

```
- **Action.** [What Jason did — specific verb, specific scope.]
  - **Deliverable.** [The tangible artifact, doc, system, rollout, named outcome that proves the action happened. If there is no deliverable, the action probably isn't the right grain to surface.]
```

Or in flowing prose: *"I built [action]; the deliverable was [tangible proof]."* / *"I ran [action] — surfaced as [tangible proof]."*

**Examples of good deliverable coupling:**

- *Action: defined a career framework for the team. Deliverable: the framework doc, used as a recruiting tool through the next 18 months of hires.*
- *Action: stood up the Hawkins contribution model. Deliverable: the contribution model spec, the biweekly sprint cadence, the engineering co-ownership rituals.*
- *Action: pushed back on the senior manager's read of my direct report. Deliverable: documented performance evidence used in calibration conversations; values-based feedback delivered in a 1:1 on a specific date.*

**Examples of weak / missing deliverables:**

- *Action: drove alignment.* (No deliverable. Reword the action or drop it.)
- *Action: built relationships.* (No deliverable. Either name the artifact — recurring 1:1s, a shared planning doc — or drop.)
- *Action: managed up effectively.* (No deliverable. Same.)

If you can't name the deliverable, the action is too abstract. Sharpen the action or omit.

## Applies to

- **Interview story bank artifacts** (`02-story-bank.md` in any prep workspace)
- **Case study dossiers** in memory (`cos-case-*.md`) — Jason explicitly named these as a load-bearing use
- **Resume bullets** when producing tailored variants via `resume-tailor`
- **Cover letter body paragraphs** when the evidence beat needs to land in two sentences
- **Networking-message specifics** when describing a past project
- **Project-dossier skill** output
- **Case-study-generator skill** output

## Does NOT apply to

- Pure prose in Jason's voice (cover letter narrative, blog posts) — the SOAR shape would feel mechanical there
- Decision write-ups (different shape — option-set / trade-offs / chosen-path / rationale)
- Daily / weekly / EOD reviews (different cadence)
- Pressure-testing or critique output (different mode)

## Migration

- **Forward-looking:** every new story-bank, case-study, or resume tailoring uses SOAR by default.
- **Backward:** existing `cos-case-*.md` dossiers don't need a mass rewrite, but when one is touched (added to, corrected, re-read for an interview round), refactor its action sections into Action + Deliverable pairs while it's open. Treats migration as opportunistic, not a project.
- **The Collin VP prep `02-story-bank.md` was refactored in-place** on 2026-05-29 immediately after Jason flagged this. Pattern reference for what good SOAR looks like in a story bank.

## Related

- [[cos-values]] — Evidence Over Opinion (6); Practice Before Process (1).
- [[cos-feedback-no-generic-outputs]] — refusing to produce generic outputs. Missing deliverables are a form of generic.
- [[cos-feedback-employer-discretion]] — when generalizing prior-employer specifics, the deliverable can be generalized too ("a career framework document" rather than "the Hootsuite Career Framework v3"); the discipline of naming SOMETHING tangible stays.
