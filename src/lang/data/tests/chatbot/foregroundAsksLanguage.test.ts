import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from 'vitest';

import {
    detectTypedLanguage,
    OTHER_CHAT_LANG_CODE,
    toPackageLangCode,
} from '../../../../chatbot/chatLangHelpers';

// The language a foreground ask is answered in is the one the line is read
// as, so each language's blind foreground lines -- the three held-out sets,
// written by readers never shown any language's words -- are held to being
// read as that language, a language of its family, or a script nobody here
// names (answered in the language it was written in), at least as often as
// they were (2026-11-14, EC-621). Live, a Yoruba message ask on an English
// screen was answered in Portuguese: Yoruba's letters had been its three
// dotted ones alone, and the low-tone vowels it writes on nearly every word
// were Italian's, so 22 of its 55 lines were read as another language --
// 18 of them Italian. With them, 3.
const HELD_OUT_FILE_LIST = [
    'foregroundAsksHeldOut.json',
    'foregroundMessageAsksHeldOut.json',
    'foregroundTimerAsksHeldOut.json',
];
const NOT_A_LINE_KEY_SET = new Set(['floor', 'knownMiss', 'reason']);
const FLOOR_MAP = JSON.parse(
    readFileSync(
        path.join(__dirname, 'foregroundAsksLanguageFloors.json'),
        'utf8',
    ),
) as Record<string, number>;

function readFamilyMap() {
    const familyMap = new Map<string, string>();
    const onlineDirPath = path.join(__dirname, '..', '..', 'online');
    for (const folder of readdirSync(onlineDirPath)) {
        for (const fileName of ['typed.json', 'assistant.json']) {
            const filePath = path.join(onlineDirPath, folder, fileName);
            if (!existsSync(filePath)) {
                continue;
            }
            const data = JSON.parse(readFileSync(filePath, 'utf8')) as Record<
                string,
                { family?: unknown }
            >;
            for (const [code, value] of Object.entries(data)) {
                if (typeof value?.family === 'string') {
                    familyMap.set(toPackageLangCode(code), value.family);
                }
            }
        }
    }
    return familyMap;
}

function collectLines(value: unknown, key: string, lineList: string[]) {
    if (NOT_A_LINE_KEY_SET.has(key)) {
        return;
    }
    if (typeof value === 'string') {
        lineList.push(value);
    } else if (Array.isArray(value)) {
        for (const item of value) {
            collectLines(item, key, lineList);
        }
    } else if (value !== null && typeof value === 'object') {
        for (const [childKey, child] of Object.entries(value)) {
            collectLines(child, childKey, lineList);
        }
    }
}

function readLineMap() {
    const lineMap = new Map<string, string[]>();
    for (const fileName of HELD_OUT_FILE_LIST) {
        const data = JSON.parse(
            readFileSync(path.join(__dirname, fileName), 'utf8'),
        ) as Record<string, unknown>;
        for (const [code, value] of Object.entries(data)) {
            if (code === 'en') {
                continue;
            }
            const lineList = lineMap.get(code) ?? [];
            collectLines(value, '', lineList);
            lineMap.set(code, lineList);
        }
    }
    return lineMap;
}

const FAMILY_MAP = readFamilyMap();
const LINE_MAP = readLineMap();

function checkIsReadAsOwn(code: string, line: string) {
    const found = detectTypedLanguage(line, 'en');
    if (found === null) {
        return false;
    }
    if (found === OTHER_CHAT_LANG_CODE) {
        return true;
    }
    const foundCode = toPackageLangCode(found);
    const ownCode = toPackageLangCode(code);
    if (foundCode === ownCode) {
        return true;
    }
    const family = FAMILY_MAP.get(ownCode);
    return family !== undefined && FAMILY_MAP.get(foundCode) === family;
}

describe('a foreground ask is read as the language it is typed in', () => {
    test('every language with blind lines has a floor', () => {
        expect([...LINE_MAP.keys()].sort()).toEqual(
            Object.keys(FLOOR_MAP).sort(),
        );
    });

    test.each([...LINE_MAP.keys()])('%s, at its floor', (code) => {
        const lineList = LINE_MAP.get(code) ?? [];
        const ownCount = lineList.filter((line) => {
            return checkIsReadAsOwn(code, line);
        }).length;
        expect(ownCount).toBeGreaterThanOrEqual(FLOOR_MAP[code]);
    });
});
