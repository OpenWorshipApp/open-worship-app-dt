// Any script's decimal digits read as `0`-`9` (`asciiDigits.mjs`), every
// script the same way. Each digit here is built from its code point, so no
// other script's digit sits in this source, and the scripts are read off the
// runtime's own numbering systems rather than a list kept here.
import { describe, expect, test } from 'vitest';

import { toAsciiDigit, toAsciiDigits } from './asciiDigits.mjs';

const ASCII_DIGITS = '0123456789';

/** The ten digits of a run, from its zero's code point. */
function genRunDigits(zeroCodePoint) {
  return Array.from({ length: 10 }, (_, index) => {
    return String.fromCodePoint(zeroCodePoint + index);
  }).join('');
}

/**
 * Every numbering system the runtime knows whose ten digits are one decimal
 * digit each (`\p{Nd}`): its name and its digits, zero first.
 */
function listDecimalNumberingSystems() {
  return Intl.supportedValuesOf('numberingSystem')
    .map((numberingSystem) => {
      const formatter = new Intl.NumberFormat('en', {
        numberingSystem,
        useGrouping: false,
      });
      const digitList = Array.from({ length: 10 }, (_, index) => {
        return formatter.format(index);
      });
      return { numberingSystem, digitList };
    })
    .filter(({ digitList }) => {
      return digitList.every((digit) => {
        return [...digit].length === 1 && /^\p{Nd}$/u.test(digit);
      });
    });
}

describe('a digit of any script', () => {
  test('every decimal numbering system the runtime has reads as 0-9', () => {
    const systemList = listDecimalNumberingSystems();
    // Not a loop over nothing: Western, and dozens of scripts besides.
    expect(systemList.length).toBeGreaterThan(30);
    expect(
      systemList.some(({ numberingSystem }) => numberingSystem === 'latn'),
    ).toBe(true);
    for (const { numberingSystem, digitList } of systemList) {
      expect([numberingSystem, toAsciiDigits(digitList.join(''))]).toEqual([
        numberingSystem,
        ASCII_DIGITS,
      ]);
      digitList.forEach((digit, index) => {
        expect([numberingSystem, toAsciiDigit(digit)]).toEqual([
          numberingSystem,
          String(index),
        ]);
      });
    }
  });

  test('a run of ten on its own, read from its zero', () => {
    // Two scripts' runs, and the fullwidth digits of East Asian text.
    for (const zeroCodePoint of [0x0660, 0x17e0, 0xff10]) {
      expect(toAsciiDigits(genRunDigits(zeroCodePoint))).toBe(ASCII_DIGITS);
    }
  });

  // The mathematical digits are five runs of ten with no gap between them
  // (bold, double-struck, sans-serif, sans-serif bold, monospace): each run
  // still starts on its own zero.
  test('runs that touch each start again at zero', () => {
    for (let run = 0; run < 5; run++) {
      const zeroCodePoint = 0x1d7ce + run * 10;
      expect([run, toAsciiDigits(genRunDigits(zeroCodePoint))]).toEqual([
        run,
        ASCII_DIGITS,
      ]);
    }
    // The last of one run beside the first of the next: 9 then 0.
    expect(toAsciiDigits(String.fromCodePoint(0x1d7d7, 0x1d7d8))).toBe('90');
  });
});

describe('what is not a decimal digit', () => {
  test('ASCII digits and ordinary text stay as they are', () => {
    expect(toAsciiDigits('Psalm 23:1-6')).toBe('Psalm 23:1-6');
    expect(toAsciiDigit('7')).toBe('7');
    expect(toAsciiDigit('a')).toBe('a');
  });

  test('a number sign that is not a decimal digit is left alone', () => {
    // A superscript two, a vulgar half and a Roman numeral twelve: numbers,
    // but not digits of a run of ten.
    const signs = String.fromCodePoint(0x00b2, 0x00bd, 0x216b);
    expect(toAsciiDigits(signs)).toBe(signs);
  });

  test("a script's digits inside words are read, the words kept", () => {
    const year = genRunDigits(0x0966).slice(1, 2) + genRunDigits(0x0966)[9];
    expect(toAsciiDigits(`Bible ${year}`)).toBe('Bible 19');
    const reference = `John ${genRunDigits(0xff10)[3]}:${genRunDigits(0xff10)[1]}${genRunDigits(0xff10)[6]}`;
    expect(toAsciiDigits(reference)).toBe('John 3:16');
  });

  test('nothing at all is the empty text', () => {
    expect(toAsciiDigits(null)).toBe('');
    expect(toAsciiDigits(undefined)).toBe('');
    expect(toAsciiDigits(2024)).toBe('2024');
  });
});
