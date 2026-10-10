// "Something else is driving your app right now."
//
// The chatbot and any outside agent reach the window through the same MCP
// server, and a click they make is indistinguishable from one the user made --
// the pointer does not move, nothing is pressed, the screen just changes. On a
// machine running a service that is the wrong kind of surprise, so every tool
// call that TOUCHES the interface puts a small banner in the window saying so.
//
// Only acting tools announce themselves. Reading the page (a snapshot, a
// screenshot, `owa_app_state`) changes nothing the user can see, and a banner
// per read would both cry wolf and photograph itself during a QA run.
//
// Like `guide.mjs` this is a string evaluated in the page: dependency free,
// never importing an app module (that re-runs `document.onkeydown` and kills
// every shortcut), and confined to its own shadow root so no app style can
// reach it and it can touch no app state.

import { evaluateInApp } from './cdp.mjs';
import { DEFAULT_LANG_CODE, loadTranBundle } from './tran.mjs';

// A banner is said in the language the app is DISPLAYING, which is not always
// English (2026-10-06: a Khmer window put up "Assistant clicked something").
// So every banner is three things: `text`, the English sentence, unchanged;
// `key`, the same news with no names in it, which is a `tran()` key in the
// app's own dictionary; and `detail`, the names the sentence carried (a site,
// a reference, a song) as parts that are either words that are the same in
// every language or `{ key }` for a word the dictionary has too. A language
// whose dictionary lacks `key` gets the English sentence WHOLE, never half of
// one: a phrase missing from the dictionary is a phrase not yet translated,
// and a banner part Khmer, part English reads worse than one in English.

// What each tool does, said the way a volunteer would say it. A tool that is
// not in here reads the app rather than acting on it, and stays quiet. Each
// phrase is also its own `tran()` key.
const ACTING_TOOLS = {
    click: 'clicked something',
    drag: 'dragged something',
    fill: 'filled in a box',
    fill_form: 'filled in a form',
    hover: 'pointed at something',
    press_key: 'pressed a key',
    type_text: 'typed something',
    upload_file: 'chose a file',
    handle_dialog: 'answered a message box',
    navigate_page: 'opened another page',
    new_page: 'opened a window',
    close_page: 'closed a window',
    resize_page: 'resized the window',
    emulate: 'changed how the page is shown',
    evaluate_script: 'ran something in the page',
    owa_hide_screens: 'took content off a screen',
    owa_guide_start: 'started a walkthrough',
    owa_guide_step: 'moved the walkthrough on',
    owa_find_ui: 'pointed out a control',
    owa_click: 'clicked something',
    owa_type: 'typed something',
    // The label-aimed twins of `press_key` and `drag`: the same news, the
    // same dictionary keys, so a Khmer window reads them already.
    owa_press_key: 'pressed a key',
    owa_drag: 'dragged something',
    // The menu bar. A `list` reads and is quiet; a press names the item.
    owa_menu: 'chose a menu item',
    owa_scroll: 'scrolled a list',
    owa_goto_page: 'switched the window to another page',
    // Draws an outline over the window and swallows the next click. Nothing in
    // the app changes, but the window stops behaving normally until the user
    // picks, and that is exactly what the banner is for.
    owa_pick_element: 'asked you to point at a control',
    owa_highlight_selector: 'pointed out a control',
    // The one tool that reaches off this machine. It changes nothing in the
    // window, so by the rule above it would stay quiet -- and it is here
    // anyway, because "what left this computer" is the one thing an operator
    // is owed a look at even more than "what was pressed". A URL is a channel
    // out, so the banner NAMES the site: a read of a site nobody recognises,
    // in the middle of a question about clearing a screen, is the shape a
    // prompt injection makes, and a banner reading "read a website" would
    // have hidden exactly the part worth seeing.
    owa_read_website: 'read a website',
    owa_bible_xml: 'changed the installed Bibles',
    // Writing the user's own documents. The banner says the ACTION and the
    // NAME, because "changed a song" is the one notice where which song is
    // the whole question -- and a read (`list` / `info`) says nothing at all,
    // the same rule every other reading tool follows.
    owa_lyric_file: 'changed a song',
    owa_slide_file: 'changed a slide document',
    // The verse goes on the congregation's screen, so the banner NAMES it:
    // "put a verse on the screen" says nothing the operator can check
    // against the wall. A `check` reads the passage and touches no screen,
    // and stays quiet like every other read.
    owa_present_bible: 'put a Bible passage on the screen',
    // A countdown or a message goes on the congregation's screen too, so the
    // banner names WHICH extra and, for a countdown, how long: "started a
    // 5 minute countdown on the screen" is something the operator can check
    // against the wall. A `check` reads and stays quiet.
    owa_foreground: 'put a countdown or a message on the screen',
    // The user's saved passages and notes, and putting a change back. Each
    // names what it touched below: "removed a note from Default" is a
    // sentence the operator can check, "changed a note" is not.
    owa_bible_item: 'changed the saved Bible passages',
    owa_bible_note: 'changed a Bible note',
    owa_undo: 'put back an earlier change',
    // The run sheets: each action names the sheet and what went in below;
    // this is the generic news the audit script probes for.
    owa_presenting_flow: 'changed a run sheet',
    // The Background tabs' files; each action names the file below.
    owa_media_file: 'changed a media file',
};

