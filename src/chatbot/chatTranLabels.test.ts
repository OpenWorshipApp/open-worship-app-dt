import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test, vi } from 'vitest';

import { BOT_FOCUS_LIST } from '../../tools/owa-devtools-mcp/botFocus.mjs';
import { extractDictionary } from '../../tools/owa-devtools-mcp/tran.mjs';

vi.mock('../helper/settingHelpers', () => ({
    getSetting: () => null,
    setSetting: () => {},
}));
vi.mock('./helpBotHelpers', () => {
    return { BUILTIN_TOOL_NAME: 'owa-builtin' };
});

import { DISLIKE_REPLY_LIST } from './answerRatingHelpers';
import { LOOKUP_ACTION_LABEL_LIST } from './lookupStepHelpers';
import { READER_ROUTE_LABEL } from './readerRouteHelpers';
import { RESOURCE_ASK_LABEL_TEMPLATE } from './resourcesChatHelpers';
import { SPEND_ALLOW_LABEL } from './spendGuardHelpers';
import { CHAT_TIP_LIST } from './tipHelpers';

// Words the help window translates through a VARIABLE -- a tip handed to the
// window as `tran(tip.text)`, a stored English label drawn with `tranLabel`
// -- which `src/lang/tranKeyCoverage.test.ts` cannot read, since it sees only
// literal keys. A tip missing from the Khmer pack throws in a dev window and
// shows English in a packaged one; a label missing stays English unnoticed.
// So each one is held to its Khmer AND its French here.

const DATA_DIR = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    'lang',
    'data',
);

function readPack(langCode: string) {
    return extractDictionary(
        readFileSync(path.join(DATA_DIR, langCode, 'index.ts'), 'utf-8'),
    );
}

function listMissing(langCode: string, textList: readonly string[]) {
    const dictionary = readPack(langCode);
    return textList.filter((text) => {
        return dictionary[text.trim().toLowerCase()] === undefined;
    });
}

const LANG_CODE_LIST = ['km', 'fr'];

describe('words translated through a variable', () => {
    test('the packs are read, so a green run means something', () => {
        for (const langCode of LANG_CODE_LIST) {
            expect(Object.keys(readPack(langCode)).length).toBeGreaterThan(
                1000,
            );
        }
    });

    test('every tip has its Khmer and French', () => {
        const tipTextList = CHAT_TIP_LIST.map((tip) => {
            return tip.text;
        });
        for (const langCode of LANG_CODE_LIST) {
            expect(listMissing(langCode, tipTextList), langCode).toEqual([]);
        }
    });

    test('every stored label drawn translated has its Khmer and French', () => {
        const labelList = [
            ...DISLIKE_REPLY_LIST,
            SPEND_ALLOW_LABEL,
            READER_ROUTE_LABEL,
            RESOURCE_ASK_LABEL_TEMPLATE,
        ];
        for (const langCode of LANG_CODE_LIST) {
            expect(listMissing(langCode, labelList), langCode).toEqual([]);
        }
    });

    // Button labels code matches on (`WALKTHROUGH_ACTION_PATTERN`,
    // `DRAFT_ACTION_PATTERN`, a typed reply matched to a button): stored in
    // English and drawn with `tranLabel`.
    test('every English-stored action label has its Khmer and French', () => {
        const labelList = [
            'Show me step by step',
            'Do it for me',
            'Read the whole thing',
            "I'm there — start it",
            'Turn the screen on',
            'Hide every screen',
            'Turn every screen off',
            'Clear everything on it',
            'Go to the Presenter',
            'Show the next slide',
            'Back one slide',
            'Back one',
            'Show its first slide',
            'Is the screen on?',
            'Take it off again',
            'Check the screen',
            'Copy song text',
            'Open AI settings',
            'Show me Bible Find',
            // `verseFindChatHelpers`' two, written out: that module brings
            // the Bible import's app-side imports with it.
            'Search another Bible',
            'Show in another Bible',
            'No thanks',
            'Send report',
            'Copy report',
            'That fixed it',
            'Still a problem — report it',
            'Copy subject',
            'Copy picture',
            'Copy email address',
            'Email it',
            'Show it in the list',
            'Create "{name}"',
            'Free',
            'Custom servers',
            // `llmBotHelpers`' button under an answer that says to type
            // `/btw` (`GENERAL_ASK_LABEL`).
            'Ask it as a general question',
            // The things to do with a person, place or passage.
            ...LOOKUP_ACTION_LABEL_LIST,
        ];
        for (const langCode of LANG_CODE_LIST) {
            expect(listMissing(langCode, labelList), langCode).toEqual([]);
        }
    });

    // Read off the source, not imported: the commands module pulls the
    // whole tool client in, which a node test cannot load.
    test('every command hint has its Khmer and French', () => {
        const source = readFileSync(
            path.join(
                path.dirname(fileURLToPath(import.meta.url)),
                'builtinActionHelpers.ts',
            ),
            'utf-8',
        );
        const hintList = [
            ...source.matchAll(/^\s+hint:\s*\n?\s*'((?:[^'\\]|\\.)*)',?$/gm),
        ].map((match) => {
            return match[1].replace(/\\'/g, "'");
        });
        expect(hintList.length).toBeGreaterThan(20);
        for (const langCode of LANG_CODE_LIST) {
            expect(listMissing(langCode, hintList), langCode).toEqual([]);
        }
    });

    test('every window name, the way into it and the find tool’s places', () => {
        const textList = [
            ...BOT_FOCUS_LIST.flatMap((item) => {
                return [item.label, item.howToOpen];
            }),
            'in the middle of the window',
            ...['top', 'middle', 'bottom'].flatMap((row) => {
                return ['left', 'center', 'right']
                    .filter((column) => {
                        return !(row === 'middle' && column === 'center');
                    })
                    .map((column) => {
                        return `at the ${row} ${column} of the window`;
                    });
            }),
        ];
        for (const langCode of LANG_CODE_LIST) {
            expect(listMissing(langCode, textList), langCode).toEqual([]);
        }
    });
});
