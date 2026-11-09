/**
 * An answer put into the shape somebody who reads NO English can use
 * (2026-10-17, the user: _when app is in Khmer we don't expect user can
 * understand english at all_). Measured on the elder-persona run the same
 * day, a model told to write Khmer still wrote English into it, in two ways
 * this module undoes in code, whatever the model:
 *
 * - **A gloss in brackets** after the Khmer words: the Khmer for the gear
 *   then _(Settings)_, a Khmer reference then _(Psalm 23:1)_, the Khmer for
 *   a mouse then _(mouse)_ -- English the reader cannot read beside words
 *   they already have. Taken out, only in a
 *   language with a script of its own (in French an English bracket cannot
 *   be told from a French one), and never a key as printed on the keyboard
 *   (_(Ctrl+S)_), a command, an address, or a bracket that holds any of the
 *   language's own letters.
 * - **A button named in English**: the Khmer for "press the button" then
 *   _🖥️ Go Back to Presenter_, the Khmer for "box" then _Mini Screen_ -- the
 *   words on the button are Khmer in a Khmer
 *   window. A run of capitalised English words that the app's own dictionary
 *   holds as a label is written as the label shows. The whole run, or two
 *   words or more of it -- never one word out of a longer name (_Open_ in
 *   _Open Worship App_ is not the **Open** button) -- and never a key.
 *
 * Pure: the dictionary comes in as `translateLabel` (`tranLabel`).
 *
 * What an answer is ABOUT is never taken out (`AnswerKeepType`, 2026-10-23):
 * an answer about a passage of the Greek Bible quotes Greek, which the
 * third-script rule below had deleted letter by letter in a Khmer window.
 */

import {
    COLON_MARKS,
    DEFAULT_CHAT_LANG_CODE,
    detectTypedLanguage,
    getAssistantLanguage,
    listTextScriptPatterns,
    SENTENCE_END_MARKS,
    toCharClassSource,
} from './chatLangHelpers';
import { toBoldLabelsShown } from './chatTranslateHelpers';

// Words a key is printed with. A key keeps its English: it is what the key
// cap says.
const KEY_WORD_SET = new Set([
    'ctrl',
    'control',
    'shift',
    'alt',
    'option',
    'cmd',
    'command',
    'fn',
    'win',
    'windows',
    'esc',
    'escape',
    'enter',
    'return',
    'tab',
    'space',
    'spacebar',
    'delete',
    'del',
    'backspace',
    'home',
    'end',
    'insert',
    'pageup',
    'pagedown',
    'up',
    'down',
    'left',
    'right',
]);

function checkIsKeyWords(text: string) {
    const parts = text
        .replace(/[[\]]/g, ' ')
        .split(/[\s+]+/)
        .filter((part) => {
            return part.length > 0;
        });
    return (
        parts.length > 0 &&
        parts.every((part) => {
            const lower = part.toLowerCase();
            return (
                KEY_WORD_SET.has(lower) ||
                /^f\d{1,2}$/.test(lower) ||
                [...part].length === 1
            );
        })
    );
}

// A bracket's content, up to 60 characters on one line.
const BRACKET_PATTERN = /[ \t]*[(（]([^()（）\n]{1,60})[)）]/gu;

