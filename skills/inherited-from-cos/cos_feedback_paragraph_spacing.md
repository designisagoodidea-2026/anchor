---
name: cos-feedback-paragraph-spacing
description: "Jason prefers blank lines between paragraphs and after headings/subheads in any artifact written for him. The Apps Script cover-letter populate workflow collapses paragraph spacing by default; bodyParagraphs[] arrays must include empty-string spacers to preserve the blank line. Applies broadly across cover letters, docs, briefings, memos, and weekly reviews."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c81fb377-9a8b-4c4a-8301-99ce24795f9b
---

**Rule:** In any artifact written for Jason — cover letters, docs, memos, briefings, weekly reviews, anything with visual paragraph structure — preserve blank lines between paragraphs and after headings or subheadings. Jason prefers an open visual rhythm; dense single-line-break formatting reads as cramped.

**Why:** Established 2026-05-27 after the cover-letter Apps Script populate workflow collapsed paragraph spacing in both the Google Home and Google Payments drafts. Jason's words: *"every time you write to the cover letter, you lose my preferred double line break, which creates an empty single line."*

## How to apply

### For the Apps Script populate workflow (cover letters)

Insert empty-string entries between substantive paragraphs in the `bodyParagraphs[]` array of the JSON command. The Apps Script library writes each array element as its own Doc paragraph, so empty strings produce visible blank lines.

Canonical shape:
```json
"bodyParagraphs": [
  "Paragraph 1 substantive text...",
  "",
  "Paragraph 2 substantive text...",
  "",
  "Paragraph 3 substantive text...",
  "",
  "Paragraph 4 substantive text..."
]
```

### For markdown / plain-text outputs

Use `\n\n` between paragraphs. Don't separate content blocks with a single `\n`. This applies to:
- Daily briefings (chat output + email body)
- EOD reviews
- Weekly reviews
- Memos written into the workspace
- Any draft body delivered in chat for Jason to copy-paste

### For .docx / .pdf outputs via the skills

Include explicit blank paragraphs between content blocks, or use paragraph-spacing styles that produce visible vertical separation. Don't rely on the default — defaults tend to read tight.

### For headings and subheads

Always include a blank line between the heading and the body content that follows. Avoid "heading immediately followed by paragraph" — it reads cramped.

## Structural alternative for the cover-letter Apps Script

The current workaround (empty strings in `bodyParagraphs[]`) achieves the visual goal but is a per-call concern. A more durable fix would be modifying `fillCoverLetter()` / `replaceCoverLetterBody()` in [`CoverLetterLibrary.gs`](https://script.google.com/) to automatically insert blank paragraphs between substantive `bodyParagraphs[]` entries. That removes the need for callers to remember the spacer pattern.

Until that script update happens, the spacer pattern in `bodyParagraphs[]` is the contract.

## Applies to

- `cover-letter`
- `daily-briefing` (chat + email body)
- `eod-review`
- `weekly-review`
- `weekly-plan`
- any memo, brief, doc, or draft written for Jason

## Related

- [[cos-feedback-populate-drive-docs]] — the Apps Script workflow's command shape; the spacer pattern is now part of the canonical shape there.
- [[cos-output-conventions]] — default formats by deliverable type; this rule is the typographic discipline that applies regardless of format.