// The two kinds of document the file tools write, as a banner names them.
const AGENT_FILE_KINDS = ['song', 'slide document'];

// What a write to one of the user's documents reads as, by action, or no
// entry for a read (`list`, `info`, `slides`). A delete says where it went.
// `key` is the same news with the name taken out.
const AGENT_FILE_PHRASE_MAP = {
    create: {
        say: (what, named) => `made the ${what} ${named}`,
        key: (what) => `made a ${what}`,
    },
    update: {
        say: (what, named) => `changed the ${what} ${named}`,
        key: (what) => `changed a ${what}`,
    },
    rename: {
        say: (what, named) => `renamed the ${what} ${named}`,
        key: (what) => `renamed a ${what}`,
    },
    delete: {
        say: (what, named) => `moved the ${what} ${named} to the trash`,
        key: (what) => `moved a ${what} to the trash`,
    },
    revert: {
        say: (what, named) => `put the ${what} ${named} back as saved`,
        key: (what) => `put a ${what} back as saved`,
    },
    'add-slide': {
        say: (_what, named) => `added a slide to ${named}`,
        key: () => 'added a slide',
    },
    'update-slide': {
        say: (_what, named, slide) => `changed ${slide} of ${named}`,
        key: () => 'changed a slide',
    },
    'delete-slide': {
        say: (_what, named, slide) => `removed ${slide} from ${named}`,
        key: () => 'removed a slide',
    },
    'move-slide': {
        say: (_what, named, slide) => `moved ${slide} of ${named}`,
        key: () => 'moved a slide',
    },
    'duplicate-slide': {
        say: (_what, named, slide) => `copied ${slide} of ${named}`,
        key: () => 'copied a slide',
    },
};

