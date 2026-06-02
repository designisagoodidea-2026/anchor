# ADR 03 — Layer 5 state storage and diff shape

**Status:** drafted 2026-06-02. Implementation in `layer-5/` follows once the decision is signed.

**Decision:** local JSON state per leader for v0.1 (Coda/Airtable adapters deferred until Stage 2 pilots produce multi-leader state). Diff computation as a pure function over `Signal[]` and the prior state snapshot. Renderer integration via a new anchored opening section that precedes the current-window signals. Flag interaction surface deferred — v0.1 reads flags from state if present, doesn't write them.

## Context

Layer 5 is the differentiator. The architecture sentence "here's what was true the last time you read this, here's what's moved, here's the question worth asking" doesn't render until the system stores per-leader state between reads and the renderer anchors against it. Without Layer 5, the digest is a one-shot report — same shape as every other dashboard the product was built to replace.

Three things have to be decided before any code lands. Each one is a fork that paints the rest of the work into a corner if it's wrong.

**Where does state live?** Layer 3 set the dual-adapter pattern (Coda primary, Airtable mirror) for the leader-declared container mapping. Reusing that pattern for Layer 5 state is the obvious move and provides surface symmetry. But Layer 3 reads a leader-declared mapping — that's config. Layer 5 writes operational state continuously — different access pattern, different durability requirements, different failure modes. A Coda dependency for state means every digest run requires Coda reachability; a local JSON file makes Layer 5 self-contained.

**What's the diff computation contract?** Given a fresh `Signal[]` from Layer 4 and a prior snapshot, what shape do we hand to the renderer? The Layer 5 stub at `architecture/layer-5-diff-memory.md` sketches a record with `prior_value`, `current_value`, `delta`, `delta_narrative`, and `prior_flags`. That sketch is close to right; it needs to be turned into a concrete TypeScript interface and the `delta` enum needs values.

**What does "changed" mean per signal?** A capacity state moving from `sustained` to `surge` is obviously changed. But a capacity that stayed `surge` with event count growing from 12 to 15 — is that "no change" or "still drifting in the same direction"? The honesty rule says: name the change, but don't fake newness. The threshold needs to be calibrated per signal.

## Decision

### 1. State storage — local JSON for v0.1

State lives at `state/<leader-id>.json`, default `state/jason.json`. The file format is JSON; the load and write paths are wrapped behind a `StateSource` interface in `layer-5/src/storage.ts` so that Stage 2 can plug in Coda and Airtable adapters without changing diff or renderer code.

The decision is informed by three observations:

Jason is the only leader at v0.1. Multi-leader state is a Stage 2 concern; building for it now is overhead without payoff.

State writes are continuous (every digest run); state reads are point-in-time (every digest run reads its own prior state). Both happen on the same machine. A local file has no network round trip and no external-service failure mode.

The dual-adapter pattern in Layer 3 has a purpose: leaders configure their containers in the tool they already use. State is internal — the leader doesn't edit prior snapshots by hand. There's no symmetric reason to mirror it in Coda.

When Stage 2 pilots arrive, the `StateSource` interface gets a Coda adapter alongside the local-JSON adapter. Same shape Layer 3 uses today.

### 2. Diff computation — pure function

```typescript
interface Diff {
  container_id: string;
  container_name: string;
  signal_kind: SignalKind;
  /** Identifies the entity within the signal (e.g., person id for capacity, principle id for drift, "" for health-trend). */
  signal_subject: string;
  prior_value: SignalValueSnapshot | null;
  current_value: SignalValueSnapshot;
  delta: DeltaKind;
  delta_narrative: string;
  /** Leader's prior response on this same subject, if any. */
  prior_flag: Flag | null;
  /** ISO timestamp the prior read happened. */
  prior_read_at: string | null;
}

type DeltaKind =
  | "first_read"          // No prior state for this subject.
  | "no_change"           // Subject moved within the calibrated "same" tolerance.
  | "changed"             // State or value moved past the tolerance.
  | "newly_appeared"      // Subject didn't exist in the prior snapshot at all.
  | "resolved";           // Subject existed prior but is gone or back to no_signal now.

interface SignalValueSnapshot {
  /** State enum from the signal's value (e.g., "surge", "improving", "drifting"). */
  state: string;
  /** Coarse numeric summary used for change detection. Defined per signal kind. */
  magnitude_score: number;
  /** Timestamp the read was computed. */
  computed_at: string;
}
```

`computeDiffs(current: Signal[], priorState: State): Diff[]` is pure. Inputs are the current Layer 4 signal set and the prior state read from storage; output is one diff record per (subject, signal_kind) pair seen in either snapshot. The renderer reads diffs, not raw signals.

After `computeDiffs` runs, the renderer or a separate `commitState` call writes the new snapshot back to storage. v0.1 commits unconditionally; Stage 2 may add a "only commit if the leader actually read this" semantic.

### 3. Change tolerances per signal

The honesty rule: name change, don't fake newness. The "did this move enough to call it a change?" threshold lives in code at v0.1, calibration-tuned per leader at Stage 2.

**Capacity.** State change always counts (sustained → surge). Same-state with event count within ±25% of prior count counts as `no_change`. Same-state outside that band counts as `changed`.

**Health-trend.** Trend value change always counts (improving → eroding). Same-trend with kind-weighted score within ±15% of prior counts as `no_change`. Same-trend outside that band counts as `changed`.

**Drift.** State change always counts (compliant → drifting). Same-state with the same set of unsatisfied principle triggers counts as `no_change`. Same-state with new unsatisfied triggers counts as `changed`.

