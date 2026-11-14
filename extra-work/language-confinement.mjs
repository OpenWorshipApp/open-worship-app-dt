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
// - `codes`: code (not tests, not comments) that names a non-English
//   language by its locale tag (`'xx-YY'`), a path into its package folder,
//   or its code in a language comparison (`lang === 'xx'`) -- it would break
//   the day that package is not installed, and it would treat that language
//   unlike the others (2026-11-09, the user: _all languages development,
//   except english, should be treated the same way_). The rule names no
//   language: every one but English is held to it alike, whether or not its
//   package is in the checkout. The table of every locale in the world is
//   English's DATA (`src/lang/data/en/locales.json`), not code.
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

// A character of a script other than Latin, Common or Inherited (Greek,
// Han, any other), or a Latin one past ASCII. Common holds the punctuation,
// symbols and emoji every language shares; Inherited the joiners and
// selectors an emoji is built with; Braille is dots for every language (a
// grip glyph), no language's letters.
export const FOREIGN_CHARACTER_PATTERN =
  /[^\p{Script=Latin}\p{Script=Common}\p{Script=Inherited}\p{Script=Braille}]|(?=\p{Script=Latin})[^\x00-\x7F]/u;

// A letter of another SCRIPT written as an escape (a backslash, `u` and its
// code point, in a string or a regular expression), which no reader of the
// source sees as a letter and which is the language's data all the same. A
// Latin letter past ASCII written so is left alone: the KJV's own ligatures
// and a byte's value are written that way, and are no language's.
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

// A non-English language named in code, every language alike: a locale tag
// in quotes whose language is not English (`'xx-YY'`), a path into a
// package folder (`/data/online/xx/`, or the old `/data/xx/`), or a bare
// code compared with a language, locale or code (`lang === 'xx'`). A bare
// code alone is not read: `'id'`, `'to'` and `'is'` are codes too, and
// words first.
const LANGUAGE_NAME_SOURCE = '\\w*(?:[Ll]ang|[Ll]ocale|Code)\\w*';
export const NON_ENGLISH_CODE_PATTERN = new RegExp(
  [
    /(['"`])(?!en[-_])[a-z]{2,3}[-_][A-Z]{2}\1/.source,
    /\/data\/online\/[a-z]{2,3}\//.source,
    /\/data\/(?!en\/|online\/|tests\/)[a-z]{2,3}\//.source,
    `\\b${LANGUAGE_NAME_SOURCE}\\s*[!=]==?\\s*(['"\`])(?!en\\2)[a-z]{2,3}\\2`,
    `(['"\`])(?!en\\3)[a-z]{2,3}\\3\\s*[!=]==?\\s*${LANGUAGE_NAME_SOURCE}\\b`,
  ].join('|'),
);
const TEST_FILE_PATTERN = /\.(?:test|spec|vitest)\.[cm]?[jt]sx?$/;
const TEST_DIR_PATTERN = /(?:^|\/)(?:test-setup|tests)\//;
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

// A line as code, with what is a comment taken off: a `//` comment (at the
// start or after a space, so an address's `https://` stays), a `/* */` one
// on the line, and the lines of a block comment. Good enough for a gate that
// reads code a line at a time.
function genCodeLineReader() {
  let isInBlock = false;
  return (line) => {
    let code = line;
    if (isInBlock) {
      const end = code.indexOf('*/');
      if (end < 0) {
        return '';
      }
      code = code.slice(end + 2);
      isInBlock = false;
    }
    code = code.replace(/\/\*.*?\*\//g, '');
    const start = code.indexOf('/*');
    if (start >= 0) {
      code = code.slice(0, start);
      isInBlock = true;
    }
    const comment = /(?:^|\s)\/\/(?:\s|$)/.exec(code);
    return comment === null ? code : code.slice(0, comment.index);
  };
}

function findCodeLines(text, check) {
  const readCode = genCodeLineReader();
  return text.split(/\r?\n/).flatMap((line, index) => {
    return check(readCode(line)) ? [index + 1] : [];
  });
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
      !TEST_DIR_PATTERN.test(filePath)
    ) {
      const codeLines = findCodeLines(text, (line) => {
        return NON_ENGLISH_CODE_PATTERN.test(line);
      });
      if (codeLines.length > 0) {
        codes.push({ file: filePath, lines: codeLines });
      }
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
  printList('Code naming a non-English language', codes);
  process.exitCode = foreign.length + codes.length > 0 ? 1 : 0;
}
