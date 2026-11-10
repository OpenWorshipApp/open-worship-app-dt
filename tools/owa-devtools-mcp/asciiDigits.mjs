// Any script's decimal digits as `0`-`9`, every script the same way: no
// table of scripts, no language named. Unicode keeps the digits of a
// script (`\p{Nd}`) in runs of ten, zero first, and where two runs touch
// (the mathematical digits are five in a row) each still starts on a zero,
// so a digit's value is how far it sits past the start of its block of
// digits, counted in tens. Plain ESM, no dependency: the renderer bundles
// what the server runs.

const DIGIT_PATTERN = /\p{Nd}/u;

/** One character's digit value as `0`-`9`, or the character as it was. */
export function toAsciiDigit(character) {
  if (!DIGIT_PATTERN.test(character)) {
    return character;
  }
  const codePoint = character.codePointAt(0);
  if (codePoint < 0x80) {
    return character;
  }
  let runStart = codePoint;
  while (DIGIT_PATTERN.test(String.fromCodePoint(runStart - 1))) {
    runStart -= 1;
  }
  return String((codePoint - runStart) % 10);
}

/** Every decimal digit in the text, whatever its script, as `0`-`9`. */
export function toAsciiDigits(text) {
  return String(text ?? '').replace(/\p{Nd}/gu, toAsciiDigit);
}