// The saved passages and notes, the same way.
const AGENT_DATA_PHRASE_MAP = {
    owa_bible_item: {
        add: {
            say: (args, list) =>
                toReference(args) !== null
                    ? `saved ${toReference(args)} to the Bibles list ${list}`
                    : `saved a passage to the Bibles list ${list}`,
            key: 'saved a Bible passage',
            detail: (args, list) => [toReference(args), list],
        },
        update: {
            say: (_args, list) => `changed a saved passage in ${list}`,
            key: 'changed a saved Bible passage',
        },
        delete: {
            say: (_args, list) => `removed a saved passage from ${list}`,
            key: 'removed a saved Bible passage',
        },
        'create-list': {
            say: (_args, list) => `made the Bibles list ${list}`,
            key: 'made a Bibles list',
        },
        'rename-list': {
            say: (_args, list) => `renamed the Bibles list ${list}`,
            key: 'renamed a Bibles list',
        },
        'delete-list': {
            say: (_args, list) => `moved the Bibles list ${list} to the trash`,
            key: 'moved a Bibles list to the trash',
        },
    },
    owa_bible_note: {
        add: {
            say: (_args, file) => `added a note to ${file}`,
            key: 'added a Bible note',
        },
        update: {
            say: (_args, file) => `changed a note in ${file}`,
            key: 'changed a Bible note',
        },
        delete: {
            say: (_args, file) => `removed a note from ${file}`,
            key: 'removed a Bible note',
        },
        'create-file': {
            say: (_args, file) => `made the notes file ${file}`,
            key: 'made a notes file',
        },
        'rename-file': {
            say: (_args, file) => `renamed the notes file ${file}`,
            key: 'renamed a notes file',
        },
        'delete-file': {
            say: (_args, file) => `moved the notes file ${file} to the trash`,
            key: 'moved a notes file to the trash',
        },
    },
    // The run sheets. "Run sheet" rather than "presenting flow" in the
    // English: it is what the operator calls it, and the dictionary keys
    // below are what a Khmer or French window reads instead.
    owa_presenting_flow: {
        create: {
            say: (_args, sheet) => `made the run sheet ${sheet}`,
            key: 'made a run sheet',
        },
        rename: {
            say: (_args, sheet) => `renamed the run sheet ${sheet}`,
            key: 'renamed a run sheet',
        },
        delete: {
            say: (_args, sheet) => `moved the run sheet ${sheet} to the trash`,
            key: 'moved a run sheet to the trash',
        },
        add: {
            say: (args, sheet) => {
                const what =
                    toQuotedName(args?.document, null) ??
                    toReference(args) ??
                    toQuotedName(args?.actionId, null);
                return what === null
                    ? `added a line to the run sheet ${sheet}`
                    : `added ${what} to the run sheet ${sheet}`;
            },
            key: 'added a line to a run sheet',
            detail: (args, sheet) => [
                toQuotedName(args?.document, null) ??
                    toReference(args) ??
                    toQuotedName(args?.actionId, null),
                sheet,
            ],
        },
        remove: {
            say: (_args, sheet) => `removed a line from the run sheet ${sheet}`,
            key: 'removed a line from a run sheet',
        },
        move: {
            say: (_args, sheet) => `moved a line in the run sheet ${sheet}`,
            key: 'moved a line in a run sheet',
        },
        duplicate: {
            say: (_args, sheet) => `copied a line in the run sheet ${sheet}`,
            key: 'copied a line in a run sheet',
        },
        park: {
            say: (_args, sheet) => `parked a line in the run sheet ${sheet}`,
            key: 'parked a line in a run sheet',
        },
        unpark: {
            say: (_args, sheet) =>
                `put a line of the run sheet ${sheet} back in play`,
            key: 'put a line of a run sheet back in play',
        },
    },
    // The Background tabs' files. `where` is the file's own name here.
    owa_media_file: {
        create: {
            say: (_args, file) => `made the web page ${file}`,
            key: 'made a web page',
        },
        update: {
            say: (_args, file) => `changed the web page ${file}`,
            key: 'changed a web page',
        },
        rename: {
            say: (_args, file) => `renamed the media file ${file}`,
            key: 'renamed a media file',
        },
        delete: {
            say: (_args, file) => `moved the media file ${file} to the trash`,
            key: 'moved a media file to the trash',
        },
        import: {
            say: (args, _file) =>
                `imported ${toQuotedName(args?.path, 'a file')} from the disk`,
            key: 'imported a media file from the disk',
            detail: (args) => [toQuotedName(args?.path, null)],
        },
    },
};

function toReference(args) {
    return typeof args?.reference === 'string' && args.reference.trim() !== ''
        ? args.reference.trim()
        : null;
}

function toQuotedName(name, fallback) {
    return typeof name === 'string' && name.trim() !== ''
        ? `"${name.trim()}"`
        : fallback;
}

// What each foreground extra is called in a banner.
const FOREGROUND_BANNER_NOUN_MAP = {
    countdown: 'the countdown',
    stopwatch: 'the stopwatch',
    clock: 'the clock',
    'marquee-top': 'the scrolling message',
    'marquee-bottom': 'the scrolling message',
    'quick-text': 'the line of text',
    all: 'every foreground extra',
};

