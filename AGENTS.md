# Project Rules

- When using `.rdl` files as reference, never include any identifying information about them in code or tests (this includes filenames, register names, etc.).

## TypeScript Rules

- When working with TypeScript, please always use `bun`.
- When working with Svelte UIs, always prefer `shadcn-svelte` to making your own components.

## UI Change Workflow

When working with UI, use **subagents**.

1. Have one subagent implement UI code changes.
2. Have another subagent review UI with screenshots using `playwright`.
3. Have the review subagent either **Approve** or **Disapprove with feedback**.
4. Give feedback to implementation subagent.
5. Keep looping until review subagent accepts.
