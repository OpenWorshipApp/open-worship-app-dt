// Which running app an OUTSIDE agent works with, at the door (2026-11-13,
// the user: _make mcp to list for choice when found multiple running app_,
// _this machine running 3 instances of open worship app so the mcp should
// check and let user pick one to work with_). The stdio door only: the
// in-app host is pinned to the app it lives in.
//
// The `owa_*` tools ask for the app through `requireLivePort`, which answers
// the list itself (`describeDeadPin` -> `describeAppChoiceProblem`). The
// chrome-devtools tools ask through the `browserUrl` getter, which can only
// answer "no app" -- read by an agent as "the app is not running" with three
// of them up. So their calls are answered HERE, while a choice is pending,
// with the same list and the same instruction.

import { describeAppChoiceProblem } from './discovery.mjs';

// What the server says on `initialize`: read once by most clients, so short.
export const STDIO_SERVER_INSTRUCTIONS =
  'Drives a running Open Worship App. First call owa_app_state: its ' +
  'versionCheck compares this MCP server with the app -- they should be ' +
  'the same version for the best result; when they differ, tell the user ' +
  'before relying on a press. When more than one app is running, ask the ' +
  'user which one to work with (owa_choose_app lists them) and choose it ' +
  'by its pid; never pick for them.';

function genChoiceRefusal(id, text) {
  // A RESULT the model reads, as the firewall's refusals are, never a
  // JSON-RPC error a client gives up on.
  return {
    jsonrpc: '2.0',
    id,
    result: { content: [{ type: 'text', text }], isError: true },
  };
}

/** Whether a tool reaches the app through the browser connection. */
export function checkIsBrowserTool(name) {
  return typeof name === 'string' && name !== '' && !name.startsWith('owa_');
}

/**
 * Wraps a transport so a chrome-devtools tool call made while a choice is
 * pending (several apps, none chosen; or the chosen one quit) is answered
 * with the running apps instead of reaching for none. Install it after
 * `watchToolCalls` (a call answered here raises no banner) and before
 * `guardToolCalls` (the firewall stays outermost).
 */
export function guardAppChoice(
  transport,
  { describeProblem = describeAppChoiceProblem } = {},
) {
  if (transport === null || typeof transport !== 'object') {
    return transport;
  }
  if (transport.__owaAppChoiceWrapped === true) {
    return transport;
  }
  transport.__owaAppChoiceWrapped = true;
  const innerOnMessage = transport.onmessage;
  transport.onmessage = (message, extra) => {
    if (
      message?.method === 'tools/call' &&
      message.id !== undefined &&
      checkIsBrowserTool(message.params?.name)
    ) {
      const problem = describeProblem();
      if (problem !== null) {
        transport.send?.(genChoiceRefusal(message.id, problem));
        return undefined;
      }
    }
    return innerOnMessage?.call(transport, message, extra);
  };
  return transport;
}
