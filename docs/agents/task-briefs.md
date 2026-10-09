# Task briefs for delegation

A delegated agent starts with no context. Give it: the goal, the files, the check that proves it, and the pointer
`Read docs/agents/README.md first`. Copy a brief, fill the `<…>`, send. Keep prompts short; the docs carry the context.

Tool preference (owner's rule): heavy file analysis, repo-wide searches, web/doc lookups and plan or code review go to the
`agy-bridge` MCP tools first (`analyze_files`, `deep_search`, `web_lookup`, `adversarial_review`); verify every cited line
yourself. If agy returns empty, refuses, or reports `Quota exhausted`, retry once via `follow_up`, then do it natively and do
not use agy again for the session. Never delegate security or data-exposure decisions or the final diff.

---

## A. Reviewer (pre-commit, read-only)

```
Read docs/agents/README.md and docs/agents/conventions.md. Review the uncommitted diff of <paths> (git diff -- <paths>) for
correctness, data loss, security/privacy leaks, and breaches of the non-negotiables. Read the changed files in full.
Report only concrete, verified defects: file:line, failure scenario, suggested fix. Say plainly if there are none.
Do not edit files.
```
Use `feature-dev:code-reviewer` (or `pr-review-toolkit:code-reviewer`). For crash-safety or security work add: "Check
every step of <function> for a kill at that line; verify library behaviour in node_modules/<pkg> source."

## B. Maestro runner (device, serialise with others)

```
Read docs/agents/runbook.md §2–§3 and §5. Metro is already running on 8090; do not start another. Run
`CLIENT=dev ITEM=<item> .maestro/run.sh <ios|android> <flow>.yaml`. If it fails, read the last screenshot in the kept debug
folder and the tail of maestro.log, and report: failing step, what the screen showed, likely cause (check the gotcha table).
Do not edit app code; you may propose a flow fix as a diff. Report screenshots written.
```
Only one device run at a time across all sessions (check `ListAgents` / ask before starting).

## C. New pure module with tests (engine, data, crypto, services logic)

```
Read docs/agents/conventions.md and docs/agents/architecture.md §1–2. Implement <module> at <path> as pure logic, test-first:
write <path>.test.ts covering <cases incl. edge/failure cases>, then the code. No new dependencies. Run `pnpm -s test --
<path>`, `pnpm -s typecheck`, `pnpm lint`. Do not touch other files except to export the function. Return the diff summary
and the test output line.
```

## D. Screen or component

```
Read docs/agents/conventions.md, docs/agents/runbook.md §3, and open docs/mockups.html for the screen's look. Implement <screen>
at <path> using theme tokens (`useTheme`), `copy/*.json` strings (add keys, no forbidden words), a testID per interactive
element, accessibility labels, 44 pt targets, 150% text size tolerance. Add/extend a Maestro flow in apps/mobile/.maestro and
list it in suite.sh. Do not run devices unless told; return the flow for the runner.
```

## E. Library or API lookup

```
Find, for Expo SDK 57 / <package> <version>: <question>. Cite docs.expo.dev or the package source in node_modules/<pkg>
(file:line). Distinguish "documented" from "seen in source". Answer in under 200 words with a code snippet if the answer is
a config or call shape.
```
Prefer `agy-bridge web_lookup`; read `node_modules/<pkg>` for ground truth (this session found two doc/behaviour gaps that way).

## F. Docs or diagram update

```
Read docs/agents/README.md. Update <doc> to reflect <change>. Keep diagrams in Mermaid, keep claims checkable (name the
file or test that proves each). Do not edit PLAN.md, CLAUDE.md or old DECISIONS entries; append a new decision if the change
is a decision.
```

## G. Investigator (read-only, "where is X / what calls Y")

```
Read docs/agents/architecture.md §6. Find <thing>. Return a table of file:line, one line each. No fixes, no summaries of
unrelated code.
```
Use `Explore` (very thorough only when asked) or `caveman:cavecrew-investigator`.
