// `owa_menu`: the native menu bar, which no page expression can see. The work
// is the main process's (`electron/appMenuAgentHelpers.ts`), asked over the
// same synchronous IPC the capture and hide-screens expressions use -- from a
// window that still has `require`, so the chatbot window cannot ask.
//
// Plain ESM with no imports, like `agentData.mjs`: the firewall and the
// banner read the action list, and a list of words needs no file system.

export const AGENT_MENU_ACTIONS = ['list', 'click'];

const LIST_CHANNEL = 'main:app:agent-menu-list';
const CLICK_CHANNEL = 'main:app:agent-menu-click';

function genChannelExpression(channel, argument) {
  const args =
    argument === undefined ? '' : `, ${JSON.stringify(String(argument))}`;
  return `(() => {
        if (typeof require !== 'function') {
            throw new Error(
                'This window has node integration switched off, so it ' +
                    'cannot be asked for this. The chatbot window is the ' +
                    'one locked down that way -- ask the app window ' +
                    'instead by leaving the page argument unset.',
            );
        }
        const { ipcRenderer } = require('electron');
        return ipcRenderer.sendSync(${JSON.stringify(channel)}${args});
    })()`;
}

/** Every item in the bar, with its path and whether it will be pressed. */
export function genMenuListExpression() {
  return genChannelExpression(LIST_CHANNEL);
}

/** Press the item a path names. */
export function genMenuClickExpression(item) {
  return genChannelExpression(CLICK_CHANNEL, item);
}

/**
 * The main process's answer as the model receives it: a refusal is an
 * `isError` result carrying its own sentence, written for the model to act on.
 */
export function formatMenuResult(result) {
  if (result === null || typeof result !== 'object') {
    return { isError: true, text: 'The app did not answer.' };
  }
  if (result.isError === true) {
    return {
      isError: true,
      text: String(result.reason ?? 'That could not be done.'),
    };
  }
  return { isError: false, text: JSON.stringify(result) };
}
