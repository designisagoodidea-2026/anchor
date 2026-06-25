# Layer 6 — Voice and rendering

Stub. Week 1 outcome: voice profile schema written; Jason's profile populated. Week 3: rendering live, banned vocabulary refused.

## Role

Render the digest in the leader's preferred register — across prose, tables, and reporting visualizations.

## Inputs

Diff records from [layer 5 diff memory](layer-5-diff-memory.md). Leader voice profile from `/voice-profiles/<leader-handle>.md`.

## Outputs

Two surfaces:

- **Daily digest** rendered to markdown (pilot 1, per [adr 04](adr-04-jira-pilot-1-coda-removed.md)). Hosted target (web view / email / Slack canvas / Notion) decided at pilot 2.
- **Friday narrative summary** rendered as `.md`, sendable as email.

Both rendered against the voice profile; both honor the verbal register (framing rules, craft rules, pushback triggers) AND the visual register (chart types, density, styling, when to reach for which form).

## Output forms

The digest is mixed. The renderer picks the form that carries each signal honestly:

- **Prose** — narrative paragraphs in the leader's voice. Default for qualitative signals, framing, recommendations, anchoring against the prior read, and the Friday narrative summary's connective tissue.
- **Tables** — compact, structured. Default when a signal names more than three entities (people, projects, principles). Capacity-per-person across a six-person team is a table, not six paragraphs.
- **Reporting visualizations** — sparklines, small bar charts, dot plots, simple distribution shapes. Default when the signal carries trend, comparison, or magnitude that lands faster as a shape than as a number. Health-trend week-over-week is a sparkline; capacity-by-team is a horizontal bar chart; principle-drift across a week is a dot plot.

The form follows the substance. A signal doesn't get a chart because charts are "engaging"; it gets a chart because the chart is the most honest carrier for that signal's shape.

## Form-selection heuristics (default; overridable in the voice profile)

- **One number or one trend per signal** → inline number or sparkline. Don't build a chart for a single value.
- **3+ entities being compared on the same dimension** → horizontal bar chart, sorted.
- **2+ weeks of history on a signal** → sparkline next to the current value.
- **Qualitative judgment with an evidence trail** → prose with the `because` events surfaced underneath.
- **Cross-signal comparison for one container** → a small multiples grid (Stage 2+; v0.1 keeps each signal in its own block).
- **Anchored continuity narrative** → prose. Charts can't carry "what's changed since you last read this" the way a sentence can.

## Rendering pipeline

1. Pull the voice profile.
2. For each signal in the diff: select the form (prose, table, chart) per the heuristics above and the profile's visual register.
3. Compose the substance from the `because` and `delta_narrative` fields.
4. Render verbal output:
   - Run the pushback triggers — if any trigger matches the draft, refuse and re-render.
   - Run the vocabulary filter — if any banned word appears, refuse and re-render.
   - Apply the craft rules (paragraph spacing, sentence-length preference).
5. Render visual output:
   - Apply the leader's visual register (chart style, density, color, gridlines).
   - Refuse chart-junk patterns the profile excludes (3D bars, redundant legends, gratuitous icons).
   - Annotate each visual with its `because` reference (click-through to evidence).
6. Compose the mixed output (prose + tables + charts) in the surface's native format.
7. Publish to the surface (markdown file at pilot 1; hosted target decided at pilot 2 per [adr 04](adr-04-jira-pilot-1-coda-removed.md)).

## Visual register — what the voice profile encodes

The profile carries (see [voice profile schema](../docs/anchor-voice-profile-schema.md) for the full schema):

- **Chart preferences.** Preferred chart types per signal kind (e.g., trend → sparkline; capacity comparison → horizontal bar; principle drift → dot plot). Forbidden chart types (3D, pie, anything that obscures the data).
- **Density.** Compact vs. spacious. Affects table row padding, chart padding, label sizing.
- **Color and styling.** Minimal vs. permission for accent color. Greyscale-by-default vs. semantic color (green/red for direction). Gridlines on/off. Axis labels included/dropped where redundant.
- **Form-selection overrides.** Leader can override the default heuristics: e.g., "always show capacity as a table, never a chart, even when the team has 12 people."
- **Density of `because` references.** How many supporting events surface inline versus on click-through.

