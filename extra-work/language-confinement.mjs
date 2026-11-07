// Every language but English lives in its own package, `src/lang/data/online/<code>/`,
// and nowhere else (2026-11-03, the user: _make sure no non-english data tied
// to the code base beside src/lang/data_, and _in the future all non-english
// is modular_). A language is added -- and, one day, installed or removed --
// with its folder: its dictionary, its chatbot words, its corpus and manual,
// its fixes, and the tests that hold them (`src/lang/data/online/<code>/tests/`).
//
// Two things are found, outside `src/lang/data`:
//
// - `foreign`: a letter, mark, digit or sign of any script but Latin, or a
//   Latin letter past ASCII (an accented e, an n with a tilde), in code, data
//   or a test -- comments included. A language's words, digits and
//   punctuation are its package's DATA, read by code that names no language;
//   a Unicode test that is not about a language uses symbols (a cross, an
//   emoji), which belong to no script;
// - `codes`: code (not tests) that names a non-English package by its code or
//   locale -- it would break the day that package is not installed. The one
//   table of every locale in the world (`langHelpers.ts`) names them all,
//   which is not naming one.
//
// Notes and documents in prose (`*.md`: the English manual, `.claude/` notes,
// `docs/`) may quote a language; the data sets beside them may not.
//
//   node extra-work/language-confinement.mjs            everything found
//   node extra-work/language-confinement.mjs src/chatbot   under a path
//
// `src/lang/languageConfinement.test.ts` holds the gate to finding nothing.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

const SCANNED_EXTENSION_PATTERN = /\.(?:[cm]?[jt]sx?|json|s?css|html?|ya?ml)$/i;

// Paths (repo-relative, `/`) never scanned: the language packages themselves,
// third-party builds, binaries, what a build writes, and prose.
const UNSCANNED_PATH_PATTERN_LIST = [
  /^src\/lang\/data\//,
  /(^|\/)node_modules\//,
  /(^|\/)vendor\//,
  /^extra-work\/experiment-building\//,
  /^extra-work\/tmp\//,
  // The language plugins' packs and dev catalog (`build-lang-plugins.mjs --pack`).
  /^extra-work\/lang\//,
  /^(?:dist|electron-build|release|coverage|coverage-electron)\//,
  /^test-results\//,
  /\.md$/i,
  /^docs\/(?!scripts\/)/,
  /^\.claude\/(?!skills\/[^/]+\/(?:scripts|references)\/)/,
  /^package-lock\.json$/,
];

// A character of a script other than Latin, Common or Inherited (Khmer,
// Greek, Han...), or a Latin one past ASCII. Common holds the punctuation,
// symbols and emoji every language shares; Inherited the joiners and
// selectors an emoji is built with; Braille is dots for every language (a
// grip glyph), no language's letters.
export const FOREIGN_CHARACTER_PATTERN =
  /[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}\p{Script=Braille}]|(?=\p{Script=Latin})[^\x00-\x7F]/u;

// A letter of another SCRIPT written as an escape (a backslash, `u` and its
// code point, in a string or a regular expression), which no reader of the
// source sees as Khmer or Greek and which is the language's data all the
// same. A Latin letter past ASCII written so is left alone: the KJV's own
// ligatures and a byte's value are written that way, and are no language's.
const NON_LATIN_SCRIPT_PATTERN =
  /[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}\p{Script=Braille}]/u;
const ESCAPE_PATTERN = /\\u(?:\{([0-9a-fA-F]{1,6})\}|([0-9a-fA-F]{4}))/g;

function checkHasForeignEscape(line) {
  for (const match of line.matchAll(ESCAPE_PATTERN)) {
    const codePoint = parseInt(match[1] ?? match[2], 16);
    // Half a surrogate pair, or a noncharacter: no letter of anything.
    if (
      (codePoint >= 0xd800 && codePoint <= 0xdfff) ||
      (codePoint & 0xfffe) === 0xfffe ||
      codePoint > 0x10ffff
    ) {
      continue;
    }
    if (NON_LATIN_SCRIPT_PATTERN.test(String.fromCodePoint(codePoint))) {
      return true;
    }
  }
  return false;
}

function checkIsForeignLine(line) {
  return FOREIGN_CHARACTER_PATTERN.test(line) || checkHasForeignEscape(line);
}

// A non-English package named in code: its code or locale in quotes, or a
// path into its folder.
export const NON_ENGLISH_CODE_PATTERN =
  /(['"`])(?:km|fr)(?:-[A-Z]{2})?\1|\/data\/(?:km|fr)\//;
const TEST_FILE_PATTERN = /\.(?:test|spec)\.[cm]?[jt]sx?$/;
const CODE_FILE_PATTERN = /\.[cm]?[jt]sx?$/;

export function listScannedFiles() {
  const output = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  return [...new Set(output.split('\0'))].filter((filePath) => {
    return (
      filePath !== '' &&
      SCANNED_EXTENSION_PATTERN.test(filePath) &&
      !UNSCANNED_PATH_PATTERN_LIST.some((pattern) => {
        return pattern.test(filePath);
      })
    );
  });
}

function readRepoFile(filePath) {
  try {
    return readFileSync(path.join(REPO_ROOT, filePath), 'utf8');
  } catch (_error) {
    // Listed by git, deleted in the working tree.
    return null;
  }
}

function findLines(text, check) {
  return text.split(/\r?\n/).flatMap((line, index) => {
    return check(line) ? [index + 1] : [];
  });
}

/**
 * What breaks the rule, file by file: `{ file, lines }` (1-based line
 * numbers), for the foreign characters and for the package codes in code.
 */
export function scanLanguageConfinement({
  fileList = listScannedFiles(),
} = {}) {
  const foreign = [];
  const codes = [];
  for (const filePath of fileList) {
    const text = readRepoFile(filePath);
    if (text === null || text.includes('\0')) {
      continue;
    }
    const foreignLines = findLines(text, checkIsForeignLine);
    if (foreignLines.length > 0) {
      foreign.push({ file: filePath, lines: foreignLines });
    }
    if (
      CODE_FILE_PATTERN.test(filePath) &&
      !TEST_FILE_PATTERN.test(filePath) &&
      NON_ENGLISH_CODE_PATTERN.test(text)
    ) {
      codes.push({
        file: filePath,
        lines: findLines(text, (line) => {
          return NON_ENGLISH_CODE_PATTERN.test(line);
        }),
      });
    }
  }
  return { foreign, codes };
}

function printList(title, list) {
  console.log(`${title}: ${list.length} file(s)`);
  for (const { file, lines } of list) {
    const shown = lines.slice(0, 12).join(',');
    console.log(
      `  ${file}  (${lines.length} line(s): ${shown}${lines.length > 12 ? ',…' : ''})`,
    );
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const prefixList = process.argv.slice(2).map((prefix) => {
    return prefix.replace(/\\/g, '/');
  });
  const fileList = listScannedFiles().filter((filePath) => {
    return (
      prefixList.length === 0 ||
      prefixList.some((prefix) => {
        return filePath.startsWith(prefix);
      })
    );
  });
  const { foreign, codes } = scanLanguageConfinement({ fileList });
  printList('Letters of another language outside src/lang/data', foreign);
  printList('Code naming a non-English package', codes);
  process.exitCode = foreign.length + codes.length > 0 ? 1 : 0;
}
