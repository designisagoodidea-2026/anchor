---
name: cos-feedback-no-generic-outputs
description: "Rule for every skill that produces outputs in Jason's voice (cover letters, recruiter outreach, networking messages, LinkedIn DMs, email replies, intro requests). Never generate something the reader will pattern-match as generic AI slop. Force specific inputs before producing. Reward the reader."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: e23eb99c-920c-4813-a195-79c71f997038
---

**Rule:** Skills that produce outputs in Jason's voice must require **specific personal inputs** before drafting — a hook, a relationship, an experience, a story — and must refuse to draft on assertion-and-credentials alone.

**Why:** Jason called this out explicitly on 2026-05-18 after reviewing the first cover-letter skill draft: "the cover letter generator continues to need the job description input, as well as an input from me about experiences or values I want to highlight (relevant to the role), and also should ask for some kind of input that can make the cover letter feel personalized — ideally something specific to my relationship with the hiring manager, or an experience with the company/brand, or some other personal story that can be used to tailor the cover letter and avoid the generic AI slop for cover letters. reward the reader."

The reader is a senior design leader or recruiter with pattern recognition for AI-generated outreach. A generic letter or message gets discounted as soon as the first formulaic sentence lands. The personal hook is the proof of human craft; without it, the rest of the output doesn't get credit for its substance.

**How to apply:**

When building or running any skill that drafts in Jason's voice:

1. **Require three inputs minimum:** the situation (JD, target company, recipient), the highlight ask (what experiences or values from [[cos-values]] / [[cos-case-studies]] Jason wants surfaced for this specific situation), and a personal hook (specific to this recipient/company/moment).

2. **Refuse to proceed without the personal hook.** "I respect the company" is not a hook. "I've used the product for years" is barely one — needs a specific moment or insight. Best hooks are 1–2 sentences no other applicant or sender could write.

3. **Pre-propose candidate hooks from memory before asking.** Check [[cos-network-warm]] for warm contacts at the company; check [[cos-target-companies]] for prior context; check Jason's resume / case studies for relevant brand-touchpoint moments. Surface 2–3 candidate hooks for Jason to pick from or override, rather than asking cold.

4. **If Jason can't articulate a personal hook for a given application, surface that as signal** — the application may not be worth sending, or needs research before it can be sent.

5. **Avoid the generic slop patterns explicitly:**
   - "I am writing to apply for…"
   - "I am passionate about…"
   - "Your company's mission aligns with my values…"
   - "I would bring a unique perspective…"
   - "I am excited about the opportunity to…"
   - Generic adjectives stacked without evidence ("innovative," "passionate," "results-driven," "strategic thinker")
   - **Describing the JD, role, company, or product back to them.** The application IS the bridge between Jason and the role; don't narrate that bridge. ("This role focuses on X" / "Superhuman is building Y" / "Your product helps users do Z" are all this defect.) Broadened 2026-05-22 from "restating the JD" after the Collin cover-letter draft slipped in a "philosophy of Superhuman" line and got rejected.
   - **Soft JD-bridges are the same defect.** "This role feels strongly connected to my experience" / "The challenges described in the posting resonate" — still describing the JD back. Cut them.
   - Closing with "I look forward to hearing from you" or "happy to chat"

6. **Reward the reader.** A good output gives the reader one specific thing they didn't expect — a sharp observation about their company's recent move, a named moment from Jason's experience that maps to their problem, a referenced person or talk or product feature. The reward is the proof of attention.

7. **Voice rule for verbs:** prefer concrete, plain verbs over corporate ones. "building out" beats "investing in." "shipped" beats "delivered impact." "ran" beats "led an initiative." When in doubt, ask whether the verb describes a visible action or a corporate posture.

**Applies to:** cover-letter, recruiter-outreach, network-mapper outreach drafts, LinkedIn DM replies, any email reply drafted on Jason's behalf, intro request drafts. Does NOT apply to internal artifacts (memory entries, scheduled-task prompts, system documentation) — those should be plainly clear, not stylized.

## Cover-letter template — structural fact (don't damage the doc)

The Drive cover-letter template puts **recipient, company, greeting, body, closing, and signature all inside the SAME table cell** — not separate cells. Mid-session 2026-05-21 the assistant wrongly assumed they were separate cells and damaged the working template doc. The fix: a fresh Drive copy (`1OvKJMcRXFGdMad-2XzOH1KFENmw_dsOroIRPtfJz1Jo`) replaced the damaged original.

**How to apply:**
- When editing a cover-letter draft programmatically (Apps Script `replaceCoverLetterBody_`), scope the edit by a `bodyAnchor` phrase within the single cell. Do NOT walk the table structure assuming row/cell boundaries align with letter sections.
- The Apps Script cover-letter implementation lives as a **library + per-role wrapper** in Jason's Apps Script project: durable functions `fillCoverLetter_(cfg)` and `replaceCoverLetterBody_(cfg)` are private (underscored) so the Run dropdown only surfaces the wrappers. Per-role wrappers shrink to ~12 lines. Future cover-letter sessions emit only the wrapper, never a fresh standalone script.
- Iteration on a draft is a first-class operation, not a fix-script. The library's `replaceCoverLetterBody_` is the iteration entry point.

## Exception: transactional recruiter touches

**Rule:** A transactional message to a recruiter — thank-you after a screen, scheduling acknowledgments, "looking forward to next week" — should be brief and warm, **without** the named personal hook. Hook material is reserved for the substantive interview audience (hiring manager, VP, panel).

**Why:** Jason flagged this 2026-05-21 on the Jordan Abernathy (Superhuman) thank-you. Three drafts each carried a substantive hook in the second paragraph (Hawkins → Critical User Journey; Hootsuite acquisitions analog; designer-as-customer framing). Jason rejected all three with "too contrived, and not appropriate for the recruiter — that's material for Kevin next week." A recruiter thank-you that opens a substantive case reads as posturing to the wrong audience and burns the freshness of the hook before it reaches the person it's actually meant for.

**How to apply:**
- Recruiter thank-yous: one short paragraph. Thank them, acknowledge whatever logistical thing just happened, signal readiness for the next step. Stop.
- Save the named hook (Hawkins / Hootsuite / DesOps platform / etc.) for the hiring-manager round and beyond — those are the audiences whose attention the hook is designed to earn.
- The "specific personal inputs" requirement above still applies to cover letters, hiring-manager outreach, networking messages, and intro requests. It does NOT apply to recruiter thank-you / scheduling-thread replies, which should default to brief-and-warm.