The visual register is design substrate, edited the same way the verbal register is.

## Hard rule

The system applies the same craft to its own output that it expects from the design team. If it can't render in the leader's voice — banned vocabulary present, framing rule violated, visual register violated, chart-junk pattern matched — it surfaces the failure rather than fall back to neutral SaaS language.

Concretely: a failed render emits a `render_failed` event with the failing rule named. The leader sees "Anchor refused to render this week's capacity signal because [reason]" rather than a softened dashboard-style fallback.

## The voice profile as design substrate

The profile is a first-class object. Leaders edit theirs as YAML-in-markdown checked into the repo. The system re-renders the next digest against the updated profile. The profile is not configuration; it's substrate, treated the same way the design team would treat a design system spec.

The visual register inherits this status. If a leader switches from "minimal greyscale" to "permission for accent color," the next digest renders against the change. The renderer doesn't ask; it reads the profile and renders.

## Voice profile schema

See [voice profile schema](../docs/anchor-voice-profile-schema.md).

## First profile

See [voice profile jason](../docs/anchor-voice-profile-jason.md). The Jason profile is the v0.1 demonstration of the layer.

## Rendering pipeline

1. Pull the voice profile.
2. For each signal in the diff: compose the substance from the `because` and `delta_narrative` fields.
3. Run the pushback triggers — if any trigger matches the draft, refuse and re-render.
4. Run the vocabulary filter — if any banned word appears, refuse and re-render.
5. Apply the craft rules (paragraph spacing, sentence-length preference).
6. Publish to the surface (Coda page, Airtable record, email body).

## Hard rule

The system applies the same craft to its own output that it expects from the design team. If it can't render in the leader's voice — banned vocabulary present, framing rule violated, pushback trigger matched — it surfaces the failure rather than fall back to neutral SaaS language.

Concretely: a failed render emits a `render_failed` event with the failing rule named. The leader sees "Anchor refused to render this week's digest because [reason]" rather than a softened SaaS-style fallback.

## The voice profile as design substrate

The profile is a first-class object. Leaders edit theirs as YAML-in-markdown checked into the repo. The system re-renders the next digest against the updated profile. The profile is not configuration; it's substrate, treated the same way the design team would treat a design system spec.

## v0.2 surface — markdown (pilot 1)

Per [adr 04](adr-04-jira-pilot-1-coda-removed.md), pilot 1 reads the digest as markdown during the 1:1 walkthrough. The hosted rendering target (web view at `anchor.app/digest/<tenant>`, email push, Slack canvas, or Notion) is decided when pilot 2 surfaces. Coda's combined-container-and-renderer role is retired.

## Future surfaces (Stage 2+)

- Slack DM (the digest as a daily DM).
- Email (already partially supported via Apps Script bridge).
- Custom React surface (Stage 3+).

## Related

- [layer 5 diff memory](layer-5-diff-memory.md) — produces input.
- [voice profile schema](../docs/anchor-voice-profile-schema.md) — schema spec.
- [voice profile jason](../docs/anchor-voice-profile-jason.md) — first profile.
- [feedback disliked words](../docs/anchor-feedback-disliked-words.md) — banned vocabulary list.
- [feedback paragraph spacing](../docs/anchor-feedback-paragraph-spacing.md) — craft rules.
- [feedback curious not credentialing](../docs/anchor-feedback-curious-not-credentialing.md) — framing rules and pushback triggers.
- [feedback no company attribution](../docs/anchor-feedback-no-company-attribution.md) — framing rule.
- [feedback no generic outputs](../docs/anchor-feedback-no-generic-outputs.md) — specificity rule.