// ...and in another language: the words on the extra's own row of the
// Foreground launcher, which the dictionary already carries.
const FOREGROUND_LAUNCHER_LABEL_MAP = {
    countdown: 'Countdown',
    stopwatch: 'Stopwatch',
    clock: 'Time',
    'marquee-top': 'Marquee Top',
    'marquee-bottom': 'Marquee Bottom',
    'quick-text': 'Quick Text',
};

const FOREGROUND_STARTED_KEY_MAP = {
    countdown: 'started a countdown on the screen',
    stopwatch: 'started a stopwatch on the screen',
    clock: 'put a clock on the screen',
    'marquee-top': 'put a scrolling message on the screen',
    'marquee-bottom': 'put a scrolling message on the screen',
    'quick-text': 'put a line of text on the screen',
};

const FOREGROUND_STOP_KEY = 'took a foreground extra off the screen';
const FOREGROUND_STOP_ALL_KEY = 'took every foreground extra off the screen';

// The banner for `owa_foreground` says WHICH extra and, for a countdown, how
// long -- "started a 5 minute countdown on the screen" is a sentence the
// operator can check against the wall, where "put an extra on the screen"
// is not. A `check` reads and is quiet, like every other read.
function describeForegroundNotice(args) {
    if (args?.action === 'check') {
        return null;
    }
    const widget = typeof args?.widget === 'string' ? args.widget : '';
    const noun = FOREGROUND_BANNER_NOUN_MAP[widget];
    if (args?.action === 'stop') {
        if (noun === undefined) {
            return toNotice(FOREGROUND_STOP_KEY);
        }
        if (widget === 'all') {
            return toNotice(FOREGROUND_STOP_ALL_KEY);
        }
        return toNotice(`took ${noun} off the screen`, FOREGROUND_STOP_KEY, [
            { key: FOREGROUND_LAUNCHER_LABEL_MAP[widget] },
        ]);
    }
    const startedKey = FOREGROUND_STARTED_KEY_MAP[widget];
    if (widget === 'countdown') {
        if (typeof args?.minutes === 'number') {
            return toNotice(
                `started a ${args.minutes} minute countdown on the screen`,
                startedKey,
                [String(args.minutes), { key: 'Minutes' }],
            );
        }
        if (typeof args?.at === 'string' && args.at.trim() !== '') {
            return toNotice(
                `started a countdown to ${args.at.trim()} on the screen`,
                startedKey,
                [args.at.trim()],
            );
        }
    }
    return startedKey === undefined
        ? toNotice(ACTING_TOOLS.owa_foreground)
        : toNotice(startedKey);
}

// The Bible importer's news, by action, with the Bible and the site taken
// out. Reading (`list`, `info`) and dropping a download (`cancel`) say nothing.
const BIBLE_XML_KEY_MAP = {
    check: 'downloaded a Bible file',
    names: 'looked for Bible book names on Bible.com and Wordproject',
    import: 'installed a Bible',
    update: 'changed a Bible',
    delete: 'moved a Bible to the trash',
};

/**
 * The Bible importer says what it did to WHICH Bible, and where a download
 * came from: "installed a Bible" is the one notice where which one is the
 * whole question.
 */
function describeBibleXmlNotice(args) {
    const action = String(args?.action);
    if (!Object.hasOwn(BIBLE_XML_KEY_MAP, action)) {
        return null;
    }
    const key = BIBLE_XML_KEY_MAP[action];
    const named = toQuotedName(args?.key, 'a Bible');
    const detail = [toQuotedName(args?.key, null)];
    switch (action) {
        case 'check': {
            const site = toSiteName(args?.url);
            return site === null
                ? toNotice(key)
                : toNotice(`downloaded a Bible file from ${site}`, key, [site]);
        }
        case 'import':
            return toNotice(`installed the Bible ${named}`, key, detail);
        case 'update':
            return toNotice(`changed the Bible ${named}`, key, detail);
        case 'delete':
            return toNotice(
                `moved the Bible ${named} to the trash`,
                key,
                detail,
            );
        default:
            return toNotice(key);
    }
}

