// Which tools the chatbot's MODEL is offered, and which are the window's or the
// developer's alone.
//
// It lives in this package rather than in `src/chatbot/` because it is a
// statement about the tool surface, which is this package's subject -- and
// because three things have to agree on it: the renderer that filters the list
// it sends, the same renderer refusing a call the model made anyway, and the
// audit script that reports what a question costs. Plain ESM with no
// `node:fs`, so the renderer bundles the module the tooling reads, exactly as
// `botFocus.mjs` and `questionMatch.mjs` do.

/**
 * Tools the model is never offered, and what it should do instead when it
 * names one anyway.
 *
 * Filtering HERE rather than in `server.mjs` is what keeps the other caller
 * whole: an agent driving the app from outside gets the full set through the
 * same server, which is the one-server-two-callers rule this package is built
 * on. What is taken away is taken away from the MODEL, which is the untrusted
 * party -- not from the developer, who is not.
 *
 * Two enforcement points, the same shape as `firewall.mjs`, and for the same
 * reason: dropping a tool from the list is what saves the tokens, and refusing
 * it in `runMcpTool` is what makes it true. A model can name a tool it was
 * never sent -- these are documented in the app's own manual, which it can
 * read -- and until the refusal existed, "the assistant does not get to reach
 * for a camera on its own" was a comment rather than a rule.
 *
 * The saving is not incidental. Every tool in the list is re-sent on every one
 * of up to ten rounds of every question, so a tool nobody's model calls is a
 * tax on all of them. Measured 2026-09-02: 44 tools at the host, 41 to the
 * model at ~8 938 tokens/round; this list takes that to 25 and ~5 721, which
 * is ~32 000 tokens off a worst-case question.
 */
const MODEL_HIDDEN_TOOL_GROUP_LIST = [
    {
        // The user's answer when these were built: the assistant does not get
        // to reach for a camera, or for their mouse, on its own. The window
        // gives them a button for both. `take_screenshot` is here because it
        // is the same decision -- a sibling tool that quietly undid it.
        reason:
            'Taking a picture of the window, or pointing the mouse for the ' +
            'user, is not yours to reach for. Ask in one sentence -- "send ' +
            'me a picture of the window" or "point at the control you mean" ' +
            '-- and the window gives them a button that does it.',
        nameList: ['owa_pick_element', 'owa_screenshot', 'take_screenshot'],
    },
    {
        reason:
            'Ring a control with owa_find_ui and highlight: true, which finds ' +
            'it by the words on it. This one takes a selector the window ' +
            'keeps for itself.',
        nameList: ['owa_highlight_selector'],
    },
    {
        // These aim by a uid out of a snapshot, so the destructive-label
        // interlock has nothing to read (`MC-02`). The firewall now recovers
        // the label from the snapshot that minted the uid, but the model has
        // no business needing that recovery: `owa_click` says what it is
        // pressing, in the language the app is showing.
        reason:
            'Use owa_click and owa_type. They find a control by the words on ' +
            'it, in whatever language the app is showing, and they say what ' +
            'they pressed. This one aims by a snapshot id, which means ' +
            'nothing to the user reading your answer.',
        nameList: ['click', 'fill', 'fill_form', 'drag', 'hover', 'type_text'],
    },
    {
        reason:
            "Opening and closing the user's windows is not yours to do. " +
            'owa_goto_page moves the main window between the presenter and ' +
            'the reader; for any other window, tell them which one to open ' +
            'and how.',
        nameList: ['new_page', 'close_page', 'navigate_page'],
    },
    {
        // ~1 333 tokens/round of instruments that answer no volunteer's
        // question. Still served to the developer's door, which is where
        // profiling an Electron app actually happens.
        reason:
            'That is a developer instrument -- it measures or throttles the ' +
            'browser and answers nothing anyone asked. If the app is slow or ' +
            'wrong, owa_app_state and list_console_messages are what to look ' +
            'at.',
        nameList: [
            'emulate',
            'resize_page',
            'lighthouse_audit',
            'performance_start_trace',
            'performance_stop_trace',
            'performance_analyze_insight',
        ],
    },
];

export const MODEL_HIDDEN_TOOL_MAP = Object.fromEntries(
    MODEL_HIDDEN_TOOL_GROUP_LIST.flatMap(({ reason, nameList }) => {
        return nameList.map((name) => {
            return [name, reason];
        });
    }),
);

/** Whether the chatbot's model is offered this tool at all. */
export function checkIsModelHiddenTool(name) {
    return Object.hasOwn(MODEL_HIDDEN_TOOL_MAP, name);
}

/** What to tell the model instead, or null when the tool is its to call. */
export function findModelHiddenReason(name) {
    return checkIsModelHiddenTool(name) ? MODEL_HIDDEN_TOOL_MAP[name] : null;
}

/** The tool list as the chatbot's model sees it. */
export function filterModelToolList(toolList) {
    if (!Array.isArray(toolList)) {
        return toolList;
    }
    return toolList.filter((tool) => {
        return !checkIsModelHiddenTool(tool?.name);
    });
}

