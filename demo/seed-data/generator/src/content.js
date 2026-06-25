// Anchor seed generator — content pools.
//
// Pools of phrases for each event type and verbosity bucket. The composer
// picks from the appropriate bucket and personalizes with substitutions
// (project name, persona, occasional decision-tagged framing). Kept
// generic — nothing here names a real company, person, or product.

// ─── Figma comment pools ───────────────────────────────────────────────────

const FIGMA_COMMENTS_TERSE = [
  "Spacing's tight here.",
  "Why this color?",
  "Should this be a button?",
  "Does this work on mobile?",
  "Where does this go on tap?",
  "Loading state?",
  "Empty state?",
  "Long label?",
  "Truncation?",
  "Accessibility — focus order?",
];

const FIGMA_COMMENTS_VERBOSE = [
  "I'm not sure the hierarchy reads correctly here — the title and the chip feel like they're competing. Could we try the chip in caption-size to let the title carry the weight on its own?",
  "Stepping back for a second — what's the user really trying to learn at this point in the flow? If it's just 'what changed', the diff block might be enough on its own without the explanatory paragraph above.",
  "Love this direction. Two things I want to push on: the empty state needs a primary action (right now there's nothing to click), and the disabled state probably needs to explain why it's disabled.",
  "This is reading as the same component as the one in {{project}}'s overview screen, but the behavior is different on tap. Worth either unifying or pulling them apart visually so nobody learns the wrong mental model.",
  "I think we're solving a real problem here but the framing might be off — the current header implies it's about settings, when it's really about preferences. Small word, different mental model.",
];

const FIGMA_COMMENTS_DECISION = [
  "Going with option B. Reasoning: it holds up for the multi-account case without restructuring the nav. [decision]",
  "Decided to drop the inline editing pattern. Too much hidden behavior for first-time users. [decision]",
  "Picking the single-column layout. The two-column version doesn't survive on smaller laptops. [decision]",
  "Holding the redesign at this milestone. Next iteration only after we ship the accessibility fixes. [decision]",
];

// ─── Slack message pools ───────────────────────────────────────────────────

const SLACK_MESSAGES_TERSE = [
  "ack",
  "lgtm",
  "+1",
  "got it",
  "will do",
  "ship it",
  "fwiw I prefer A",
  "questions in the thread",
  "let's chat tomorrow",
  "joining late",
];

const SLACK_MESSAGES_VERBOSE = [
  "Took another pass at the {{project}} flow this morning and I think the new error-state pattern is solid, but I want a second set of eyes before I push it to the team file. Anyone free in the next hour?",
  "Quick context for folks who weren't on the {{project}} call yesterday: we're treating the v2 layout as the source of truth from this week forward. Old comps will get archived to /retired but won't be deleted in case we need to reference them later.",
  "Re: the {{project}} component naming discussion — I've been going back and forth and I think we should keep the existing names rather than rename mid-flight. The cost of renaming is borne by everyone consuming the lib, the value mostly accrues to people writing it. Asymmetric.",
];

const SLACK_MESSAGES_DECISION = [
  "Decision from the {{project}} sync: we're shipping the simplified version. Full multi-step flow gets parked. [decision]",
  "Calling it on {{project}} — we go with the toolbar pattern, not the floating action button. [decision]",
  "We're keeping the legacy auth screen for now. Won't touch it this quarter. [decision]",
  "Locked: {{project}} v1 ships with the three states, not five. The other two are post-launch. [decision]",
];

const SLACK_MESSAGES_PM = [
  "Need decisions on {{project}} by EOD.",
  "{{project}} review moved to Thursday.",
  "Who owns the {{project}} acceptance criteria?",
  "{{project}} milestone slipping — flagging.",
  "PRD draft up for {{project}}, comments welcome.",
];

// ─── Cowork document pools (file body content) ─────────────────────────────

const COWORK_DOC_TITLES = {
  decision: [
    "decision-{{slug}}-direction.md",
    "decision-{{slug}}-scope.md",
    "decision-{{slug}}-pattern.md",
  ],
  prototype: [
    "{{slug}}-prototype-v{{n}}.md",
    "{{slug}}-explorations.md",
    "{{slug}}-flow-notes.md",
  ],
  doc: [
    "{{slug}}-overview.md",
    "{{slug}}-spec.md",
    "{{slug}}-acceptance.md",
    "{{slug}}-research-notes.md",
  ],
  crit: [
    "{{slug}}-crit-notes.md",
    "{{slug}}-review-feedback.md",
  ],
};