function toNotice(text, key = text, detail = []) {
    return {
        text,
        key,
        detail: detail.filter((part) => {
            return part !== null && part !== undefined && part !== '';
        }),
    };
}

/**
 * What a tool call says in the banner, as `{ text, key, detail }` (see the top
 * of this file), or null for a call that only reads. Two tools say more than
 * their entry: `owa_find_ui` only draws when asked to, so without a highlight
 * it is a read; `owa_read_website` names where it went.
 */
export function describeToolNotice(name, args) {
    if (name === 'owa_find_ui' && args?.highlight !== true) {
        return null;
    }
    if (name === 'owa_lyric_file' || name === 'owa_slide_file') {
        const phrase = AGENT_FILE_PHRASE_MAP[args?.action];
        if (phrase === undefined) {
            // `list`, `info` and `slides` only read, and a banner per read
            // would both cry wolf and photograph itself during a QA run.
            return null;
        }
        const what = name === 'owa_lyric_file' ? 'song' : 'slide document';
        const hasSlide = Number.isInteger(args?.slide);
        const slide = hasSlide ? `slide ${args.slide}` : 'a slide';
        const text = phrase
            .say(what, toQuotedName(args?.name, `a ${what}`), slide)
            .replace(`the ${what} a ${what}`, `a ${what}`);
        return toNotice(text, phrase.key(what), [
            toQuotedName(args?.name, null),
            hasSlide ? `#${args.slide}` : null,
        ]);
    }
    if (Object.hasOwn(AGENT_DATA_PHRASE_MAP, name)) {
        const phraseMap = AGENT_DATA_PHRASE_MAP[name];
        // No action at all is not a read -- the schema requires one, so this
        // is a probe (the audit script's) asking whether the tool announces
        // itself: the generic news, so a data tool is never reported silent.
        if (args?.action === undefined) {
            return toNotice(ACTING_TOOLS[name]);
        }
        if (!Object.hasOwn(phraseMap, String(args.action))) {
            return null;
        }
        const where =
            name === 'owa_presenting_flow' || name === 'owa_media_file'
                ? toQuotedName(args?.name, '')
                : toQuotedName(
                      name === 'owa_bible_item' ? args?.list : args?.file,
                      '"Default"',
                  );
        const phrase = phraseMap[args.action];
        return toNotice(
            // A sheet with no name read ("made the run sheet ") is tidied.
            phrase
                .say(args, where)
                .replace(/\s{2,}/g, ' ')
                .trim(),
            phrase.key,
            phrase.detail === undefined ? [where] : phrase.detail(args, where),
        );
    }
    if (name === 'owa_undo') {
        return args?.action === 'undo' ? toNotice(ACTING_TOOLS.owa_undo) : null;
    }
    // A key names itself: "pressed F5" is something the operator can check
    // against the wall, "pressed a key" is not. The words are the same in
    // every language.
    if (name === 'owa_press_key') {
        const keys = typeof args?.keys === 'string' ? args.keys.trim() : '';
        return keys === ''
            ? toNotice(ACTING_TOOLS.owa_press_key)
            : toNotice(`pressed ${keys}`, ACTING_TOOLS.owa_press_key, [keys]);
    }
    if (name === 'owa_menu') {
        if (args?.action !== 'click') {
            return null;
        }
        const item = typeof args?.item === 'string' ? args.item.trim() : '';
        return item === ''
            ? toNotice(ACTING_TOOLS.owa_menu)
            : toNotice(`chose ${item} in the menu`, ACTING_TOOLS.owa_menu, [
                  item,
              ]);
    }
    if (name === 'owa_present_bible') {
        if (args?.action === 'check') {
            return null;
        }
        const reference = toReference(args);
        return reference === null
            ? toNotice(ACTING_TOOLS.owa_present_bible)
            : toNotice(
                  `put ${reference} on the screen`,
                  ACTING_TOOLS.owa_present_bible,
                  [reference],
              );
    }
    if (name === 'owa_foreground') {
        return describeForegroundNotice(args);
    }
    if (name === 'owa_bible_xml') {
        return describeBibleXmlNotice(args);
    }
    if (name === 'owa_read_website' || checkIsDraftFromPage(name, args)) {
        const site = toSiteName(args?.url);
        // The generic entry above, when the address is unreadable: a tool
        // that announces itself only for well-formed input announces itself
        // exactly when it matters least.
        return site === null
            ? toNotice(ACTING_TOOLS.owa_read_website)
            : toNotice(
                  `read a page on ${site}`,
                  ACTING_TOOLS.owa_read_website,
                  [site],
              );
    }
    const phrase = ACTING_TOOLS[name];
    return phrase === undefined ? null : toNotice(phrase);
}

