// The pure half of importing a Bible from an XML address: what a link a
// volunteer pasted really points at, which language the words are in, what
// short name (Bible key) to offer, and how a list of book names is told apart
// from another one.
//
// No imports and no I/O, so the renderer bundles exactly what the MCP server
// runs: the server uses it to fix a link and pick files off a page, the app's
// worker (`src/helper/agentBibleXMLHelpers.ts`) to read a downloaded file, and
// the chat window's step-by-step import to word its buttons. The person this
// is for is old and not technical: everything here exists so that "I pasted
// the link from GitHub" ends in a Bible on the screen, not in "that is not a
// valid XML file".

export const BIBLE_XML_ACTIONS = [
  'check',
  'names',
  'import',
  'cancel',
  'list',
  'info',
  'update',
  'delete',
];

// Where a Bible is looked for when the person names a LANGUAGE and no link
// ("import bible for khmer"): about a thousand translations as one XML file
// each, named in English (`KhmerBible.xml`, `Khmer2019Bible.xml`), in the
// same format as everything else here. Chosen by the user, 2026-10-06.
export const BIBLE_XML_CATALOG_URL =
  'https://github.com/Beblia/Holy-Bible-XML-Format';

// A draft is the downloaded file waiting for the person's choices. The id is
// minted by the server and is the ONLY way a caller names one, so no path a
// model writes ever reaches the disk.
export const BIBLE_DRAFT_ID_PATTERN = /^[a-z0-9]{12}$/;

// Ids of book-name lists are a hash of the names themselves: the same list
// found twice (bundled, and again on a website) is one choice, not two.
export const BIBLE_NAME_LIST_ID_PATTERN = /^n[0-9a-f]{8}$/;

// Inside a file name, not between word boundaries: `KhmerBible.xml`.
const BIBLE_FILE_WORDS = /holy|bible|biblia|bibel|bijbel/gi;

function toUrl(text) {
  try {
    return new URL(String(text ?? '').trim());
  } catch {
    return null;
  }
}

/**
 * The address the FILE is at, for the address of the page about it.
 *
 * A volunteer copies what is in their browser's address bar, and on GitHub,
 * GitLab, Dropbox and Google Drive that is a page that SHOWS the file, not the
 * file -- downloading it gets ~200 KB of HTML and "that is not a Bible". The
 * fix is the one a developer would do by hand, so it is done for them and
 * said in one line (`note`) rather than silently.
 */
export function toBibleXmlDownloadUrl(input) {
  // Punctuation first, then the brackets: "<https://…>." ends in a full
  // stop, and the closing bracket is only at the end once that is gone.
  const raw = String(input ?? '')
    .trim()
    .replace(/[),.;]+$/, '')
    .replace(/^<|>$/g, '')
    .replace(/[),.;]+$/, '');
  const url = toUrl(raw);
  if (url === null) {
    return { url: raw, note: null };
  }
  const parts = url.pathname.split('/').filter(Boolean);
  if (url.hostname === 'github.com' && parts[2] === 'blob' && parts[4]) {
    const [owner, repo, , ...rest] = parts;
    return {
      url: `https://raw.githubusercontent.com/${owner}/${repo}/${rest.join('/')}`,
      note: 'I used the download address of the file instead of its GitHub page.',
    };
  }
  if (
    url.hostname === 'gitlab.com' &&
    parts.includes('-') &&
    parts[parts.indexOf('-') + 1] === 'blob'
  ) {
    const index = parts.indexOf('-');
    parts[index + 1] = 'raw';
    url.pathname = `/${parts.join('/')}`;
    return {
      url: url.href,
      note: 'I used the download address of the file instead of its GitLab page.',
    };
  }
  if (/(^|\.)dropbox\.com$/.test(url.hostname) && parts.length > 1) {
    if (url.searchParams.get('dl') !== '1') {
      url.searchParams.set('dl', '1');
      return {
        url: url.href,
        note: 'I used the download address of the file instead of its Dropbox page.',
      };
    }
    return { url: url.href, note: null };
  }
  if (url.hostname === 'drive.google.com') {
    const id =
      parts[0] === 'file' && parts[1] === 'd'
        ? parts[2]
        : url.searchParams.get('id');
    if (id && /^[\w-]{10,}$/.test(id) && url.pathname !== '/uc') {
      return {
        url: `https://drive.google.com/uc?export=download&id=${id}`,
        note: 'I used the download address of the file instead of its Google Drive page.',
      };
    }
  }
  return { url: url.href, note: null };
}