function dropEnglishGlosses(text: string, scriptPattern: RegExp) {
    return text.replace(
        BRACKET_PATTERN,
        (whole: string, inner: string, at: number, all: string) => {
            // Read past the marks that close a bold or a quote: a book named
            // in bold -- its Khmer name in bold, then (Hebrews) -- kept its
            // English, the last thing before the bracket being an asterisk
            // (2026-10-23).
            const before = all
                .slice(0, at)
                .trimEnd()
                .replace(/[*_"”'’»]+$/u, '');
            const lastBefore = [...before].pop() ?? '';
            if (
                !scriptPattern.test(lastBefore) ||
                scriptPattern.test(inner) ||
                !/\p{Script=Latin}/u.test(inner) ||
                /[/\\@`]|https?:|www\./i.test(inner) ||
                checkIsKeyWords(inner)
            ) {
                return whole;
            }
            return '';
        },
    );
}

const LETTER_PATTERN = /\p{L}/u;
const MARK_PATTERN = /\p{M}/u;
// A combining sign that belongs to no one script -- an accent, a dot -- or
// to every script that uses it.
const INHERITED_SCRIPT_PATTERN = /[\p{Script=Inherited}\p{Script=Common}]/u;
const LATIN_PATTERN = /\p{Script=Latin}/u;

/**
 * What an answer is about, and so must keep whatever the reader's language
 * (2026-10-23): `scriptText` -- a passage, a verse being studied -- keeps
 * the letters of every script it is written in; `isLatinKept` keeps English
 * words too, for a lesson on an English verse's own words.
 */
export type AnswerKeepType = {
    scriptText?: string;
    isLatinKept?: boolean;
};

// The scripts of `text` other than Latin, each as a letter's test: a closed
// list (`listTextScriptPatterns`), because JavaScript names no script of a
// letter, only tests one.
const listKeptScripts = listTextScriptPatterns;

/**
 * The letters of a THIRD script -- neither the language's own nor Latin --
 * taken out with the signs on them. A model writing Khmer slips into another
 * script mid-word: measured 2026-10-17 on the whole corpus asked in Khmer,
 * Chinese, Telugu and Bengali letters in a chip, an Arabic word -- letters
 * the reader cannot even sound out (`EC-295`). Latin is
 * left to the label rules and the gloss rule above. A script the answer's
 * subject is written in (`keptScripts`) is no third script: a Greek
 * passage's words are what an answer about it quotes.
 */
function dropThirdScriptLetters(
    text: string,
    scriptPattern: RegExp,
    keptScripts: RegExp[] = [],
) {
    let shown = '';
    let isDropping = false;
    for (const character of text) {
        if (MARK_PATTERN.test(character)) {
            // A third script's own sign goes even on the language's letter:
            // a Tibetan vowel sign on a Khmer consonant, in a Khmer word
            // lesson's way to say a Hebrew word (2026-10-23).
            // A sign every script shares (an accent) is not one.
            const isThirdScriptSign =
                !INHERITED_SCRIPT_PATTERN.test(character) &&
                !scriptPattern.test(character) &&
                !keptScripts.some((pattern) => {
                    return pattern.test(character);
                });
            if (!isDropping && !isThirdScriptSign) {
                shown += character;
            }
            continue;
        }
        isDropping =
            LETTER_PATTERN.test(character) &&
            !scriptPattern.test(character) &&
            !LATIN_PATTERN.test(character) &&
            !keptScripts.some((pattern) => {
                return pattern.test(character);
            });
        if (!isDropping) {
            shown += character;
        }
    }
    return shown;
}

/**
 * A lowercase Latin word INSIDE the language's own words -- glued to them or
 * between two of them -- which no reader of that script can read: a model
 * writing Khmer slips into another language's word mid-sentence. Measured
 * 2026-10-23: _podkre_ (Polish for "underline") between Khmer words, where
 * the Khmer for highlighted belongs, in both answers about the person's own
 * highlights, and in the saved runs _le_, _honneur_ and _aur_ glued to
 * Khmer letters -- 2 641 Khmer texts held no other. Taken out with the
 * space before it, when the script's letters come before it and the
 * script's letters, a clause's mark or a bracket after (Khmer, then
 * _podkre (Highlights):_ -- the gloss rule takes the bracket next). Never a
 * capitalised word (a name, or a label the rules below translate), a word
 * with a digit or a dot, or one at the edge of the text -- a file name, an
 * address, a code or a key never has the script's letters before it.
 */
const STRAY_LATIN_WORD_PATTERN =
    /(\S)([ \u200B]*)([a-z][a-z'’]*[a-z])(?=[ \u200B]*(\S)(\S?))/gu;
const STRAY_WORD_END_PATTERN = new RegExp(
    `[(:;,?!${toCharClassSource(SENTENCE_END_MARKS + COLON_MARKS)}]`,
    'u',
);
// A sentence's end in any script here, and a line's.
const SENTENCE_END_CLASS = `.!?${toCharClassSource(SENTENCE_END_MARKS)}\\n`;

function dropStrayLatinWords(text: string, scriptPattern: RegExp) {
    return text.replace(
        STRAY_LATIN_WORD_PATTERN,
        (match, before: string, _gap, _word, after: string, next: string) => {
            // A colon glued to what follows is a prefix -- `ol:Verse 2`,
            // `http:` -- not the end of a clause.
            const isEnd =
                STRAY_WORD_END_PATTERN.test(after) &&
                !(after === ':' && next !== '');
            return scriptPattern.test(before) &&
                (scriptPattern.test(after) || isEnd)
                ? before
                : match;
        },
    );
}

// Small words a label's name may hold between its capitalised ones:
// "Go Back to Presenter", "Save bible item and show on screen".
const LABEL_JOINER_SOURCE =
    '(?:to|of|the|and|a|an|in|on|for|by|with|from|or|as|at)';
const LABEL_WORD_SOURCE = "[A-Z][A-Za-z'’-]*";
const LABEL_RUN_PATTERN = new RegExp(
    `(?<![\\p{L}\\p{N}])${LABEL_WORD_SOURCE}` +
        `(?:[ ]+(?:${LABEL_JOINER_SOURCE}[ ]+)*${LABEL_WORD_SOURCE})*`,
    'gu',
);

function translateRun(
    run: string,
    translateLabel: (label: string) => string,
): string {
    const words = run.split(/[ ]+/);
    const tryOne = (label: string) => {
        if (checkIsKeyWords(label)) {
            return null;
        }
        const shown = translateLabel(label);
        return shown !== label && shown.trim().length > 0 ? shown : null;
    };
    const whole = tryOne(run);
    if (whole !== null) {
        return whole;
    }
    // The longest stretch of two words or more the dictionary knows, then
    // what is left on either side of it, the same way.
    for (let size = words.length - 1; size >= 2; size -= 1) {
        for (let start = 0; start + size <= words.length; start += 1) {
            const label = words.slice(start, start + size).join(' ');
            const shown = tryOne(label);
            if (shown === null) {
                continue;
            }
            const head = words.slice(0, start).join(' ');
            const tail = words.slice(start + size).join(' ');
            return [
                head.length === 0 ? '' : translateRun(head, translateLabel),
                shown,
                tail.length === 0 ? '' : translateRun(tail, translateLabel),
            ]
                .filter((part) => {
                    return part.length > 0;
                })
                .join(' ');
        }
    }
    return run;
}

// The menu bar is drawn by the OS with English names in every language
// (`electron/electronMenu.ts`), so a menu path starts with one of these as
// it stands: _Help → …_. Measured on the whole corpus asked in Khmer
// (2026-10-17, `EC-316`): the Khmer for "Help → Keyboard Shortcuts" under
// eight questions, a name the volunteer cannot find on the bar.
const MENU_BAR_NAME_LIST = ['File', 'Edit', 'View', 'Tools', 'Window', 'Help'];

/**
 * The items those menus draw in English too: written in
 * `electron/electronMenu.ts` as they stand, never through `tran` -- unlike
 * the items a window adds to them (Tools → Start Controlling, View → Widgets,
 * Help → Tips of the Day), which are translated. Pass 6 of the corpus asked
 * in Khmer: _Help →_ with AI Chat in Khmer under three answers and _Edit →_
 * with Find in Khmer, words nobody finds in that menu. A test holds the list
 * to that file.
 */
export const NATIVE_MENU_ITEM_MAP: Record<string, string[]> = {
    File: ['Print', 'Print Without Preview'],
    Edit: ['Find', 'Speech', 'Settings...'],
    View: ['Relaunch'],
    Tools: ['Local Web Share', 'Google Fonts'],
    Window: ['Reset Position and Size'],
    Help: [
        'Copy Debug Info',
        'Copy Full Debug Info',
        'Factory Reset',
        'App Help (Chatbot)',
        'Report a Problem',
        'AI Chat',
        'Learn More',
        'Check for Updates',
        'Check for Updates Online',
    ],
};

/**
 * Items a window adds to those menus that nothing else in the app carries:
 * the menu's name before one of them, in the same sentence, is the menu --
 * "click Help, then choose Tips of the Day", in Khmer (pass 7, EC-326; the
 * **?** button has no tips). Not **Open
 * Online Help** or **Report a Problem**: that button carries them too.
 */
const MENU_ONLY_ITEM_MAP: Record<string, string[]> = {
    Help: ['Tips of the Day', 'All tips', 'Keyboard Shortcuts'],
    View: ['Widgets', 'Reset Widgets Size'],
    Tools: ['Start Controlling', 'App Assistant'],
};

function checkIsBeforeMenuItem(
    menu: string,
    after: string,
    translateLabel: (label: string) => string,
) {
    const sentence = after
        .split(new RegExp(`[${SENTENCE_END_CLASS}]`, 'u'))[0]
        .slice(0, 60);
    return [
        ...(MENU_ONLY_ITEM_MAP[menu] ?? []),
        ...(NATIVE_MENU_ITEM_MAP[menu] ?? []).filter((item) => {
            return item !== 'Report a Problem';
        }),
    ].some((item) => {
        const local = translateLabel(item).trim();
        return (
            sentence.includes(item) ||
            (local.length > 0 && sentence.includes(local))
        );
    });
}

// A menu-bar name and its arrow right before what follows: _Help → _.
function toAfterMenuPattern(menu: string) {
    return new RegExp(
        `\\b${menu}(?:\\*\\*)?[ \\t]*${MENU_ARROW_SOURCE}[ \\t]*(?:\\*\\*)?[ \\t]*$`,
        'u',
    );
}

// Whether a native item of the menu named just before `at` starts there.
function checkIsNativeMenuItemAt(all: string, at: number) {
    const before = all.slice(0, at);
    return Object.entries(NATIVE_MENU_ITEM_MAP).some(([menu, items]) => {
        return (
            items.some((item) => {
                return all.startsWith(item, at);
            }) && toAfterMenuPattern(menu).test(before)
        );
    });
}
const MENU_ARROW_SOURCE = '(?:→|›|->|>)';
const MENU_ARROW_AFTER_PATTERN = new RegExp(
    `^[ \\t]*(?:\\*\\*)?[ \\t]*${MENU_ARROW_SOURCE}`,
    'u',
);
const MENU_ARROW_BEFORE_PATTERN = new RegExp(
    `${MENU_ARROW_SOURCE}[ \\t]*(?:\\*\\*)?[ \\t]*$`,
    'u',
);

/**
 * Open Lyric's part names, typed as they stand after `ol:` in a song file
 * (_`ol:Verse 1`_) — read in English by the app whatever the language. The
 * headers of `OPEN_LYRIC_FENCE_LIST` (`tools/owa-devtools-mcp/openLyric.mjs`,
 * 50 KB this window does not load for one list); a test holds the two equal.
 */
export const LYRIC_PART_NAME_LIST = [
    'Config',
    'Intro',
    'Final-Chorus',
    'Pre-Chorus',
    'Post-Chorus',
    'Refrain',
    'Bridge',
    'Chorus',
    'Verse',
    'Note',
    'Tag',
    'Turnaround',
    'Outro',
    'Instrumental',
    'Interlude',
    'Breakdown',
    'Vamp',
    'Solo',
];

const CODE_SPAN_PATTERN = /(```[\s\S]*?```|`[^`\n]*`)/;

/**
 * Whether a run is a song part as a song names it, not a word to translate:
 * with its number after it (a slide's own name, _(2)-Verse 1_), or beside
 * another part name in the same sentence (_Verse V, Chorus C, Bridge B_).
 * The dictionary's _Verse_ is a Bible verse, and pass 8 of the whole list
 * asked in Khmer had _(2)-_ and the Khmer for a Bible verse, then _1_, for a
 * song's slide and a list of part names with Verse alone translated
 * (EC-329).
 */
function checkIsSongPartName(run: string, at: number, all: string) {
    if (!LYRIC_PART_NAME_LIST.includes(run) || run === 'Note') {
        return false;
    }
    const after = all.slice(at + run.length);
    if (/^[ \t]*\d/.test(after)) {
        return true;
    }
    const start = Math.max(
        ...['.', '\n', ...SENTENCE_END_MARKS].map((mark) => {
            return all.lastIndexOf(mark, at);
        }),
    );
    const end = after.search(
        new RegExp(`[.\\n${toCharClassSource(SENTENCE_END_MARKS)}]`, 'u'),
    );
    const sentence =
        all.slice(start + 1, at) + (end === -1 ? after : after.slice(0, end));
    return LYRIC_PART_NAME_LIST.some((name) => {
        return name !== run && new RegExp(`\\b${name}\\b`).test(sentence);
    });
}

function escapeForPattern(text: string) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// The language's word for a menu right before a name: its word for "menu",
// then _**Help**_.
function toMenuWordBeforePattern(menuWords: string[]) {
    if (menuWords.length === 0) {
        return null;
    }
    return new RegExp(
        `(?:${menuWords.map(escapeForPattern).join('|')})[ \\t]*(?:\\*\\*)?[ \\t]*$`,
        'iu',
    );
}

// A control named in QUOTES rather than bold: _"Its verses"_. Only a phrase
// of two words or more, and only one the dictionary knows -- a quoted single
// word is as likely to be a word being discussed as a button, and a menu name
// is put back afterwards.
const QUOTED_LABEL_PATTERN = /["“]([A-Za-z][^"“”\n]{2,60})["”]/gu;

function translateQuotedLabels(
    text: string,
    translateLabel: (label: string) => string,
) {
    return text.replace(QUOTED_LABEL_PATTERN, (whole, label: string) => {
        if (!label.includes(' ')) {
            return whole;
        }
        const shown = translateLabel(label.trim());
        return shown === label.trim() ? whole : `"${shown}"`;
    });
}

function translateEnglishLabels(
    text: string,
    translateLabel: (label: string) => string,
    menuWords: string[],
    // The run of capitalised words, read as a label wherever it stands. Not in
    // a language only TYPED that is written in Latin letters: its own words
    // may be capitalised and spelt as an English label -- every German noun,
    // _Text_, _Position_ -- and nothing here knows them apart. A control
    // named in bold or in quotes is a control in any language.
    isRunRead = true,
) {
    const menuWordBeforePattern = toMenuWordBeforePattern(menuWords);
    // What is in code is typed as it stands: a file name, `ol:Verse 1`.
    return text
        .split(CODE_SPAN_PATTERN)
        .map((part, index) => {
            if (index % 2 === 1) {
                return part;
            }
            // A control's name in **bold** first, as a whole: the run below
            // wants every word capitalised, so a sentence-case label the
            // lookup card carries -- **Its verses**, **Family and places**,
            // **Open another passage** -- was read as its first word only and
            // left in English inside a Khmer answer (seen live 2026-10-19).
            // Menu names this translates are put back by
            // `restoreEnglishNames` after it.
            const labelled = translateQuotedLabels(
                toBoldLabelsShown(part, translateLabel),
                translateLabel,
            );
            if (!isRunRead) {
                return labelled;
            }
            return labelled.replace(
                LABEL_RUN_PATTERN,
                (run: string, at: number, all: string) => {
                    const before = all.slice(0, at);
                    if (
                        /[A-Za-z]:$/.test(before) ||
                        checkIsNativeMenuItemAt(all, at) ||
                        checkIsSongPartName(run, at, all) ||
                        (MENU_BAR_NAME_LIST.includes(run) &&
                            (MENU_ARROW_AFTER_PATTERN.test(
                                all.slice(at + run.length),
                            ) ||
                                menuWordBeforePattern?.test(before) === true))
                    ) {
                        return run;
                    }
                    return translateRun(run, translateLabel);
                },
            );
        })
        .join('');
}

/**
 * The English a model translated that the app shows in English: the menu
 * bar's name at the head of a menu path (the Khmer for Help, then _→ …_, is
 * _Help → …_) and a song part after `ol:` (`ol:` and the Khmer for a Bible
 * verse, then 1, is _ol:Verse 1_). Read through the
 * dictionary, so any language's words for them are known.
 */
function restoreEnglishNames(
    text: string,
    translateLabel: (label: string) => string,
    menuWords: string[],
) {
    const menuWordBeforePattern = toMenuWordBeforePattern(menuWords);
    let shown = text;
    for (const name of MENU_BAR_NAME_LIST) {
        const local = translateLabel(name).trim();
        if (local === name || local.length === 0 || !shown.includes(local)) {
            continue;
        }
        // Before an arrow, or after the word for a menu -- and then a whole
        // word, not the start of a longer one (the Khmer for "menu" then
        // "assistant", which starts with the Khmer for "help", is the
        // assistant's menu).
        const pattern = new RegExp(
            `${escapeForPattern(local)}(?=(?:\\*\\*)?[ \\t]*${MENU_ARROW_SOURCE}|(?![\\p{L}\\p{M}]))`,
            'gu',
        );
        shown = shown.replace(pattern, (match, at: number, all: string) => {
            const before = all.slice(0, at);
            const isBeforeArrow = new RegExp(
                `^(?:\\*\\*)?[ \\t]*${MENU_ARROW_SOURCE}`,
                'u',
            ).test(all.slice(at + match.length));
            const isAfterMenuWord =
                menuWordBeforePattern?.test(before) === true;
            const isBeforeItem = checkIsBeforeMenuItem(
                name,
                all.slice(at + match.length),
                translateLabel,
            );
            if (
                (!isBeforeArrow && !isAfterMenuWord && !isBeforeItem) ||
                (isBeforeArrow &&
                    !isAfterMenuWord &&
                    MENU_ARROW_BEFORE_PATTERN.test(before))
            ) {
                return local;
            }
            // Glued to the words before it, as a script with no spaces
            // writes: the English name needs one.
            const last = [...before].pop() ?? '';
            return /[\p{L}\p{M}]/u.test(last) ? ` ${name}` : name;
        });
    }
    // Then the native items after the names put back: _Help →_ and AI Chat
    // in Khmer is _Help → AI Chat_, and so is the item a few words on in the
    // same sentence, with no other menu named between ("the Help menu, then
    // choose Report a Problem", in Khmer).
    for (const [menu, items] of Object.entries(NATIVE_MENU_ITEM_MAP)) {
        if (!shown.includes(menu)) {
            continue;
        }
        for (const item of items) {
            const local = translateLabel(item).trim();
            if (
                local === item ||
                local.length === 0 ||
                !shown.includes(local)
            ) {
                continue;
            }
            shown = shown.replace(
                new RegExp(
                    `(\\b${menu}\\b)([^${SENTENCE_END_CLASS}]{0,40}?)` +
                        `${escapeForPattern(local)}(?![\\p{L}\\p{M}])`,
                    'gu',
                ),
                (match, head: string, gap: string) => {
                    const isOtherMenuBetween = MENU_BAR_NAME_LIST.some(
                        (name) => {
                            return new RegExp(`\\b${name}\\b`).test(gap);
                        },
                    );
                    return isOtherMenuBetween ? match : `${head}${gap}${item}`;
                },
            );
        }
    }
    for (const name of LYRIC_PART_NAME_LIST) {
        const local = translateLabel(name).trim();
        if (local === name || local.length === 0 || !shown.includes(local)) {
            continue;
        }
        shown = shown.replace(
            new RegExp(`ol:[ \\t]?${escapeForPattern(local)}`, 'gu'),
            `ol:${name}`,
        );
    }
    return shown;
}

// A capitalised Latin word alone between two letters of another script, the
// letter after it read ahead so two such words in a row are both seen.
const LONE_LATIN_WORD_PATTERN =
    /([\p{L}\p{M}])[ \u200B]+(\p{Lu}\p{Ll}+)(?=[ \u200B]+([\p{L}\p{M}]))/gu;

/**
 * Whether a chip holds a word of a THIRD language the reader cannot read:
 * capitalised, in Latin letters, alone between the reader's own script's
 * letters, and never said in the answer it is under (2026-11-04, `EC-459`:
 * Khmer for "how do I make it", then the Malay _Kecil_ ("small"), then Khmer
 * for "again", under a Khmer answer about text size). `dropStrayLatinWords`
 * takes only a lowercase word, as a capitalised one may be a name the person
 * sees; a chip is their own next words, pressed with no reading, so one
 * there that the answer never named goes whole. Measured on the 7 578
 * Khmer texts of the saved runs that day: eight words stood so -- the
 * other seven a key (Enter), names (Noah, Urartu), products (Google,
 * Ollama, Markdown) and a button (Widgets). A key stays, and so does a name
 * the answer says.
 */
function checkHasUnsaidLatinWord(
    reply: string,
    scriptPattern: RegExp,
    saidText: string,
    translateLabel: (label: string) => string,
) {
    for (const match of reply.matchAll(LONE_LATIN_WORD_PATTERN)) {
        const [, before, word, after] = match;
        if (
            !scriptPattern.test(before) ||
            !scriptPattern.test(after) ||
            checkIsKeyWords(word) ||
            MENU_BAR_NAME_LIST.includes(word) ||
            translateLabel(word) !== word
        ) {
            continue;
        }
        // The word itself is letters only: no pattern sign to escape.
        const saidPattern = new RegExp(
            `(?<![\\p{L}\\p{M}])${word}(?![\\p{L}\\p{M}])`,
            'iu',
        );
        if (!saidPattern.test(saidText)) {
            return true;
        }
    }
    return false;
}

/**
 * The reply chips a reader of `langCode` can read. Each is cleaned as the
 * answer is; in a language with a script of its own, a chip with none of its
 * letters left is dropped -- English the person cannot read, measured under
 * Khmer answers on 2026-10-17 (_How do I show it on screen?_, _Look up
 * another verse_, _/btw what does the Bible Reader do?_): a model working
 * in English behind the scenes leaves its own chips when the translator
 * drops the `OPTIONS:` line, and the verse finder is not translated at all.
 * In a language written in Latin letters too, a chip that reads as English
 * goes (2026-11-03: _The words are big enough now_ under a translated answer
 * whose `OPTIONS:` line the translator had dropped).
 *
 * `screenLangCode` is the language the app's SCREEN is in, by default the
 * reader's own: on an English screen a capitalised English name in a chip is
 * the button it names (_Font Size_ then Chinese for "still too small"), not
 * English the reader cannot
 * read.
 *
 * `answerText` is what the answer says above the chips. Given, a chip in a
 * language with a script of its own goes when it holds a capitalised Latin
 * word alone between that script's letters which the answer never says
 * (`checkHasUnsaidLatinWord`).
 */
export function toRepliesShownInLanguage(
    replies: string[],
    langCode: string,
    translateLabel: (label: string) => string,
    keep?: AnswerKeepType,
    screenLangCode = langCode,
    answerText?: string,
): string[] {
    const language = getAssistantLanguage(langCode);
    const isScreenEnglish = screenLangCode === DEFAULT_CHAT_LANG_CODE;
    const saidText =
        answerText === undefined || keep?.isLatinKept === true
            ? null
            : `${answerText}\n${keep?.scriptText ?? ''}`;
    return replies
        .map((reply) => {
            return toAnswerShownInLanguage(
                reply,
                langCode,
                translateLabel,
                keep,
                screenLangCode,
            );
        })
        .filter((reply) => {
            if (
                langCode === DEFAULT_CHAT_LANG_CODE ||
                language.code !== langCode
            ) {
                return true;
            }
            if (language.isLatinScript) {
                return (
                    detectTypedLanguage(reply, langCode) !==
                    DEFAULT_CHAT_LANG_CODE
                );
            }
            // Mostly the reader's own letters: a Khmer "no" then _thanks_, and
            // _Back to the_ then a Khmer button's name, carry a few and are
            // still English to them. And never a command to type (_/btw_ then
            // Khmer words): the answer's own
            // **Ask it as a general question** is the press for that.
            if (reply.trim().startsWith('/')) {
                return false;
            }
            if (
                saidText !== null &&
                checkHasUnsaidLatinWord(
                    reply,
                    language.scriptPattern,
                    saidText,
                    translateLabel,
                )
            ) {
                return false;
            }
            // A script's letters are counted with their vowel signs and
            // subscripts, so a few Khmer words outnumber an English phrase
            // letter for letter: three of theirs to one Latin letter, a key
            // cap or a short name in capitals (F5, KJV) not counted -- nor,
            // on an English screen, a button's capitalised name.
            const own = [...reply].filter((character) => {
                return language.scriptPattern.test(character);
            }).length;
            const latin = (reply.match(/\p{Script=Latin}+/gu) ?? [])
                .filter((word) => {
                    return (
                        word !== word.toUpperCase() &&
                        !(isScreenEnglish && /^\p{Lu}/u.test(word))
                    );
                })
                .join('').length;
            return own > 0 && own >= latin * 3;
        });
}

/**
 * The answer as it is shown to somebody reading `langCode` on a screen in
 * `screenLangCode` (by default their own language, the case this module was
 * written for): unchanged for English, and with no button named in English
 * otherwise -- and, where the screen is not in English, no English bracket
 * gloss. On an English screen the gloss is the word the reader has to find
 * there (Chinese for settings, then _(Settings)_), and stays.
 */
export function toAnswerShownInLanguage(
    text: string,
    langCode: string,
    translateLabel: (label: string) => string,
    keep?: AnswerKeepType,
    screenLangCode = langCode,
): string {
    if (langCode === DEFAULT_CHAT_LANG_CODE || text.length === 0) {
        return text;
    }
    const language = getAssistantLanguage(langCode);
    if (language.code !== langCode) {
        return text;
    }
    const screenLanguage = getAssistantLanguage(screenLangCode);
    // The screen's own letters are no third script: a Thai answer in a Khmer
    // window names its buttons as that window draws them.
    const keptScripts = [
        ...listKeptScripts(keep?.scriptText),
        ...(screenLanguage.code !== language.code &&
        !screenLanguage.isLatinScript
            ? [screenLanguage.scriptPattern]
            : []),
    ];
    // A lesson on an English verse's words keeps its English: the words ARE
    // the lesson, and a gloss in brackets is the word being taught -- nor is
    // one of them a button to write in the window's words.
    if (keep?.isLatinKept === true) {
        return language.isLatinScript
            ? text
            : dropThirdScriptLetters(text, language.scriptPattern, keptScripts);
    }
    // The glosses first: the Khmer for Presenting Flow then "(Presenting
    // Flow)", translated first, would read the Khmer twice.
    let shown = text;
    if (!language.isLatinScript) {
        shown = dropStrayLatinWords(
            dropThirdScriptLetters(text, language.scriptPattern, keptScripts),
            language.scriptPattern,
        );
        if (screenLanguage.code !== DEFAULT_CHAT_LANG_CODE) {
            shown = dropEnglishGlosses(shown, language.scriptPattern);
        }
    }
    // A run of capitalised words is read as a label only where the answer's
    // own words cannot be taken for English ones: a script of its own, or
    // the screen's own language, whose dictionary gives its word back. A
    // Latin-script answer in a window shown in another language reads its
    // own capitalised words as labels as a language only typed would
    // (2026-11-04: _la Bible_ in a French answer, in a Khmer window, came
    // out with the Khmer for the Bible tab in the middle of the French).
    return restoreEnglishNames(
        translateEnglishLabels(
            shown,
            translateLabel,
            language.menuWords,
            !language.isLatinScript ||
                (language.isPackaged && language.code === screenLanguage.code),
        ),
        translateLabel,
        language.menuWords,
    );
}
