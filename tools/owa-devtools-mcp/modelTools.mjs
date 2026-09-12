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
 *
 * Since 2026-09-09 the model is offered the app's OWN tools and nothing of
 * chrome-devtools' at all. The last ten were kept "in case", and the standing
 * corpus showed what a model does with them: asked "nothing is showing on the
 * projector", it rang the wrong control, then pressed F5 through `press_key`
 * -- twice, on two windows -- and the congregation's screen came on with
 * nobody having asked for it; asked "the words no come out big screen" it
 * took three `take_snapshot`s of the presenter (~8 000 tokens each), read the
 * console, ran to the ten-round cap, and answered "I could not find an
 * answer for that" after 72 seconds and 225 000 tokens. Across every graded
 * run before that, no chrome-devtools tool had ever been called on a question
 * that PASSED. What each one did is done better by an `owa_*` tool that
 * answers in the words on the user's screen: `owa_list_ui` for the snapshot,
 * `owa_app_state` for the pages, `owa_click` for the press.
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
        // A key press carries no label, so the destructive interlock has
        // nothing to read -- and in this app the function keys ARE the
        // congregation's screen: F5 shows it, F6 clears it. A message box the
        // app puts up is a question asked of the USER, and the guide card
        // already refuses to answer one for anybody (`guide.mjs`). Measured
        // 2026-09-08 on the standing corpus: the model pressed F5 unasked on
        // the panic question and reported the screen on.
        reason:
            'Pressing a key or answering a message box is not yours to do: ' +
            'a key carries no label the safety check can read, and F5 and ' +
            'F6 change what the congregation sees. Press the CONTROL with ' +
            'owa_click, by the words written on it, after the user has said ' +
            'yes -- or tell them which key to press themselves.',
        nameList: ['press_key', 'handle_dialog'],
    },
    {
        // The page-level readers. Each answers in uids, page numbers and log
        // lines that mean nothing to a volunteer, and `take_snapshot` costs
        // ~8 000 tokens a call for a tree the model can no longer act on
        // (`click` and `fill` are withheld above). The report reads the
        // console for itself, through `callTool`, which this filter never
        // sees.
        reason:
            'That is a developer instrument and it answers in ids and log ' +
            'lines, not in anything the user can see. owa_list_ui says what ' +
            'is on their screen, owa_app_state which windows are open and ' +
            'what each one shows, owa_list_screens what the projector is ' +
            'doing. Use those.',
        nameList: [
            'take_snapshot',
            'list_pages',
            'select_page',
            'wait_for',
            'list_console_messages',
            'get_console_message',
            'list_network_requests',
            'get_network_request',
        ],
    },
    {
        // ~1 333 tokens/round of instruments that answer no volunteer's
        // question. Still served to the developer's door, which is where
        // profiling an Electron app actually happens.
        reason:
            'That is a developer instrument -- it measures or throttles the ' +
            'browser and answers nothing anyone asked. If the app is slow or ' +
            'wrong, owa_app_state says where the user is and what the window ' +
            'shows; the Report button reads the log for itself.',
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

