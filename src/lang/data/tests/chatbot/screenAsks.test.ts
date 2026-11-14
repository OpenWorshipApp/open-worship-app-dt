import { readFileSync } from 'node:fs';
import path from 'node:path';

import { afterEach, describe, expect, test } from 'vitest';

import {
    DEFAULT_CHAT_LANG_CODE,
    listAssistantLanguages,
    listTypedLanguages,
    toPackageLangCode,
} from '../../../../chatbot/chatLangHelpers';
import { setChatTranslator } from '../../../../chatbot/chatTranHelpers';
import { readForegroundComponentAsk } from '../../../../chatbot/foregroundChatHelpers';
import type { ScreenAskKindType } from '../../../../chatbot/screenChatHelpers';
import {
    readScreenAsk,
    SCREEN_ASK_WORD_GROUP_LIST,
} from '../../../../chatbot/typedScreenAskHelpers';
import { toLangPackageDir } from '../../../../test-setup/langPackageDirs';

// EC-614 (2026-11-14, the user's goal: _chatbot is very smart to help user
// control screen_): a line about the screens' own controls -- the Bible
// text's look, its versions, Line Sync, a transition, the display a screen
// is on, a group, a lock, a stage number, which screens are ticked, a clear
// -- typed in a language other than English went the general way, where
// the screens' tool is not offered: only English was read
// (`readScreenControlAsk`). Each language says those asks in its own words
// (`screenAsks` in its `typed.json` or `assistant.json`), read by
// `readTypedScreenAsk`. Held to four sets written BLIND, by readers never
// shown the words, each read once before anything was fitted to it: the
// first when the words were made, the second after they were put right
// against the first, the third after the second (whose look-alikes had
// gone to the screens 54 times in 616, 46 of them how-tos), the fourth
// after the third. Of ten asks a
// language, one for each control, it reads at least its `floor`, in its
// own app and in an English one; seven lines that only look like them --
// a verse put up, a countdown, a how-to, a screen turned on, a song's
// words made bigger, a phone's screen, a group of people -- read as none,
// every language installed. A fresh set's asks read about four in five
// (713, 719, 697 and 694 of 880 at their one blind read): the controls are
// said in a long tail of ways. EC-623: a screen called by its number with
// no control's words beside it goes to the screens too -- 697 to 765 of
// the third set's asks, 694 to 770 of the fourth's, read blind both ways;
// the fourth's 17 look-alikes read as a control went to none once the
// words were put right -- and so a passage put up and a screen turned on
// or asked about may reach them THAT way, the screens' tool's own work
// (`owa_present_bible`, `show`, its read); never as one of its controls.
// Read as the window reads a line: a foreground extra it names is the
// foreground's before the screens are asked.
type HeldOutType = {
    asks: Record<ScreenAskKindType, string>;
    others: Record<string, string>;
    floor: number;
};

const HELD_OUT_FILE_LIST = [
    'screenAsksHeldOut.json',
    'screenAsksHeldOut2.json',
    'screenAsksHeldOut3.json',
    'screenAsksHeldOut4.json',
] as const;

// Every package of the checkout stands in for an installed one.
const LANGUAGE_LIST = [
    ...listAssistantLanguages(),
    ...listTypedLanguages(),
].filter((language) => {
    return language.code !== DEFAULT_CHAT_LANG_CODE;
});
const LANGUAGE_CODE_SET = new Set(
    LANGUAGE_LIST.map((language) => {
        return language.code;
    }),
);

// The window's language as `getAppLangCode` reads it off `<html lang>`: a
// script's own tag is its package's language.
function toAppLangCode(code: string) {
    return code.split('-')[0];
}

// The look-alikes the screens' tool does itself, when a screen is called
// by its number.
const SCREEN_TOOL_TOPIC_SET: ReadonlySet<string> = new Set([
    'present',
    'showHide',
]);

const ENGLISH = (key: string) => {
    return key;
};

// The window's labels in an app shown in that language, as `tran` gives
// them: a foreground extra is also named by its panel's label.
const translateMap = new Map<string, (key: string) => string>();
function getTranslate(appLangCode: string) {
    if (appLangCode === DEFAULT_CHAT_LANG_CODE) {
        return ENGLISH;
    }
    let translate = translateMap.get(appLangCode);
    if (translate === undefined) {
        const dictionary = JSON.parse(
            readFileSync(
                path.join(
                    toLangPackageDir(toPackageLangCode(appLangCode)),
                    'dictionary.json',
                ),
                'utf8',
            ),
        ) as Record<string, string>;
        translate = (key: string) => {
            return dictionary[key] ?? key;
        };
        translateMap.set(appLangCode, translate);
    }
    return translate;
}