/**
 * A GitHub repository or folder page, as the address of the API listing of
 * the files in it -- one small JSON answer instead of a page whose file list
 * is drawn by script. Null for anything else.
 */
export function toGithubListingUrl(input) {
  const url = toUrl(input);
  if (url === null || url.hostname !== 'github.com') {
    return null;
  }
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length < 2 || !/^[\w.-]+$/.test(parts[0])) {
    return null;
  }
  const [owner, repo, kind, ref, ...rest] = parts;
  if (parts.length === 2) {
    return `https://api.github.com/repos/${owner}/${repo}/contents/`;
  }
  if (kind !== 'tree' || !ref) {
    return null;
  }
  return (
    `https://api.github.com/repos/${owner}/${repo}/contents/` +
    // Already percent-encoded by `URL`: encoding it again turns a space
    // into `%2520`.
    `${rest.join('/')}?ref=${ref}`
  );
}

function toFileName(url) {
  try {
    return decodeURIComponent(new URL(url).pathname.split('/').pop() || '');
  } catch {
    return '';
  }
}

/**
 * Every Bible-looking `.xml` file a page or a GitHub listing names, as
 * download addresses. Read off TEXT, never run: an `href`, a GitHub API
 * `download_url`, and the `"path":"…xml"` GitHub embeds in a repository page.
 * https only and de-duplicated; capped, because a repository can hold a
 * thousand translations and the answer is about choosing one.
 */
export function extractBibleXmlLinks(text, baseUrl) {
  const source = String(text ?? '');
  const found = new Map();
  const add = (candidate) => {
    let url;
    try {
      url = new URL(candidate.replaceAll('&amp;', '&'), baseUrl);
    } catch {
      return;
    }
    if (url.protocol !== 'https:' || !/\.xml$/i.test(url.pathname)) {
      return;
    }
    const fixed = toBibleXmlDownloadUrl(url.href).url;
    if (!found.has(fixed) && found.size < 2000) {
      found.set(fixed, { name: toFileName(fixed), url: fixed });
    }
  };
  for (const match of source.matchAll(
    /"download_url"\s*:\s*"(https:[^"]+\.xml)"/gi,
  )) {
    add(match[1]);
  }
  for (const match of source.matchAll(/href\s*=\s*["']([^"'#]+\.xml)["']/gi)) {
    add(match[1]);
  }
  const base = toUrl(baseUrl);
  if (base?.hostname === 'github.com') {
    const [owner, repo] = base.pathname.split('/').filter(Boolean);
    if (owner && repo) {
      for (const match of source.matchAll(/"path"\s*:\s*"([^"]+\.xml)"/gi)) {
        add(`https://github.com/${owner}/${repo}/blob/HEAD/${match[1]}`);
      }
    }
  }
  return Array.from(found.values());
}

// Marks too: a Khmer word is letters AND the marks between them, and
// splitting "ខ្មែរ" at its signs left nothing that names a language.
function toPlainSearchWords(text) {
  return (
    String(text ?? '')
      .toLowerCase()
      .replace(/https?:\/\/\S+/g, ' ')
      .match(/[\p{L}\p{M}\p{N}]{2,}/gu) ?? []
  ).filter((word) => {
    return !STOP_WORDS.has(word);
  });
}

// A language as its own speakers write it, to the English word the catalog's
// files are named with.
const NATIVE_LANGUAGE_MAP = {
  ខ្មែរ: 'khmer',
  ថៃ: 'thai',
  ไทย: 'thai',
  ລາວ: 'lao',
  မြန်မာ: 'burmese',
  'tiếng việt': 'vietnamese',
  中文: 'chinese',
  汉语: 'chinese',
  漢語: 'chinese',
  日本語: 'japanese',
  한국어: 'korean',
  français: 'french',
  español: 'spanish',
  português: 'portuguese',
  deutsch: 'german',
  русский: 'russian',
  українська: 'ukrainian',
  العربية: 'arabic',
  עברית: 'hebrew',
  ελληνικά: 'greek',
  हिन्दी: 'hindi',
  বাংলা: 'bengali',
  தமிழ்: 'tamil',
  'bahasa indonesia': 'indonesian',
  tagalog: 'tagalog',
  kiswahili: 'swahili',
};