/** The English sentence a tool call puts in the banner, or null for a read. */
export function describeToolCall(name, args) {
    return describeToolNotice(name, args)?.text ?? null;
}

/**
 * The song drafter, handed a page address. It is a local tool -- checking or
 * drafting a paste opens nothing and says nothing -- but given a `url` it
 * opens the same hidden window `owa_read_website` does, and what left this
 * computer is announced the same way whichever tool sent it.
 */
function checkIsDraftFromPage(name, args) {
    return (
        name === 'owa_lyric_validate' &&
        typeof args?.url === 'string' &&
        args.url.trim() !== ''
    );
}

// Just the site, never the whole address: the path is where an exfiltration
// attempt puts its payload, and a banner is a thing glanced at, not read.
function toSiteName(url) {
    try {
        return new URL(String(url)).hostname;
    } catch {
        return null;
    }
}

// Who the banner says is acting. `Assistant` is the banner's own word; the
// app's `App Assistant` (what the chatbot window is called) stands in for a
// language whose dictionary does not have it yet.
const NOTICE_WHO_KEYS = ['Assistant', 'App Assistant'];
const NOTICE_WHO_TEXT = 'Assistant';

/**
 * Every `tran()` key a banner can ask the dictionary for -- the phrases, the
 * words a detail can carry, and who is acting. Exported so a test can hold the
 * translations to being added in pairs.
 */
export function listNoticeTranKeys() {
    const keys = new Set([
        ...NOTICE_WHO_KEYS,
        ...Object.values(ACTING_TOOLS),
        ...Object.values(FOREGROUND_STARTED_KEY_MAP),
        ...Object.values(FOREGROUND_LAUNCHER_LABEL_MAP),
        ...Object.values(BIBLE_XML_KEY_MAP),
        FOREGROUND_STOP_KEY,
        FOREGROUND_STOP_ALL_KEY,
        'Minutes',
    ]);
    for (const phrase of Object.values(AGENT_FILE_PHRASE_MAP)) {
        for (const what of AGENT_FILE_KINDS) {
            keys.add(phrase.key(what));
        }
    }
    for (const phraseMap of Object.values(AGENT_DATA_PHRASE_MAP)) {
        for (const phrase of Object.values(phraseMap)) {
            keys.add(phrase.key);
        }
    }
    return [...keys];
}

/** `tran()`'s own key sanitizer, the one `tran.mjs` mirrors. */
function sanitizeTranKey(key) {
    return key.trim().toLowerCase();
}

// The banner's own words, picked out of the app's dictionary and kept for a
// minute. A banner rides every acting call (up to 25 a minute), and the whole
// dictionary is ~380 KB of JSON to read and parse for the dozen words one
// banner needs -- so only the banner's keys are kept, and not for long: the
// same short-lived rule every cache in this app follows, and a language
// switch reloads every window anyway.
const NOTICE_DICTIONARY_TTL_MS = 60 * 1000;
let noticeDictionaryCache = null;

function readNoticeDictionaries(now = Date.now()) {
    if (
        noticeDictionaryCache !== null &&
        now - noticeDictionaryCache.readAt < NOTICE_DICTIONARY_TTL_MS
    ) {
        return noticeDictionaryCache.dictionaries;
    }
    const keys = listNoticeTranKeys().map(sanitizeTranKey);
    const dictionaries = {};
    const bundle = loadTranBundle();
    for (const [langCode, dictionary] of Object.entries(
        bundle?.dictionaries ?? {},
    )) {
        if (langCode === DEFAULT_LANG_CODE) {
            continue;
        }
        const picked = {};
        for (const key of keys) {
            if (typeof dictionary?.[key] === 'string') {
                picked[key] = dictionary[key];
            }
        }
        dictionaries[langCode] = picked;
    }
    noticeDictionaryCache = { readAt: now, dictionaries };
    return dictionaries;
}