// What the screens' tool is asked for, as the window decides it on the
// Presenter: null for a line that does not go to it.
function readRouted(line: string, appLangCode: string) {
    // The screens' reader first: a line it reads nothing in is routed
    // nowhere whatever the foreground's reader says, and that one costs a
    // few milliseconds a line with every package installed.
    const kind = readScreenAsk(line, 'presenter', appLangCode);
    if (
        kind === null ||
        readForegroundComponentAsk(line, getTranslate(appLangCode)) !== null
    ) {
        return null;
    }
    return kind;
}

function checkIsRouted(line: string, appLangCode: string) {
    return readRouted(line, appLangCode) !== null;
}

describe('the screens asked about in every language', () => {
    test('every language says its words for the screens and each control', () => {
        const lacking = LANGUAGE_LIST.flatMap((language) => {
            return SCREEN_ASK_WORD_GROUP_LIST.filter((group) => {
                return (language.screenAskWords?.[group] ?? []).length === 0;
            }).map((group) => {
                return `${language.code}.${group}`;
            });
        });
        expect(lacking).toEqual([]);
    });
});

describe.each(HELD_OUT_FILE_LIST)('the set written blind, %s', (fileName) => {
    const heldOutMap = JSON.parse(
        readFileSync(path.join(import.meta.dirname, fileName), 'utf8'),
    ) as Record<string, HeldOutType>;
    const heldOutList = Object.entries(heldOutMap).filter(([code]) => {
        return LANGUAGE_CODE_SET.has(code);
    });

    test.each(heldOutList)(
        '%s reads the controls asked for, at its floor',
        (code, sample) => {
            const readList = Object.values(sample.asks).filter((line) => {
                return (
                    checkIsRouted(line, toAppLangCode(code)) &&
                    checkIsRouted(line, DEFAULT_CHAT_LANG_CODE)
                );
            });
            expect(readList.length).toBeGreaterThanOrEqual(sample.floor);
        },
    );

    test.each(heldOutList)(
        '%s, a line that only looks like one reads none',
        (code, sample) => {
            for (const [topic, line] of Object.entries(sample.others)) {
                for (const appLangCode of [
                    toAppLangCode(code),
                    DEFAULT_CHAT_LANG_CODE,
                ]) {
                    const kind = readRouted(line, appLangCode);
                    expect(
                        kind === null ||
                            (kind === 'screen' &&
                                SCREEN_TOOL_TOPIC_SET.has(topic)),
                        `${appLangCode} ${topic} as ${kind}: ${line}`,
                    ).toBe(true);
                }
            }
        },
    );
});

// EC-630 (2026-11-14): a screen added is read, in another language, by the
// Mini Screen menu's own label alone, as the app shown in that language
// writes it (`checkHasNewScreenLabel`): no package lists words for it. So
// the label reads as one in its own app, and no line of the blind sets --
// an ask for another control or a look-alike -- reads as one, there or in
// an English app.
describe('a screen added, by the menu label', () => {
    afterEach(() => {
        setChatTranslator(ENGLISH, ENGLISH);
    });

    function plugAppLanguage(appLangCode: string) {
        const translate = getTranslate(appLangCode);
        setChatTranslator(translate, translate);
        return translate;
    }

    test.each(
        LANGUAGE_LIST.map((language) => {
            return language.code;
        }),
    )('%s reads its own label as a screen added', (code) => {
        const appLangCode = toAppLangCode(code);
        const label = plugAppLanguage(appLangCode)('Add New Screen');
        for (const line of [label, label.toLowerCase(), `${label}!`]) {
            expect(readScreenAsk(line, 'presenter', appLangCode), line).toBe(
                'newScreen',
            );
        }
    });

    // One test a language and set, as the sets' own tests: all of a set in
    // one test runs past the time a test is given on a busy machine.
    describe.each(HELD_OUT_FILE_LIST)('the set %s', (fileName) => {
        const heldOutMap = JSON.parse(
            readFileSync(path.join(import.meta.dirname, fileName), 'utf8'),
        ) as Record<string, HeldOutType>;
        const heldOutList = Object.entries(heldOutMap).filter(([code]) => {
            return LANGUAGE_CODE_SET.has(code);
        });

        test.each(heldOutList)(
            '%s, no line reads as one, in its own app or an English one',
            (code, sample) => {
                const takenList: string[] = [];
                for (const appLangCode of [
                    toAppLangCode(code),
                    DEFAULT_CHAT_LANG_CODE,
                ]) {
                    plugAppLanguage(appLangCode);
                    for (const line of [
                        ...Object.values(sample.asks),
                        ...Object.values(sample.others),
                    ]) {
                        if (
                            readScreenAsk(line, 'presenter', appLangCode) ===
                            'newScreen'
                        ) {
                            takenList.push(`${appLangCode}: ${line}`);
                        }
                    }
                }
                expect(takenList).toEqual([]);
            },
        );
    });
});