// A country, its people, or another name the language goes by, to the word
// the catalog's files are named with. A person asks for the Bible "in
// Cambodia" as readily as "in Khmer" -- measured 2026-10-10 against the
// catalog's 998 file names: "cambodia", "china", "france", "laos", "germany",
// "myanmar" and "espanol" each found nothing. Only names that are not
// already the START of the catalog's own word: "korea" finds `Korean…` by
// itself. Every value is a word of `CATALOG_LANGUAGE_WORDS`; a test holds it.
export const LANGUAGE_ALIAS_MAP = {
  cambodia: 'khmer',
  cambodian: 'khmer',
  kampuchea: 'khmer',
  china: 'chinese',
  mandarin: 'chinese',
  cantonese: 'chinese',
  taiwan: 'chinese',
  france: 'french',
  francais: 'french',
  thailand: 'thai',
  laos: 'lao',
  laotian: 'lao',
  myanmar: 'burmese',
  burma: 'burmese',
  spain: 'spanish',
  espanol: 'spanish',
  mexico: 'spanish',
  germany: 'german',
  portugal: 'portuguese',
  portugues: 'portuguese',
  brazil: 'portuguese',
  brasil: 'portuguese',
  italy: 'italian',
  italiano: 'italian',
  greece: 'greek',
  israel: 'hebrew',
  netherlands: 'dutch',
  holland: 'dutch',
  nederlands: 'dutch',
  england: 'english',
  america: 'english',
  american: 'english',
  philippines: 'tagalog',
  filipino: 'tagalog',
  pilipino: 'tagalog',
  iran: 'persian',
  farsi: 'persian',
  turkey: 'turkish',
  sweden: 'swedish',
  norway: 'norwegian',
  denmark: 'danish',
  finland: 'finnish',
  poland: 'polish',
  hungary: 'hungarian',
  ukraine: 'ukrainian',
  ireland: 'irish',
  iceland: 'icelandic',
  ethiopia: 'amharic',
  madagascar: 'malagasy',
  bangladesh: 'bengali',
  bangla: 'bengali',
  sinhalese: 'sinhala',
  tibet: 'tibetian',
  tibetan: 'tibetian',
  azerbaijani: 'azerbaijan',
  azeri: 'azerbaijan',
  moldovan: 'moldovian',
  galician: 'galacian',
  oriya: 'odia',
};

// The two English Bibles everybody names by their letters and the catalog
// files under other ones (`EnglishKJBible.xml`): "kjv" alone found the THAI
// King James and nothing else. Only when it is the whole ask -- "Thai KJV"
// means the Thai one.
const VERSION_ALIAS_MAP = {
  kjv: ['english', 'kj'],
  nkjv: ['english', 'nkj'],
};

// The word each of the catalog's files is named for, as read off its 998
// file names on 2026-10-10 (`Khmer2005Bible.xml` -> "khmer"). Only a HINT
// for reading a request -- "add" or "want" beside one of these is somebody
// asking for a Bible, beside anything else it is not -- and never what is
// searched: the search reads the live file names. Spelt as the catalog
// spells them ("tibetian", "galacian").
const CATALOG_LANGUAGE_WORDS = new Set(
  (
    'aceh adilabad afrikaans ahirani albanian amharic arabic aramaic ' +
    'armenian assamese avar awadhi aymara azerbaijan bagri balinese ' +
    'balochi baoule bashkir basque bavarian belarusian bemba bengali ' +
    'berber bhilali bodo bosnian braj bugis bulgarian bundeli burmese ' +
    'catalan cebuano chechen chewa chhattisgarhi chibemba chin chinese ' +
    'chuvash coptic croatian czech dagbani danish dinka dogri dutch dyula ' +
    'edo english esperanto estonian ewe finnish fon french fulfulde ' +
    'gaelic galacian garhwali georgian german ghomala greek guarani ' +
    'gujarati gussi hadiyya haitian haryanvi hausa hebrew hindi hmong ' +
    'hungarian iban ibibio icelandic igbo ika ilokano ilonggo indonesian ' +
    'irish italian iu jamaican japanese javanese kabardian kabyle kachin ' +
    'kalenjin kamba kangri kannada karakalpak kazakhstan kenya khmer ' +
    'kiche kikuyu kikwango kimbundu kimiiru kinyarwanda kirundi kituba ' +
    'konkani korean koya krio kumaoni kurdish kurukh kyrgyz lahu lambadi ' +
    'lango lao latin latvian liberian lingala lithuanian lomwe luganda ' +
    'lugbara luguru luo maasai macedonian madurese maithili makhuwa ' +
    'makonde malagasy malayalam malaysian maori marathi marwari ' +
    'mazanderani meitei mende mewari mizo moba moldovian mongolian ' +
    'morisyen mossi munda nahuatl ndau ndebele nepali nigerian norwegian ' +
    'nuer nyankole odia original oromo pampanga papua pashto persian ' +
    'polish portuguese pular punjabi qeqchi quechuan romani romanian ' +
    'russian sadri sanskrit santali sasak sena seraiki serbian shan ' +
    'shekhawati shilluk shona sidamo sindhi sinhala siswati slovakian ' +
    'slovenian soga somalian songe sotho spanish sukuma sundanese swahili ' +
    'swedish sylheti tagalog tajik tamasheq tamil tarifit tashelhayt ' +
    'tatar telugu teso thado thai tibetian tiv tshiluba tshivenda tsonga ' +
    'tswana tulu turkana turkish turkmen twi ukrainian'
  ).split(' '),
);