/**
 * The banner's words in every language the app can be shown in, as
 * `{ en: { who, what }, km: {...}, ... }`. The page picks one off its own
 * `<html lang>` -- the attribute `owa_app_state` reports as the language --
 * so no round trip is spent asking which. A language is left out, and the
 * page falls back to English, when its dictionary lacks the phrase.
 */
export function genNoticeWords(
    notice,
    dictionaries = readNoticeDictionaries(),
) {
    const words = { en: { who: NOTICE_WHO_TEXT, what: notice.text } };
    for (const [langCode, dictionary] of Object.entries(dictionaries ?? {})) {
        const what = dictionary?.[sanitizeTranKey(notice.key)];
        if (typeof what !== 'string') {
            continue;
        }
        const who =
            NOTICE_WHO_KEYS.map((key) => {
                return dictionary[sanitizeTranKey(key)];
            }).find((one) => {
                return typeof one === 'string';
            }) ?? NOTICE_WHO_TEXT;
        const detail = notice.detail
            .map((part) => {
                if (typeof part === 'string') {
                    return part;
                }
                return dictionary[sanitizeTranKey(part.key)] ?? part.key;
            })
            .join(' ');
        words[langCode] = {
            who,
            what: detail === '' ? what : `${what} · ${detail}`,
        };
    }
    return words;
}

// Bumped whenever the banner's shape changes: the page memoises the runtime,
// and a window first given an older one (by a server started before the
// change) must be given this one instead of being handed words it cannot
// read.
const NOTICE_RUNTIME_VERSION = 2;

const NOTICE_RUNTIME = `
(() => {
    const VERSION = ${NOTICE_RUNTIME_VERSION};
    const existing = window.__owaAgentNotice;
    if (existing !== undefined && existing.version === VERSION) {
        return existing;
    }
    document.getElementById('owa-agent-notice-host')?.remove();
    const host = document.createElement('div');
    host.id = 'owa-agent-notice-host';
    host.style.cssText = 'position:fixed;inset:0;z-index:2147483645;' +
        'pointer-events:none';
    const root = host.attachShadow({ mode: 'open' });
    // Bottom centre, not top centre. At the top it sat over the header's
    // Bible Lookup button and over the TITLE of every app dialog -- the
    // Download From URL box, the Reload is needed question -- which is the
    // one line a volunteer reads to know what is being asked (2026-10-06).
    // The top-right corner is the toasts' and the Tip of the Day's, the
    // pointer picker's hint is at the top centre, and the walkthrough card
    // starts in the bottom-right corner, so the bottom centre is the one
    // edge nothing else of this kind uses.
    root.innerHTML = \`
        <style>
            .pill {
                position: fixed; bottom: 14px; left: 50%; translate: -50% 0;
                display: flex; align-items: center; gap: 8px;
                max-width: calc(100vw - 32px); box-sizing: border-box;
                padding: 6px 14px 6px 10px; border-radius: 999px;
                background: rgba(16, 21, 28, 0.94); color: #f2f5f8;
                border: 1px solid rgba(255, 187, 51, 0.55);
                box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
                font: 13px/1.45 system-ui, -apple-system, sans-serif;
                white-space: nowrap; pointer-events: none;
                opacity: 0; transition: opacity 0.2s ease-out;
            }
            .pill[data-shown="yes"] { opacity: 1; }
            .dot {
                width: 8px; height: 8px; border-radius: 50%;
                background: #ffbb33; flex: 0 0 auto;
                animation: beat 1s ease-in-out infinite;
            }
            /* A faded pill stays mounted for the life of the page, and a
               beat nobody can see is work a weak machine still pays for. */
            .pill:not([data-shown="yes"]) .dot { animation: none; }
            @keyframes beat {
                0%, 100% { opacity: 1; } 50% { opacity: 0.25; }
            }
            .words { overflow: hidden; text-overflow: ellipsis; }
            .what { opacity: 0.75; }
        </style>
        <div class="pill">
            <span class="dot"></span>
            <span class="words"><b class="who"></b> <span class="what"></span></span>
        </div>
    \`;
    document.documentElement.appendChild(host);
    const pill = root.querySelector('.pill');
    const who = root.querySelector('.who');
    const what = root.querySelector('.what');
    let hideTimeout = null;
    const api = {
        version: VERSION,
        // The words in every language the app can be shown in; the one the
        // window is DISPLAYING is picked here, off the same attribute the
        // app's own interface language sets.
        show(wordsByLang) {
            const langCode = (document.documentElement.lang || 'en')
                .split('-')[0];
            const words = (wordsByLang && wordsByLang[langCode]) ||
                (wordsByLang && wordsByLang.en) ||
                { who: 'Assistant', what: 'is using the app' };
            pill.lang = wordsByLang && wordsByLang[langCode]
                ? langCode
                : 'en';
            who.textContent = String(words.who);
            what.textContent = String(words.what);
            pill.dataset.shown = 'yes';
            clearTimeout(hideTimeout);
            // Long enough to read, short enough that it is gone before the
            // next thing the user does.
            hideTimeout = setTimeout(() => {
                pill.dataset.shown = 'no';
            }, 2600);
            return true;
        },
    };
    window.__owaAgentNotice = api;
    return api;
})()`;

