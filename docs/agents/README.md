# Agent guide (for subagents and parallel sessions)

Read this first, then only the file you need. It exists so a delegation prompt can be three lines ("do X; see docs/agents/…")
instead of a page of context. Nothing here overrides `CLAUDE.md`, `docs/PLAN.md` or `docs/DECISIONS.md`; it points to them.

| File | Read it when |
| --- | --- |
| [architecture.md](architecture.md) | You need to know how the pieces fit: package graph, data flow, boot sequence, security layers, widget and splash flow |
| [runbook.md](runbook.md) | You will run tests, Metro, a native build, a simulator or Maestro, or something broke (gotcha table at the end) |
| [conventions.md](conventions.md) | You will write or review code, copy, docs or a commit; the non-negotiables in one page |
| [task-briefs.md](task-briefs.md) | You are delegating: copy a brief, fill the blanks |

## Ground rules for anyone touching this repo

1. **One checkout, several sessions.** Other Claude sessions edit the same working tree. `git status` before you start; do not
   revert or reformat files you did not change; stage by explicit path, never `git add -A` on a shared tree. If a file you need
   is modified by someone else, message that session (`ListAgents`, `SendMessage`) before editing it.
2. **Simulators, ports and Metro are shared.** Metro runs on **8090** (`npx expo start --dev-client --port 8090`); the iOS test
   simulator and the Android emulator are used by one Maestro run at a time. Never start a second Metro on 8090; never run two
   Maestro sessions against the same device.
3. **Disk is tight** (see the owner's global instructions): no git worktrees unless truly required, clean up anything you
   create, do not leave build output or large screenshots lying around. `apps/mobile/ios`, `apps/mobile/android` are generated and
   git-ignored.
4. **Never leave the suite red.** `pnpm -s test`, `pnpm -s typecheck`, `pnpm lint` must pass before a commit.
5. **Record decisions** in `docs/DECISIONS.md` (append, next free `D-0xx`; never rewrite an old entry, add a correction entry).
6. **Do not decide** security, privacy, regulatory or wording questions on your own: the defaults are in PLAN §11 and
   DECISIONS; when a new one comes up, take the more conservative option, isolate it behind one constant, and record it.
7. **Report faithfully.** If a flow failed, say which step and show the shortest decisive line; if you could not verify
   something, say so.

## Where the truth lives

- Product and architecture: `docs/PLAN.md` (sections referenced as §n in code comments)
- Order of work: `docs/BACKLOG.md`; progress log: `docs/PROGRESS.md`
- Every deviation, VERIFY outcome and gap decision: `docs/DECISIONS.md`
- Regulatory artefacts (keep current when an engine rule, dependency or parameter changes): `docs/regulatory/`
- Visuals: `docs/mockups.html`, `docs/brand.html`; screenshots per item in `docs/screenshots/<item>/`
- Copy (all user-facing strings, fixed wording): `copy/*.json`