const ENGLISH_LANGUAGE_NAMES = new Intl.DisplayNames(['en'], {
  type: 'language',
});

/**
 * A language as the catalog spells it -- in English, the way its files are
 * named (`KhmerBible.xml`) -- for one a person typed in their own language
 * ("ខ្មែរ", "français") or as a code ("km"). A code only when it is the WHOLE
 * answer: "so", "no" and "am" are codes too, and are words first.
 */
export function toCatalogLanguageWord(word, canBeCode = false) {
  const text = String(word ?? '')
    .trim()
    .toLowerCase();
  const toFirstWord = (name) => name.split(/[\s(,]/)[0].toLowerCase();
  if (canBeCode && /^[a-z]{2,3}$/.test(text)) {
    const name = ENGLISH_LANGUAGE_NAMES.of(text);
    if (name && name.toLowerCase() !== text) {
      return toFirstWord(name);
    }
  }
  // Written out, not asked of `Intl`: Electron's own copy of the language
  // data has no Khmer at all -- `Intl.DisplayNames(['km'])` answers
  // "Khmer" there, where Node answers "ខ្មែរ" -- and Khmer is who this
  // app is for. "ភាសា" / "ภาษา" is "language", typed in front of the name.
  const bare = text.replace(/^(?:ភាសា|ภาษา|ພາສາ)\s*/u, '');
  if (Object.hasOwn(NATIVE_LANGUAGE_MAP, bare)) {
    return NATIVE_LANGUAGE_MAP[bare];
  }
  if (Object.hasOwn(LANGUAGE_ALIAS_MAP, text)) {
    return LANGUAGE_ALIAS_MAP[text];
  }
  if (/^[a-z]+$/.test(text)) {
    return null;
  }
  for (let first = 97; first <= 122; first++) {
    for (let second = 97; second <= 122; second++) {
      const code = String.fromCharCode(first, second);
      try {
        const native = new Intl.DisplayNames([code], { type: 'language' }).of(
          code,
        );
        if (native && native.toLowerCase() === text) {
          return toFirstWord(ENGLISH_LANGUAGE_NAMES.of(code) ?? code);
        }
      } catch {
        // Not a language this runtime knows.
      }
    }
  }
  return null;
}

/** The words of a request worth searching file names for. */
export function toBibleSearchWords(text) {
  const words = toPlainSearchWords(text);
  if (words.length === 1 && Object.hasOwn(VERSION_ALIAS_MAP, words[0])) {
    return [...VERSION_ALIAS_MAP[words[0]]];
  }
  return words.map((word) => {
    return toCatalogLanguageWord(word, words.length === 1) ?? word;
  });
}

/**
 * Whether a word of a request names a language the catalog has Bibles in --
 * as the catalog spells it, in its own script, or by its country. What tells
 * "I want a Khmer bible" (a Bible to fetch) from "I want to add a bible
 * verse" (nothing of the kind). Three table reads and no more: the words it
 * is asked about come out of `toBibleSearchWords`, which has already turned
 * any other language's own name into the catalog's word, and asking `Intl`
 * again is 676 formatters built for every word that is not a language.
 */
export function checkIsBibleLanguageWord(word) {
  const text = String(word ?? '')
    .trim()
    .toLowerCase();
  return (
    CATALOG_LANGUAGE_WORDS.has(text) ||
    Object.hasOwn(NATIVE_LANGUAGE_MAP, text) ||
    Object.hasOwn(LANGUAGE_ALIAS_MAP, text)
  );
}

function toSearchWords(text) {
  return toBibleSearchWords(text);
}

// Words a request is MADE of rather than about: "import the bible from this
// xml url please" names no translation at all.
const STOP_WORDS = new Set(
  (
    'import install add get put download load open use want need please ' +
    'can could would you me my mine our the a an this that these those it ' +
    'from to in on of for with and or into at by is are be bible bibles ' +
    'holy ' +
    'xml file files url link address page site version translation one ' +
    'new old help how do does what which where there here github gitlab ' +
    'raw master main refs heads repo repository folder www com so ok yes ' +
    'am as us we he she go language languages another other different ' +
    'more some any have has got like give find free online internet now ' +
    'just also too here thanks thank hello hi church'
  ).split(' '),
);

function scoreBibleXmlLinks(links, wordList) {
  return (links ?? []).map((link) => {
    const name = link.name.toLowerCase();
    const foundList = wordList.filter((word) => name.includes(word));
    return {
      link,
      isAll: foundList.length === wordList.length,
      score: foundList.reduce((sum, word) => sum + word.length, 0),
    };
  });
}

// The language a file is named for: `Khmer2005Bible.xml` -> "Khmer".
function toFileLanguage(name) {
  return /^\p{Lu}\p{Ll}+/u.exec(String(name ?? ''))?.[0] ?? null;
}

// How many letters have to change to make one word the other; past `max`
// the exact figure is not worth working out.
function countEdits(one, other, max) {
  if (Math.abs(one.length - other.length) > max) {
    return max + 1;
  }
  let previous = Array.from({ length: other.length + 1 }, (_, index) => index);
  for (let row = 1; row <= one.length; row++) {
    const current = [row];
    for (let column = 1; column <= other.length; column++) {
      current[column] = Math.min(
        previous[column] + 1,
        current[column - 1] + 1,
        previous[column - 1] + (one[row - 1] === other[column - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[other.length];
}

/**
 * The languages the files are named for that a word nothing matched is
 * CLOSE to: a slip of the keyboard ("kmer", "portugese") or a country no
 * table here knows ("turkey" starts like Turkish). Read off the listing
 * itself, so it can only ever suggest a language that has a file. Names with
 * the most Bibles first among equals; `[]` when nothing is near.
 */
export function suggestBibleLanguages(links, words, limit = 4) {
  const countMap = new Map();
  for (const link of links ?? []) {
    const language = toFileLanguage(link.name);
    if (language !== null) {
      countMap.set(language, (countMap.get(language) ?? 0) + 1);
    }
  }
  const wantedList = (words ?? []).filter((word) => {
    return /^\p{L}{3,}$/u.test(word);
  });
  const foundList = [];
  for (const [language, count] of countMap) {
    const name = language.toLowerCase();
    let best = null;
    for (const word of wantedList) {
      let shared = 0;
      while (
        shared < name.length &&
        shared < word.length &&
        name[shared] === word[shared]
      ) {
        shared++;
      }
      const shorter = Math.min(name.length, word.length);
      // The same first four letters, or the whole of a short name
      // ("lao" in "laotian")...
      const isStart = shared >= 4 || (shared === name.length && shared >= 3);
      // ...or a letter or two out, which a three-letter name cannot spare.
      const allowed = shorter >= 6 ? 2 : 1;
      const edits =
        shorter >= 4 ? countEdits(name, word, allowed) : allowed + 1;
      if (!isStart && edits > allowed) {
        continue;
      }
      const closeness = shared * 2 - Math.min(edits, allowed + 1);
      if (best === null || closeness > best) {
        best = closeness;
      }
    }
    if (best !== null) {
      foundList.push({ language, count, closeness: best });
    }
  }
  return foundList
    .sort((one, other) => {
      return (
        other.closeness - one.closeness ||
        other.count - one.count ||
        one.language.localeCompare(other.language)
      );
    })
    .slice(0, limit)
    .map((one) => {
      return one.language;
    });
}

/**
 * The files worth offering, best first. A word the user said ("Khmer",
 * "1954") must be in the file name; with no word, the first few by name and
 * the total, so the answer can ask which language. `words` are the ones the
 * files were matched on; `suggestions`, when nothing matched, the languages
 * of the listing a word is close to.
 */
export function rankBibleXmlLinks(links, words, limit = 6) {
  let wanted = toSearchWords(words);
  let all = scoreBibleXmlLinks(links, wanted);
  // Every word if any file has them all -- "Khmer 2019" is ONE file, not
  // every Khmer Bible and every Bible from 2019 -- else any of them.
  let isAllFound = wanted.length > 1 && all.some((one) => one.isAll);
  if (wanted.length > 1 && !isAllFound) {
    // A year no file of that language has ("Khmer 1999") only narrows: the
    // words that NAME the Bible decide, or the answer fills up with every
    // other language's Bible from that year (measured: "16" out of a verse
    // reference offered Chewa, Polish and Turkmen).
    const namedList = wanted.filter((word) => {
      return !/^\p{N}+$/u.test(word);
    });
    if (namedList.length > 0 && namedList.length < wanted.length) {
      wanted = namedList;
      all = scoreBibleXmlLinks(links, wanted);
      isAllFound = wanted.length > 1 && all.some((one) => one.isAll);
    }
  }
  const scored = all
    .filter((one) => {
      return wanted.length === 0 || (isAllFound ? one.isAll : one.score > 0);
    })
    .sort((one, other) => {
      return (
        other.score - one.score ||
        one.link.name.length - other.link.name.length ||
        one.link.name.localeCompare(other.link.name)
      );
    });
  const suggestions =
    scored.length === 0 && wanted.length > 0
      ? suggestBibleLanguages(links, wanted)
      : [];
  return {
    links: scored.slice(0, limit).map((one) => {
      return one.link;
    }),
    matched: scored.length,
    total: (links ?? []).length,
    words: wanted,
    ...(suggestions.length > 0 ? { suggestions } : {}),
  };
}

/**
 * A Bible's own title off the first bytes of its file -- the root tag's
 * `translation`, `title` or `name`. A file NAME says "Khmer2019Bible"; the
 * file itself says "Khmer 2023 (ព្រះគម្ពីរខ្មែរសាកល)", which is what a
 * person recognises from the cover of their own Bible.
 */
export function readBibleXmlTitle(head) {
  const rootTag = /<bible\b[^>]*>/i.exec(String(head ?? ''))?.[0] ?? '';
  for (const name of ['translation', 'title', 'name']) {
    const value = new RegExp(`\\s${name}\\s*=\\s*"([^"]{1,200})"`, 'i').exec(
      rootTag,
    )?.[1];
    if (value && value.trim() !== '') {
      return value
        .replaceAll('&amp;', '&')
        .replaceAll('&quot;', '"')
        .replace(/\s+/g, ' ')
        .trim();
    }
  }
  return null;
}

export function checkIsLikelyHtml(head) {
  return /<!doctype\s+html|<html[\s>]|<head[\s>]|<body[\s>]/i.test(
    String(head ?? '').slice(0, 4096),
  );
}

export function checkIsLikelyXml(head) {
  const text = String(head ?? '')
    .replace(/^\uFEFF/, '')
    .trimStart();
  return text.startsWith('<?xml') || /^<[A-Za-z_]/.test(text);
}

// --- which language ---------------------------------------------------------

// A script that belongs to one language (or one first). Matched on the
// LETTERS of the verses, which no file name and no attribute can get wrong.
const SCRIPT_LOCALES = [
  ['Khmer', ['km-KH']],
  ['Thai', ['th-TH']],
  ['Lao', ['lo-LA']],
  ['Myanmar', ['my-MM']],
  ['Hangul', ['ko-KR']],
  ['Hiragana', ['ja-JP']],
  ['Katakana', ['ja-JP']],
  ['Han', ['zh-CN', 'zh-TW', 'ja-JP']],
  ['Arabic', ['ar-SA', 'fa-IR', 'ur-PK']],
  ['Hebrew', ['he-IL']],
  ['Greek', ['el-GR']],
  ['Cyrillic', ['ru-RU', 'uk-UA', 'bg-BG', 'sr-Cyrl-RS']],
  ['Devanagari', ['hi-IN', 'ne-NP', 'mr-IN']],
  ['Bengali', ['bn-BD', 'bn-IN']],
  ['Tamil', ['ta-IN']],
  ['Telugu', ['te-IN']],
  ['Kannada', ['kn-IN']],
  ['Malayalam', ['ml-IN']],
  ['Gujarati', ['gu-IN']],
  ['Gurmukhi', ['pa-IN']],
  ['Ethiopic', ['am-ET']],
  ['Georgian', ['ka-GE']],
  ['Armenian', ['hy-AM']],
  ['Sinhala', ['si-LK']],
  ['Tibetan', ['bo-CN']],
  ['Latin', []],
];

// The commonest little words of each language written in Latin letters. A
// verse is long enough that these alone tell English from French reliably.
const LATIN_STOP_WORDS = {
  'en-US':
    'the and of to that in he shall unto for his they be is him not them it with all thou lord',
  'fr-FR':
    'et de la le les des il à que en qui ne pas est dans pour sur une du vous',
  'es-ES': 'y de la el que en los se no las por con su para del lo al',
  'pt-BR': 'e de o que a do da em não os se para com ele por as dos',
  'de-DE': 'und die der das zu er nicht den sie ist ich ein mit dem des',
  'it-IT': 'e di il che la non per in del si gli le con una sono',
  'nl-NL': 'en de het van die in een niet zij hij te dat met',
  'id-ID': 'dan yang itu di ia ke tidak dengan dari akan untuk mereka',
  'vi-VN': 'và của người là không thì đã có cho các những trong',
  'fil-PH': 'ang at ng sa mga si na ay kay kanyang',
  'sw-KE': 'na wa ya kwa katika ni la za yake',
  'pl-PL': 'i w nie się na z że do to jest jego',
  'ro-RO': 'și în de la nu cu să a pe lui',
};

function guessCyrillic(text) {
  if (/[іїєґ]/i.test(text)) return ['uk-UA', 'ru-RU'];
  if (/[ђћџљњ]/i.test(text)) return ['sr-Cyrl-RS', 'mk-MK'];
  if (/[ѓќѕ]/i.test(text)) return ['mk-MK', 'sr-Cyrl-RS'];
  if (/ў/i.test(text)) return ['be-BY', 'ru-RU'];
  if (/[ыэ]/i.test(text)) return ['ru-RU', 'uk-UA'];
  return ['bg-BG', 'ru-RU'];
}

function guessLatin(text) {
  const words = text.toLowerCase().match(/\p{L}+/gu) ?? [];
  if (words.length === 0) return [];
  return Object.entries(LATIN_STOP_WORDS)
    .map(([locale, list]) => {
      const set = new Set(list.split(' '));
      const hits = words.filter((word) => set.has(word)).length;
      return { locale, score: hits / words.length };
    })
    .filter((one) => one.score >= 0.06)
    .sort((one, other) => other.score - one.score)
    .slice(0, 3)
    .map((one) => one.locale);
}

/**
 * What the verses are written in, as locales best first, plus the script
 * name to say why. `[]` when the sample has no letters worth counting.
 */
export function guessBibleLocalesFromText(sample) {
  const text = String(sample ?? '').slice(0, 6000);
  let best = null;
  for (const [script, locales] of SCRIPT_LOCALES) {
    const count = (text.match(new RegExp(`\\p{Script=${script}}`, 'gu')) ?? [])
      .length;
    if (count > 0 && (best === null || count > best.count)) {
      best = { script, locales, count };
    }
  }
  if (best === null || best.count < 20) {
    return { script: null, locales: [] };
  }
  if (best.script === 'Cyrillic') {
    return { script: best.script, locales: guessCyrillic(text) };
  }
  if (best.script === 'Latin') {
    return { script: best.script, locales: guessLatin(text) };
  }
  if (
    best.script === 'Han' &&
    /\p{Script=Hiragana}|\p{Script=Katakana}/u.test(text)
  ) {
    return { script: 'Japanese', locales: ['ja-JP'] };
  }
  return { script: best.script, locales: best.locales };
}

// --- which short name ---------------------------------------------------------

const KEY_SKIP_WORDS = new Set(
  'the of and a an bible holy biblia version translation edition new old testament public domain no data standard'.split(
    ' ',
  ),
);

// The zero of each script whose digits a Bible title is written in -- Khmer,
// Thai, Lao, Myanmar, Arabic-Indic, Persian, Devanagari, Bengali. A year in
// "ព្រះគម្ពីរបរិសុទ្ធ ១៩៥៤" is 1954 all the same.
const DIGIT_ZERO_LIST = [
  0x17e0, 0x0e50, 0x0ed0, 0x1040, 0x0660, 0x06f0, 0x0966, 0x09e6,
];

function toAsciiDigits(text) {
  return text.replace(/\p{Nd}/gu, (digit) => {
    const point = digit.codePointAt(0);
    const zero = DIGIT_ZERO_LIST.find((one) => {
      return point >= one && point <= one + 9;
    });
    return zero === undefined ? digit : String(point - zero);
  });
}

function toKeyText(text) {
  return String(text ?? '')
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}_-]/gu, '');
}

/**
 * Short names to offer for a Bible, best first. The person picks one or types
 * their own; nothing here is final. Built from what the file says about
 * itself -- its own key, the initials of its title, its language and year, its
 * file name -- and never one already taken (the caller passes `isTaken`,
 * which knows the app's own rule for that).
 */
export function genBibleKeyChoices({
  keyAttribute,
  title,
  sourceName,
  locale,
  isTaken = () => false,
  isValid = () => true,
  limit = 4,
}) {
  const choices = [];
  const add = (value) => {
    const key = toKeyText(value).slice(0, 16);
    if (
      key.length >= 2 &&
      !choices.some((one) => one.toLowerCase() === key.toLowerCase()) &&
      isValid(key) &&
      !isTaken(key)
    ) {
      choices.push(key);
    }
  };
  if (keyAttribute) add(keyAttribute);
  const titleText = String(title ?? '').split(/\s[=(:–—-]\s?|[(,;]/)[0];
  const year =
    toAsciiDigits(String(title ?? '')).match(/\b(1[5-9]\d\d|20\d\d)\b/)?.[1] ??
    '';
  const initials = (titleText.match(/\p{L}[\p{L}'’-]*/gu) ?? [])
    .filter((word) => /^\p{Lu}/u.test(word) || word.length > 3)
    .map((word) => word[0].toUpperCase())
    .join('');
  const language = String(locale ?? '')
    .split('-')[0]
    .toUpperCase();
  if (initials.length >= 2 && initials.length <= 6) add(initials);
  // The file's own key, or its initials, already installed: the same name
  // with a number is what a person would pick by hand.
  for (const value of [keyAttribute, initials]) {
    const key = toKeyText(value).slice(0, 14);
    if (key.length >= 2 && isTaken(key)) {
      for (let number = 2; number <= 9; number++) {
        if (!isTaken(`${key}${number}`)) {
          add(`${key}${number}`);
          break;
        }
      }
      break;
    }
  }
  if (language && year) add(language + year);
  const stem = toFileName(
    toUrl(sourceName) ? sourceName : `https://x/${String(sourceName ?? '')}`,
  )
    .replace(/\.xml$/i, '')
    .replace(BIBLE_FILE_WORDS, '')
    .replace(/[^\p{L}\p{N}]/gu, '');
  if (stem.length >= 2 && stem.length <= 12) add(stem.toUpperCase());
  for (const word of titleText.match(/\p{L}+/gu) ?? []) {
    if (!KEY_SKIP_WORDS.has(word.toLowerCase()) && word.length <= 10) {
      add(word.toUpperCase());
      break;
    }
  }
  if (language) add(`${language}-BIBLE`);
  return choices.slice(0, limit);
}

/**
 * How many of each list's book names appear in the Bible's own words.
 *
 * Editions spell the same books differently -- a 1954 Khmer Bible says
 * លោកុប្បត្តិ where a modern one says កំណើតពិភពលោក -- and the names of
 * Isaiah, John and Paul are all over the verses of the Bible they belong
 * to. So the list whose names the text USES is the one that matches it.
 * Names every list shares tell nothing apart and are not counted, nor is a
 * name's number ("1 Samuel", "សាំយូអែល ទី ១").
 */
export function scoreNameLists(text, lists) {
  const shareCountMap = new Map();
  const toBare = (name) => {
    return name
      .replace(/^\s*\p{Nd}+\s*/u, '')
      .replace(/\s*(?:ទី\s*)?\p{Nd}+\s*$/u, '')
      .trim();
  };
  const bareLists = lists.map((list) => {
    const bareSet = new Set(
      list.names.map(toBare).filter((name) => {
        return name.length >= 2;
      }),
    );
    for (const name of bareSet) {
      shareCountMap.set(name, (shareCountMap.get(name) ?? 0) + 1);
    }
    return bareSet;
  });
  const foundMap = new Map();
  return bareLists.map((bareSet) => {
    let found = 0;
    for (const name of bareSet) {
      if (shareCountMap.get(name) === lists.length) {
        continue;
      }
      if (!foundMap.has(name)) {
        foundMap.set(name, text.includes(name));
      }
      if (foundMap.get(name)) {
        found++;
      }
    }
    return found;
  });
}

/** A list of book names as an id that the same list always gets. */
export function toBibleNameListId(names) {
  let hash = 0x811c9dc5;
  for (const char of (names ?? []).join('\u0001')) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `n${hash.toString(16).padStart(8, '0')}`;
}

/** The digits a choice shows, the way a person would read them. */
export function toDigitsLabel(digits) {
  return (digits ?? []).join(' ');
}
