import { describe, expect, it } from 'vitest';

import { applyStudyReplaceChecked } from './studyNameCheckHelpers';
import {
    applyStudyReplace,
    toStudyReplaceList,
} from '../helper/agentStudyFileRules';

// A made-up language written in one Unicode block whose vowels are signs on
// its letters, made by code point so no word of any language is written here
// (the fixture of `studyNameCheckHelpers.test.ts`, copied).
function letter(index: number) {
    return String.fromCodePoint(0x1000 + index);
}
const VOWEL_I = String.fromCodePoint(0x102d);
const VOWEL_II = String.fromCodePoint(0x102e);
const VOWEL_U = String.fromCodePoint(0x102f);

function toScriptDigits(text: string) {
    return text.replace(/\d/g, (digit) => {
        return String.fromCodePoint(0x1040 + Number(digit));
    });
}

const ZENON = `${letter(0)}${VOWEL_I}${letter(1)}${letter(2)}${VOWEL_U}`;
const ZENON_SLIP = `${letter(0)}${VOWEL_II}${letter(1)}${letter(2)}${VOWEL_U}`;
// The same place written with a third vowel sign by another translation.
const ZENON_SLIP_U = `${letter(0)}${VOWEL_U}${letter(1)}${letter(2)}${VOWEL_U}`;
const QALIM = `${letter(3)}${VOWEL_U}${letter(4)}${letter(5)}${VOWEL_I}`;
const PHARISEES = `${letter(9)}${VOWEL_I}${letter(10)}${letter(11)}${VOWEL_I}`;
const PHARISEES_SLIP = `${letter(9)}${VOWEL_II}${letter(10)}${letter(11)}${VOWEL_I}`;
const WORD_A = `${letter(12)}${letter(13)}`;
const WORD_B = `${letter(14)}${VOWEL_U}${letter(15)}${letter(16)}`;
const WORD_C = `${letter(17)}${letter(18)}${VOWEL_I}${letter(19)}`;

const ENGLISH_HALF = [
    '# The New Birth',
    '',
    '> **John 3:22-23** (KJV)',
    '>',
    '> **22** After these things came Jesus and his disciples into the ' +
        'land of Judea; and the Pharisees saw him.',
    '>',
    '> **23** And John also was baptizing in Zenon near to Qalim, ' +
        'because there was much water there.',
    '',
    '## Places',
    '',
    'They baptized at Zenon near Qalim, and the Pharisees heard of it.',
].join('\n');

function genTranslation(zenon: string, title: string) {
    return [
        '---',
        '',
        `# ${title}`,
        '',
        `> **${WORD_A} ${toScriptDigits('3:22-23')}** (ZB)`,
        '>',
        `> **${toScriptDigits('22')}** ${WORD_A} ${WORD_B} ${PHARISEES} ${WORD_A}`,
        '>',
        `> **${toScriptDigits('23')}** ${WORD_A} ${ZENON} ${WORD_A} ${QALIM}.`,
        '',
        `## ${WORD_C}`,
        '',
        `${WORD_A} ${zenon} ${WORD_B} ${QALIM}, ${WORD_C} ${PHARISEES_SLIP}.`,
    ].join('\n');
}

function genStudy(...translations: string[]) {
    return [ENGLISH_HALF, '', ...translations].join('\n') + '\n';
}

function toRefusal(text: string, pairs: unknown) {
    const list = toStudyReplaceList(pairs);
    const result = 'reason' in list ? list : applyStudyReplace(text, list.list);
    if (!('reason' in result)) {
        throw new Error('The pairs were written.');
    }
    return result;
}

describe('applyStudyReplaceChecked, the rest (UT-102)', () => {
    it('puts right two words of one pair, each in its place', () => {
        const study = genStudy(
            genTranslation(ZENON_SLIP, `${WORD_B} ${WORD_C}`),
        );
        const line = (zenon: string, pharisees: string) => {
            return `${zenon} ${WORD_B} ${QALIM}, ${WORD_C} ${pharisees}`;
        };
        const asked = {
            from: line(ZENON, PHARISEES),
            to: line(ZENON, PHARISEES),
        };
        const written = {
            from: line(ZENON_SLIP, PHARISEES_SLIP),
            to: line(ZENON, PHARISEES),
        };
        const result = applyStudyReplaceChecked(study, [asked]);
        expect(result).toMatchObject({
            repaired: [{ pair: 1, asked, written }],
        });
        expect('text' in result && result.text).toContain(
            `${WORD_A} ${line(ZENON, PHARISEES)}.`,
        );
    });

    it('leaves a place two slips claim with two spellings as it was asked', () => {
        // Two translations write the place otherwise, each its own way: the
        // file's spelling of a pair's word cannot be told, so it is refused.
        const study = genStudy(
            genTranslation(ZENON_SLIP, `${WORD_B} ${WORD_C}`),
            '',
            genTranslation(ZENON_SLIP_U, `${WORD_C} ${WORD_B}`),
        );
        const pairs = [{ from: ZENON, to: ZENON }];
        expect(applyStudyReplaceChecked(study, pairs)).toEqual(
            toRefusal(study, pairs),
        );
    });

    it('is refused as before for a pair that is no words on one line', () => {
        const study = genStudy(
            genTranslation(ZENON_SLIP, `${WORD_B} ${WORD_C}`),
        );
        for (const pairs of [
            [{ from: ZENON, to: 7 }],
            [{ from: `${ZENON}\n${WORD_A}`, to: ZENON }],
            [{ from: '  ', to: ZENON }],
        ]) {
            const result = applyStudyReplaceChecked(study, pairs);
            expect(result).toEqual(toRefusal(study, pairs));
            expect('reason' in result).toBe(true);
        }
    });
});