const COWORK_DOC_BODIES = {
  decision: [
    "[decision] Going with the inline pattern.\n\nThe modal flow tested worse than expected — users described it as 'a wall'. Inline keeps the action in context without ripping them out of the surface.\n\nNext: update the components in the team file, write a one-paragraph note in the design system page.",
    "[decision] Holding the {{project}} migration until next sprint.\n\nThe component-library refactor needs to land first; otherwise we'd be migrating to a moving target. Cost of waiting is one extra week; cost of not waiting is doing the work twice.",
    "[decision] Single source of truth: the team file, not the personal files.\n\nEveryone's been autosaving into personal drafts and the team file has drifted. From this week, only team-file changes count. Personal drafts are scratch.",
  ],
  prototype: [
    "## {{project}} prototype v{{n}}\n\nFresh pass on the flow. Three changes from last week:\n\n- Primary CTA moved to the right of the header so it doesn't compete with the back button.\n- Loading state behaves correctly now (previously skipped straight to success).\n- Error state has a recovery path instead of a dead end.\n\nWorth showing in the next crit.",
    "## Explorations\n\nFour shapes for the empty state. Need to pick one before the review.\n\nA. Just a label and an icon.\nB. Label, icon, and a primary CTA.\nC. Walkthrough card with three steps.\nD. Nothing — let the surrounding chrome carry it.\n\nLeaning B but it depends on whether we expect users to see this state more than once.",
  ],
  doc: [
    "## Overview\n\nThe goal of {{project}} is to reduce time-to-first-value for new accounts. Right now the gap between signup and the first meaningful action is too wide and we lose people in the middle.\n\nThree intervention points:\n\n1. Inline guidance on the home view.\n2. A simplified second-day surface that promotes the next action.\n3. A 'pick up where you left off' pattern that holds across sessions.\n",
    "## Acceptance criteria\n\nFor a {{project}} change to ship:\n\n- The component carries the standard focus-visible treatment.\n- The label survives translation up to 1.6x English length.\n- The empty, loading, error, and success states are all designed (not just the happy path).\n- The interaction is documented in a one-paragraph component note.\n",
  ],
  crit: [
    "## {{project}} crit notes\n\nOpen questions from the room:\n\n- Is the chip on the third card a hover state or a permanent affordance? Read as both.\n- The animation on the secondary card feels a beat too long. Worth tuning.\n- The footer has a 'learn more' link that wasn't in the brief — confirm it belongs.\n\nResolutions:\n\n- Chip → permanent.\n- Animation → halve duration.\n- 'Learn more' → drop for v1.\n",
  ],
};

// ─── Public helpers ────────────────────────────────────────────────────────

/**
 * Pick a random element from an array, weighted optionally.
 * @template T
 * @param {T[]} arr
 * @returns {T}
 */
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Substitute {{project}} / {{slug}} / {{n}} placeholders. Tolerant.
 * @param {string} s
 * @param {Record<string, string|number>} subs
 */
function fill(s, subs) {
  return s.replace(/\{\{(\w+)\}\}/g, (_, k) => String(subs[k] ?? `{{${k}}}`));
}

/**
 * @param {{ verbosity: number, decision: boolean, project: string }} ctx
 */
export function figmaCommentBody(ctx) {
  if (ctx.decision) return fill(pick(FIGMA_COMMENTS_DECISION), { project: ctx.project });
  const pool = ctx.verbosity > 0.65 ? FIGMA_COMMENTS_VERBOSE : FIGMA_COMMENTS_TERSE;
  return fill(pick(pool), { project: ctx.project });
}

/**
 * @param {{ verbosity: number, decision: boolean, project: string, pmStyle?: boolean }} ctx
 */
export function slackMessageBody(ctx) {
  if (ctx.decision) return fill(pick(SLACK_MESSAGES_DECISION), { project: ctx.project });
  if (ctx.pmStyle) return fill(pick(SLACK_MESSAGES_PM), { project: ctx.project });
  const pool = ctx.verbosity > 0.6 ? SLACK_MESSAGES_VERBOSE : SLACK_MESSAGES_TERSE;
  return fill(pick(pool), { project: ctx.project });
}

/**
 * @param {{ kind: "decision"|"prototype"|"doc"|"crit", slug: string, project: string, n?: number }} ctx
 * @returns {{ filename: string, body: string }}
 */
export function coworkDoc(ctx) {
  const n = ctx.n ?? Math.floor(Math.random() * 4) + 1;
  const filename = fill(pick(COWORK_DOC_TITLES[ctx.kind]), { slug: ctx.slug, n });
  const body = fill(pick(COWORK_DOC_BODIES[ctx.kind]), {
    slug: ctx.slug,
    project: ctx.project,
    n: String(n),
  });
  return { filename, body };
}
