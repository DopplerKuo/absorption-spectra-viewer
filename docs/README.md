# docs — how this project was built

This folder documents the process behind **photolyze**, for anyone who wants to see how it
was made with Claude Code.

| File | What it is |
|---|---|
| [`handoff-prompt.md`](handoff-prompt.md) | The original task brief / spec that started the project (goal, scope, data-accuracy rules, definition of done). |
| [`implementation-plan.md`](implementation-plan.md) | The implementation plan produced from the brief (tech choices, data inventory, milestones). |
| [`CONVERSATION.md`](CONVERSATION.md) | The build conversation, turn by turn: every user prompt and the assistant's reply (tool I/O and internal reasoning omitted). Shows how the design evolved from feedback. |
| [`reference/`](reference/) | The 5 original source figures the data/layout were checked against (layout & trend reference only — the plotted data comes from primary literature, see [`../data/SOURCES.md`](../data/SOURCES.md)). |

The product itself (engine, web app, data, tests) lives in the repository root — see the
[top-level README](../README.md).
