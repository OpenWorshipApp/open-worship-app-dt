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
    // Label-aimed and guarded, and still the developer's (2026-10-10):
    // what a volunteer asks for -- a song into Sunday's run sheet -- is
    // owa_presenting_flow's `add`, said by name and backed up, where a
    // drag's result is a drop the tool cannot read back. Offering the
    // model a second, unverifiable way to do a thing it has a verifiable
    // way to do is a round spent and a wrong turn to take (`MC-50`).
    reason:
      'Dragging is not yours to do. What goes into a run sheet is ' +
      'owa_presenting_flow with action add, which says what it added ' +
      'and can be undone; a slide is moved with owa_slide_file ' +
      'move-slide. For anything else, tell the user what to drag where.',
    nameList: ['owa_drag'],
  },
  {
    // The menu bar is the developer's too: every item a volunteer needs
    // has a button in the window (Settings, Help, the panels), and the
    // rest -- Reload, zoom, Export Data -- changes the window under them.
    reason:
      'The menu bar is not yours to press. Settings opens from the ' +
      'gear with owa_click, the panels from their tabs and dividers; ' +
      'for anything else, tell the user which menu and item to open.',
    nameList: ['owa_menu'],
  },
  {
    // A QA run walks a long list; a volunteer's assistant names a row
    // and the data tools find a file by name whether or not its row is
    // on screen (`owa_lyric_file list`, `owa_presenting_flow info`).
    reason:
      'Scrolling the window is not yours to do. The file tools find a ' +
      'song, document or run sheet by name whether or not its row is ' +
      'on screen; for a control, tell the user where to scroll.',
    nameList: ['owa_scroll'],
  },
  {
    // Pictures, clips and tracks are the operator's own library, imported
    // from their disk: a path is nothing a volunteer says to an
    // assistant, and a clip trashed by a model on a misread ask is a
    // morning lost even with the copy kept. The developer's door keeps
    // it for QA runs that seed and sweep a library (`MC-56`).
    reason:
      "The user's pictures, clips and web pages are not yours to " +
      'rename, trash or import. Tell them which Background tab holds ' +
      'the file and what to right-click; owa_find_ui can ring the row.',
    nameList: ['owa_media_file'],
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
    // `owa_press_key` IS guarded (by the control whose title names the
    // key), and is still withheld: the prompt tells the model no tool
    // advances a run (the operator presses Space), and every shortcut
    // worth pressing for a volunteer has a button owa_click can name.
    // The developer's door keeps it -- the arrow keys and Space are how a
    // QA run walks a slide list and a run player. `MC-50` weighs offering
    // it.
    nameList: ['press_key', 'handle_dialog', 'owa_press_key'],
  },
  {
    // The chat box's input aid (2026-10-18): the window asks it as the
    // person types a book, chapter, verse or name, and it answers in
    // rows the window draws. A model has no use for it -- and every
    // schema is re-sent every round.
    reason:
      'The chat box asks this itself as the person types. To answer, ' +
      'use owa_find_verse for a passage and owa_lookup_record for a ' +
      'person or place.',
    nameList: ['owa_bible_suggest'],
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

/**
 * Tools the model is offered for ONE kind of ask and no other, by the kind.
 *
 * Not hidden -- the model is the right caller for them -- but useful to one
 * conversation only, and every schema rides every round of every question:
 * `owa_find_verse` (2026-10-16) is the whole of a verse-finding conversation
 * (`AskExtraType.verseFind` in `src/chatbot/llmBotHelpers.ts`), which goes
 * out under a short prompt of its own with this tool and nothing else, and
 * nothing to any other question. The model's ordinary list was at its
 * ratchet ceiling the day it was added (8 350 of 8 350), and this kept it
 * there. Not refused outside its ask: it reads a Bible and opens a verse in
 * the lookup, which a model that names it anyway may do.
 */
export const MODEL_ON_ASK_TOOL_MAP = {
  owa_find_verse: 'verse-find',
  // A conversation opened from a Lookup Detail panel's 🤖 (2026-10-18):
  // the person, place or passage it shows, and the ones it leads to.
  owa_lookup_record: 'lookup',
  // A conversation about a Resources file (2026-10-17): that file's
  // folders, every other chapter's PDF and note in them.
  owa_resource_file: 'resources',
};

/**
 * Ordinary tools an ask of one kind is ALSO sent, beside its own. A verse
 * nobody can place in the Bible on this computer is looked up on the web
 * (2026-10-16, the user's ask: _if something over what assistant can answer
 * then try lookup on internet for user_) -- a search page read, the verse it
 * names then read from their own Bible.
 */
export const MODEL_ASK_SHARED_TOOL_MAP = {
  'verse-find': ['owa_read_website'],
  // A record names its dictionary and Wikipedia pages: a question past
  // what the lookup holds is read there, rationed and announced like any
  // web read. The verse finder joins it (2026-10-19, EC-372): the record's
  // own verse list is a curated few, and "which verses mention this person"
  // or a half-remembered verse is the Bible searched by words -- the
  // research the user asked for, in the one conversation that is about a
  // person, place or passage.
  lookup: ['owa_read_website', 'owa_find_verse'],
  // A study file names its sources and links; one past the files is
  // read there, rationed and announced like any web read. A passage the
  // file cites is read whole from the installed Bible rather than completed
  // from the model's memory.
  resources: ['owa_lookup_record', 'owa_read_website'],
  // A typed question about the Bible Reader's own material (2026-10-18):
  // the names lookup, the Resources files and the verse reader are all
  // useful to it, whichever one the words turn out to want, and the web
  // for a verse the Bibles here cannot place.
  'bible-reader': [
    'owa_lookup_record',
    'owa_resource_file',
    'owa_find_verse',
    'owa_read_website',
  ],
};

/** Whether the tool is offered only for one kind of ask. */
export function checkIsModelOnAskTool(name) {
  return Object.hasOwn(MODEL_ON_ASK_TOOL_MAP, name);
}

/** The tool list as the chatbot's model sees it on an ordinary question. */
export function filterModelToolList(toolList) {
  if (!Array.isArray(toolList)) {
    return toolList;
  }
  return toolList.filter((tool) => {
    return (
      !checkIsModelHiddenTool(tool?.name) && !checkIsModelOnAskTool(tool?.name)
    );
  });
}

/**
 * The tools an ask of this kind is offered: its own, the ordinary ones it
 * shares, and nothing else.
 */
export function pickAskToolList(toolList, askKind) {
  if (!Array.isArray(toolList)) {
    return [];
  }
  const sharedList = MODEL_ASK_SHARED_TOOL_MAP[askKind] ?? [];
  return toolList.filter((tool) => {
    return (
      MODEL_ON_ASK_TOOL_MAP[tool?.name] === askKind ||
      (sharedList.includes(tool?.name) && !checkIsModelHiddenTool(tool?.name))
    );
  });
}
