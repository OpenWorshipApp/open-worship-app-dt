# Codex project instructions

Read `.codex/project-instructions.md` before working on this repository. It is
an unabridged copy of `.claude/CLAUDE.md`; read it in chunks if tool output is
truncated. It is kept separately because it exceeds Codex's default automatic
project-instruction size limit.

Read `.codex/memory/MEMORY.md` and the linked notes relevant to the task.
These are repository notes, not Codex's automatic memory store.

## Skills and tools

The seven project skills are in `.agents/skills/`. Invoke them with
`$skill-name` followed by any options or request. The source spelling
`review-stagged-change` is preserved. Slash-command examples in the copied
instructions mean the corresponding Codex skill invocation.

Use available Codex equivalents for Claude tool names such as Bash, Read,
Grep, WebSearch and WebFetch. Use delegation only when authorized and
available. A reference to an unavailable skill (such as `claude-api`) is not
an installed dependency: use available tools and official provider docs.

`.codex/config.toml` registers `owa-devtools` using the same Node entrypoint
as `.mcp.json`. Start Codex from this repository root. Project configuration
is loaded only for trusted projects; reconnect or start a new session to
load the MCP server if it is not available in the current session.

## Source of truth and synchronization

`.claude/` remains the source of truth, as required by the existing project
instructions. Preserve references to it: the application's knowledge builder
and several helper scripts read those paths directly.

When changing shared guidance, edit the canonical `.claude/` file first,
update its existing `.github/` mirror where applicable, and update these Codex
copies in the same change:

- `.claude/CLAUDE.md` -> `.codex/project-instructions.md` (exact copy).
- `.claude/memory/` -> `.codex/memory/` (exact copies).
- `.claude/skills/` -> `.agents/skills/` (copy resources exactly; retain Codex
  adaptations in each `SKILL.md`: concise discovery description, full original
  description in the body, argument hints in the body, and Codex usage notes).
- `.mcp.json` and enabled-server settings -> `.codex/config.toml` (translate
  the relevant MCP configuration; do not copy Claude settings JSON).

Follow the canonical knowledge-rebuild rule when changing its source inputs.
A change only to the Codex mirrors does not change the application's knowledge
inputs. Keep this entrypoint small so Codex loads it without truncation.
