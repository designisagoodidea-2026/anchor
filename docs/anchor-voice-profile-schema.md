---
name: anchor-voice-profile-schema
description: YAML-in-markdown spec for leader voice profiles. The schema each leader's profile follows.
publish: true
metadata:
  type: project
---

## What a voice profile is

A first-class object the rendering layer (Layer 6) reads when producing a leader's digest. The profile encodes the leader's register, vocabulary preferences, framing rules, craft rules, and pushback triggers. The system re-renders the next digest against the updated profile every time the leader edits it.

The voice profile is design substrate, not configuration. Treated the same way the design team would treat a design system spec.

## Storage format

YAML embedded in a markdown file. Editable by hand, version-controllable through the project's git repo, human-readable for the leader who owns it.

## Schema

The profile encodes two registers: **verbal** (prose) and **visual** (tables, charts, reporting visualizations). The renderer reads both on every digest.

```yaml
leader_id: <kebab-case-handle>      # required; matches file basename

register:                           # verbal register — prose output
  terseness: high | medium | low    # affects sentence length
  vocabulary_avoid:                 # words and phrases the leader doesn't want to see
    - word
    - phrase
  vocabulary_prefer:                # map: avoided phrasing → preferred substitute
    avoided_phrase: preferred_substitute
  framing_rules:
    - <named rule>                  # see "rule library" below
  craft_rules:
    - <named rule>
  pushback_triggers:                # patterns the renderer should refuse and re-do
    - <named pattern>

visual_register:                    # visual register — tables, charts, reporting visualizations
  chart_preferences:                # preferred form per signal shape
    trend: sparkline | line | area
    comparison: horizontal_bar | dot_plot | column
    distribution: dot_plot | small_histogram
    proportion: stacked_bar         # avoid pie/donut
  chart_forbidden:                  # chart types the renderer refuses
    - 3d
    - pie
    - donut
    - <other named pattern>
  density: compact | medium | spacious
  color:
    palette: minimal_greyscale | semantic_color | accent_permitted
    semantic_direction: true | false  # green for improving, red for eroding, etc.
  styling:
    gridlines: false | minor_only | full
    redundant_axis_labels: false
    legend: only_when_needed | always | never
    chart_junk_pushback: true       # refuses 3D, gratuitous icons, excessive annotation
  form_selection:                   # overrides for default heuristics
    - "always show capacity as table, even with 10+ people"
    - "never use a chart for a single number"
  evidence_density:
    inline_because_max: 3           # how many supporting events surface inline
    expand_on_click: true           # remaining evidence is one click away
```

## Form-selection defaults

The renderer applies these heuristics unless `visual_register.form_selection` overrides:

- One number or one trend per signal → inline number or sparkline. No chart for a single value.
- 3+ entities compared on the same dimension → horizontal bar, sorted.
- 2+ weeks of history on a signal → sparkline next to the current value.
- Qualitative judgment with an evidence trail → prose with the `because` events surfaced underneath.
- Anchored continuity narrative ("what's changed since last read") → prose. Charts can't carry that the way a sentence can.

## Rule library

Framing rules, craft rules, and pushback triggers are named. The library grows over time; rules are reusable across leaders.

**Framing rules (sample).**

- `lead_with_curiosity_not_assertion` — open with a question or observation, not a claim.
- `ground_in_concrete_examples` — show, don't tell; name the thing.
- `no_company_attribution_for_external_orgs` — never tell an organization what its mission is. See [feedback no company attribution](anchor-feedback-no-company-attribution.md).
- `explain_causality` — every recommendation answers what, why, and what outcome.

**Craft rules (sample).**

- `blank_line_between_paragraphs`
- `blank_line_after_headings`
- `prefer_shorter_sentences`
- `remove_redundant_statements`

**Pushback triggers (sample).**

- `reductive_question_structures` — refuse "what's your X?" patterns.
- `performative_enthusiasm` — refuse "I'm excited / thrilled / passionate" openings.
- `credentialing_words` — refuse "substantive," "actual" as adjectives.
- `chart_junk` — refuse 3D bars, redundant legends, gratuitous icons, dashboard aesthetic.
- `dashboard_aesthetic` — refuse the "snapshot dashboard" pattern; Anchor is not a dashboard.

## File layout

```
/voice-profiles/
  schema.md                       # this doc
  jason-armstrong.md              # first leader profile
  <next-leader>.md                # second, third, ...
```

Profiles are siblings, not children. Flat structure; one file per leader.

## Hard rule

The renderer applies the same craft to its own output that it expects from the design team. If it can't render in the leader's voice — banned vocabulary present, framing rule violated, pushback trigger matched — it surfaces the failure rather than falling back to neutral SaaS language.

## Related

- [voice profile jason](anchor-voice-profile-jason.md) — first instance of this schema.
- [architecture](anchor-architecture.md) — Layer 6 (Voice and rendering) consumes this schema.
- [feedback disliked words](anchor-feedback-disliked-words.md) — feeds `vocabulary_avoid` for Jason's profile.
- [feedback curious not credentialing](anchor-feedback-curious-not-credentialing.md) — feeds framing rules.
- [feedback paragraph spacing](anchor-feedback-paragraph-spacing.md) — feeds craft rules.
