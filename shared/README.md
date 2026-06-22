# Shared

Shapes and constants used across multiple Anchor packages (connectors, renderer, future translation/diff layers).

## Files

- [`change-event.ts`](change-event.ts) — canonical TypeScript definition of the `change_event` shape Layer 1 emits and downstream layers consume.
- [`change-event.mjs`](change-event.mjs) — JSDoc-typed runtime constants for JavaScript consumers. Mirror of the `.ts` file; keep both in sync when the shape evolves.

## Why two files

The two-Worker connectors (Figma, Slack) are TypeScript and import types from `change-event.ts` at compile time. The two Node consumers (Cowork watcher, renderer) are JavaScript ES modules and need runtime values from `change-event.mjs`. Type information for the JS consumers comes from JSDoc imports of the `.ts` file:

```js
/** @typedef {import('../shared/change-event.ts').ChangeEvent} ChangeEvent */
```

This is fine in VS Code and modern editors and gives the JS consumers the same type-checking as the TS Workers without forcing a TypeScript build step.