export function genNoticeExpression(wordsByLang) {
    return (
        `(() => { const api = ${NOTICE_RUNTIME};` +
        ` return api.show(${JSON.stringify(wordsByLang)}); })()`
    );
}

// Same phrase in the same window, twice in a row, while the first is still on
// screen: one banner. Keyed by the window as well as the phrase -- two agents
// (the chatbot and an outside client) acting on two different windows at once
// are two things happening, and the user is owed a banner in each.
let lastKey = null;
let lastAt = 0;

/**
 * Fire and forget on purpose: a tool call must not wait for its own banner,
 * and an app that has closed since must not turn one into a failed tool.
 */
export function notifyToolCall(name, args) {
    if (process.env.OWA_MCP_NOTICE === '0') {
        return;
    }
    const notice = describeToolNotice(name, args);
    if (notice === null) {
        return;
    }
    const match = typeof args?.page === 'string' ? args.page : undefined;
    const now = Date.now();
    const key = `${match ?? ''}|${notice.text}`;
    if (key === lastKey && now - lastAt < 1200) {
        return;
    }
    lastKey = key;
    lastAt = now;
    let words;
    try {
        words = genNoticeWords(notice);
    } catch (_error) {
        // A dictionary that cannot be read costs the banner its translation,
        // never the banner.
        words = { en: { who: NOTICE_WHO_TEXT, what: notice.text } };
    }
    evaluateInApp(genNoticeExpression(words), { match }).catch(() => {});
}

/**
 * Every `tools/call` on its way in, without touching the MCP server's own
 * dispatch: the transport hands each message to `onmessage`, so that is the
 * one seam both the stdio and the HTTP host already share.
 *
 * Call this AFTER `server.connect`, and only wrap what is there. The SDK
 * CHAINS the handler it finds -- it keeps the old `onmessage` and calls it
 * from the new one -- so an accessor that answers "me" when it reads, and
 * stores what it writes, hands the SDK a closure that calls straight back into
 * this one: every message then recursed until the stack ran out and the whole
 * MCP host answered 500 to `initialize`.
 */
export function watchToolCalls(transport) {
    if (transport === null || typeof transport !== 'object') {
        return transport;
    }
    if (transport.__owaNoticeWrapped === true) {
        return transport;
    }
    const inner = transport.onmessage;
    transport.__owaNoticeWrapped = true;
    transport.onmessage = (message, extra) => {
        try {
            if (message?.method === 'tools/call') {
                notifyToolCall(message.params?.name, message.params?.arguments);
            }
        } catch (_error) {
            // A banner is never a reason for a tool call not to happen.
        }
        return inner?.call(transport, message, extra);
    };
    return transport;
}