All three are draft thresholds, refined against real read history.

### 4. Renderer integration — anchored opening section

The digest currently opens with the header and goes straight to the capacity section. After Layer 5 lands, the digest opens with one or two anchored paragraphs before the signal sections:

If the prior state had any `watched` subjects, the digest opens by reporting on each: what moved, what didn't.

If any subject transitioned to `resolved`, the digest names them next — good news, surfaced explicitly.

Then the per-signal sections render with diff-aware framing: `newly_appeared` items get the existing framing; `changed` items lead with "Up from X to Y" or "Moved from sustained to surge"; `no_change` items render as a single line ("AI Search health-trend: no change since Friday") rather than the full multi-line block.

The honesty rule binds the rendering: `no_change` doesn't get a paragraph; `first_read` doesn't pretend to anchor against nothing.

### 5. Flag interaction surface — deferred

The state schema supports `flags` (per-subject leader responses: acknowledge / dismiss / watch). v0.1 does not build the surface that produces flags. The leader can hand-edit the state file if testing flag carryover is useful for the demo; the real flag-capture surface (Coda comments, Slack threaded responses, email replies) is a Stage 2 build.

The reason: building a flag-capture surface requires picking *which* surface, which depends on which tool the leader is operating from. That's a pilot-leader decision, not a Jason-first decision.

## Trade-offs

For local JSON state:

- No external dependency at v0.1. The diff layer runs offline.
- Trivially debuggable — the state is one file, human-readable.
- The `StateSource` interface keeps the door open for Coda/Airtable adapters without diff or renderer code changes.

Against:

- Single-machine state. If Jason runs the digest from two machines, prior reads diverge. Not a real concern for v0.1; flagged as a Stage 2 design point.
- No history beyond the most recent snapshot. v0.1's storage is "current state only"; a versioned history requires either rolling JSON files or moving to Coda. The Friday narrative summary works against a week of snapshots — see point below.

For pure-function diff:

- Same shape as Layer 3 and Layer 4. Testable without I/O. Replayable against fixtures.

Against:

- The renderer needs to call `commitState` after rendering. That's a side effect that lives outside the pure pipeline. Tractable.

## Friday narrative summary

The Friday narrative summary operates over a week of diffs, not a single diff. Implementation: the state file gains a `weekly_log` array — a rolling buffer of the last seven daily diff snapshots. Each daily digest run appends to it; the Friday narrative reads the whole buffer and composes prose.

The buffer is cheap (a week of diffs is small). It lives in the same state file. Stage 2 may move it to Coda for cross-machine sync, but v0.1 doesn't need that.

## File layout

```
layer-5/
  README.md           # Setup status, file list, contract
  package.json
  tsconfig.json
  src/
    types.ts          # State, Diff, DeltaKind, SignalValueSnapshot, Flag interfaces
    storage.ts        # StateSource interface + LocalJsonStateSource implementation
    diff.ts           # computeDiffs() — pure function
    narrative.ts      # composeFridayNarrative() over the weekly_log
    test-diff.ts      # fixture tests
state/
  jason.json          # The leader's state file (gitignored)
```

The `state/` directory is in `.gitignore` — it carries operational state and should not be committed.

## Migration plan

One branch, five steps in order. Each step is independently runnable.

1. **Types and storage.** `layer-5/src/types.ts` and `layer-5/src/storage.ts`. The `StateSource` interface and the local-JSON implementation. Fixture tests that round-trip a state object through the storage.
2. **Diff computation.** `layer-5/src/diff.ts`. Pure function with the contracts named above. Tests that cover: first_read, no_change, changed, newly_appeared, resolved across all three signal kinds. Also: the change-tolerance thresholds.
3. **Renderer integration.** `renderer/src/digest.ts` calls `loadState` → `computeDiffs` → renders the anchored opening → renders the per-signal sections with diff-aware framing → `commitState`. New smoke test against a synthetic prior snapshot.
4. **Friday narrative.** `layer-5/src/narrative.ts` and a `renderer/src/friday.ts` (or extension to digest.ts) that composes prose from a week of diffs. Tests against fixture week-snapshots.
5. **Docs and README.** Update `architecture/layer-5-diff-memory.md` to point at the implementation. Setup-status table in `layer-5/README.md` following the connectors' pattern.

The verification step at the end runs all three test suites (Layer 4, Layer 5, renderer smoke) and confirms no regression.

## What this ADR is not changing

Not changing:

- The Layer 4 contract. Signals still come in as `Signal[]` with `because` populated. Layer 5 reads them; doesn't reshape them.
- The voice profile or vocabulary refusal. The renderer still vocabulary-checks the final draft.
- The "no signal" honesty rule. A signal with state `no_signal` is still surfaced as such; Layer 5's `delta` enum doesn't override the signal's own state.
- The container resolution layer. Diffs are per-container, just like signals.
- The architecture's hard rule that each signal carries `because`. Diffs inherit the underlying signal's `because`; the renderer can deep-link from a diff back to evidence.

## Related

- [layer 5 diff memory](layer-5-diff-memory.md) — the architectural spec this ADR operationalizes.
- [layer 4 translation](layer-4-translation.md) — produces the input.
- [layer 6 voice rendering](layer-6-voice-rendering.md) — consumes the output.
- [anchor purpose](../memory/anchor-purpose.md) — anchoring as differentiator.
- [adr 02 event kind and decision split](adr-02-event-kind-and-decision-split.md) — the prior ADR; same shape.
- [open decisions](../memory/anchor-open-decisions.md) — calibration loop deferral.
