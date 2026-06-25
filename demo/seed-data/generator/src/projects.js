// Anchor seed generator — project pool.
//
// Five synthetic bodies of work. Each carries a lifecycle state that
// drives how the timeline weights its events — kickoff projects skew
// toward exploration and decisions, winding-down projects fade across
// the run, newly-appearing projects show up partway through.
//
// Synthetic Figma file keys and Slack channel ids are chosen to look
// plausible but are not real. Cowork path prefixes point under
// demo/seed-data/projects/<slug>/ — the generator creates these on disk.

/** @typedef {import('./shared').Project} Project */

const SEED_ROOT = "demo/seed-data/projects";

/** @type {Project[]} */
export const PROJECTS = [
  {
    slug: "search-ux",
    name: "Search UX",
    // Real teams name things slightly differently across tools. Aliases
    // capture the drift — the Figma file might be "Search redesign", the
    // Slack channel might be "#search-2026", folks talk about all three.
    aliases: ["Search redesign", "Search 2026"],
    state: "active",
    figma_file_key: "fkSearchUx0001",
    slack_channel: "C0SEARCHUX01",
    cowork_path_prefix: `${SEED_ROOT}/search-ux`,
  },
  {
    slug: "onboarding",
    name: "Onboarding redesign",
    aliases: ["Onboarding v2", "OB redesign"],
    state: "review",
    figma_file_key: "fkOnboarding001",
    slack_channel: "C0ONBOARD0001",
    cowork_path_prefix: `${SEED_ROOT}/onboarding`,
  },
  {
    slug: "settings-polish",
    name: "Settings polish",
    aliases: ["Settings cleanup"],
    state: "winding_down",
    figma_file_key: "fkSettingsPol01",
    slack_channel: "C0SETTINGS001",
    cowork_path_prefix: `${SEED_ROOT}/settings-polish`,
  },
  {
    slug: "native-mobile",
    name: "Native mobile",
    aliases: ["Mobile app", "iOS / Android"],
    state: "kickoff",
    figma_file_key: "fkNativeMobl001",
    slack_channel: "C0NATIVEMOB01",
    cowork_path_prefix: `${SEED_ROOT}/native-mobile`,
  },
  {
    slug: "q3-roadmap",
    name: "Q3 roadmap",
    aliases: ["Q3 planning"],
    state: "newly_appearing",
    figma_file_key: "fkQ3Roadmap001",
    slack_channel: "C0Q3ROADMAP01",
    cowork_path_prefix: `${SEED_ROOT}/q3-roadmap`,
  },
];

/**
 * Probabilistically pick a name variant for a project. Most of the time
 * returns the canonical name; occasionally returns an alias so messages
 * and file titles carry the cross-tool name drift real teams have.
 * @param {Project} project
 * @param {number} alias_rate  0..1 — probability of picking an alias.
 */
export function projectNameVariant(project, alias_rate = 0.2) {
  if (!project.aliases?.length) return project.name;
  if (Math.random() > alias_rate) return project.name;
  return project.aliases[Math.floor(Math.random() * project.aliases.length)];
}

/** Look up a project by slug. */
export function getProject(slug) {
  const p = PROJECTS.find((x) => x.slug === slug);
  if (!p) throw new Error(`Unknown project ${slug}`);
  return p;
}

/**
 * Lifecycle-state multiplier on a project's event count. Used by the
 * timeline composer to skew density toward active work.
 * @param {Project["state"]} state
 */
export function lifecycleWeight(state) {
  switch (state) {
    case "kickoff":          return 1.0;
    case "active":           return 1.3;
    case "review":           return 1.5; // crit-heavy week
    case "winding_down":     return 0.5;
    case "newly_appearing":  return 0.7; // appears partway, lower overall
  }
}
