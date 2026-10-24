/**
 * What the app's own cross references say about a PASSAGE, for
 * `owa_lookup_record`'s `related` (2026-10-23; the user's goal with a Bible
 * view's 🤖 conversation on Genesis 8:1-22: _help user find everything
 * related to the selected verses_).
 *
 * The data is the Reader's **Cross References** panel's
 * (`getLocalBibleCrossRef`, one bundle per language): for each VERSE, a few
 * themes, each a sentence in that language and the verses it leads to --
 * Genesis 8:1 has eight, "God Remembering His People in Mercy" leading to
 * Genesis 19:29, 30:22, Exodus 2:24 … A passage of twenty-two verses is
 * ~170 themes and ~1 200 references, far more than rides a question, so
 * this reads it the way a person would want it told: what the passage's
 * verses point to MOST, where the other Testament speaks of it, and each
 * verse's first few themes.
 *
 * Pure: the per-verse lists come in, the book order with them, and a test
 * hands it lists of its own. The worker (`agentLookupHelpers.ts`) reads the
 * bundle and the Bible.
 */

/** One theme of one verse, as the bundle stores it. */
export type CrossRefThemeType = {
    title: string;
    titleEn?: string;
    verses: string[];
};

/** A verse of the passage and its themes. */
export type VerseCrossRefsType = {
    // `GEN 8:1`
    verse: string;
    themes: CrossRefThemeType[];
};

/** A reference the passage's verses lead to, and which of them do. */
export type CitedRefType = {
    // `GEN 9:15`, `PSA 107:25-29` -- as the bundle writes it, first seen.
    key: string;
    // The verse numbers of the passage that lead to it, `8:21` in a passage
    // over chapters.
    from: string[];
};

export type PassageCrossRefsType = {
    verseCount: number;
    themeCount: number;
    referenceCount: number;
    // Led to by two or more of the passage's verses, the most first; for
    // one verse, its themes' references in their order.
    mostCited: CitedRefType[];
    // The New Testament for a passage of the Old, and the other way round:
    // where the rest of the Bible speaks of it -- the most led to first, as
    // the quoted few are the first few (2026-10-23: in Bible order,
    // Matthew 18:16's Deuteronomy 19:15 came sixth, unquoted, and the
    // answer named Exodus and Numbers instead).
    otherTestament: CitedRefType[];
    otherTestamentName: 'New Testament' | 'Old Testament';
    byVerse: {
        verse: string;
        themes: { theme: string; refs: string[] }[];
    }[];
};

export type PassageCrossRefsOptionsType = {
    // The passage asked about: `GEN 8:1-22`, `JHN 18:33-19:16`, `GEN 8:21`.
    passageKey: string;
    // Every book key in the Bible's order, GEN … REV.
    bookOrder: string[];
    maxCited?: number;
    maxOtherTestament?: number;
    maxThemesPerVerse?: number;
    maxRefsPerTheme?: number;
    maxVerses?: number;
    // Name the verses a reference is led to from by chapter and verse
    // (`7:11`) even in a passage of one chapter: the chapters AROUND it are
    // read the same way (`listAroundOtherTestament`).
    isFromChapterNamed?: boolean;
};

const FIRST_NEW_TESTAMENT_BOOK = 'MAT';

const KEY_PATTERN = /^(\S+) (\d+):(\d+)(?:-(?:(\d+):)?(\d+))?$/;

type SpanType = {
    bookKey: string;
    chapter: number;
    verse: number;
    endChapter: number;
    endVerse: number;
};

const NAMED_ENTITY_MAP: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: '’',
    nbsp: ' ',
};

/**
 * A theme's title as TEXT. The bundle holds it as the Reader's panel draws
 * it, sanitized HTML (`RenderAIBibleCrossReferenceComp`), and the French one
 * writes an apostrophe as `&#39;` in 56 568 of its 231 890 titles -- shown
 * as it stands in the help window, which draws text, and read so by the
 * model: _l&#39;armure de Saül_ (2026-10-23). Tags are dropped and
 * entities read, by hand: a static render must not parse HTML.
 */
export function toPlainThemeTitle(title: string) {
    if (!/[<&]/.test(title)) {
        return title;
    }
    return title
        .replace(/<[^>]*>/g, '')
        .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, body: string) => {
            if (body.startsWith('#')) {
                const code =
                    body[1].toLowerCase() === 'x'
                        ? Number.parseInt(body.slice(2), 16)
                        : Number.parseInt(body.slice(1), 10);
                if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) {
                    return entity;
                }
                // The apostrophe as French writes it, like the app's own words.
                return code === 39 ? '’' : String.fromCodePoint(code);
            }
            return NAMED_ENTITY_MAP[body.toLowerCase()] ?? entity;
        })
        .trim();
}

/** A verse key or range as numbers, or null. */
export function toCrossRefSpan(key: string): SpanType | null {
    const match = KEY_PATTERN.exec(key.trim());
    if (match === null) {
        return null;
    }
    const chapter = Number(match[2]);
    const verse = Number(match[3]);
    const endChapter = match[4] === undefined ? chapter : Number(match[4]);
    const endVerse = match[5] === undefined ? verse : Number(match[5]);
    return { bookKey: match[1], chapter, verse, endChapter, endVerse };
}

function toPosition(chapter: number, verse: number) {
    return chapter * 1000 + verse;
}

/** Whether a reference STARTS inside the passage -- it is the passage. */
function checkIsInside(span: SpanType, passage: SpanType) {
    if (span.bookKey !== passage.bookKey) {
        return false;
    }
    const at = toPosition(span.chapter, span.verse);
    return (
        at >= toPosition(passage.chapter, passage.verse) &&
        at <= toPosition(passage.endChapter, passage.endVerse)
    );
}

/** The key a reference is counted by: its first verse. */
function toStartKey(span: SpanType) {
    return `${span.bookKey} ${span.chapter}:${span.verse}`;
}

/** `8:21` for a verse of the passage, or `21` when it is one chapter. */
function toFromLabel(verseKey: string, isOneChapter: boolean) {
    const span = toCrossRefSpan(verseKey);
    if (span === null) {
        return verseKey;
    }
    return isOneChapter ? String(span.verse) : `${span.chapter}:${span.verse}`;
}

type TallyType = {
    key: string;
    startKey: string;
    span: SpanType;
    from: string[];
    // Where it was first met: verse index, theme index, place in the theme.
    firstAt: number;
};

/**
 * References that overlap in one chapter as one span, led to from all their
 * verses, in the place the first of them was met (2026-10-23): Matthew
 * 24:37-39, 24:38-39 and 24:39 are one saying, and listed as three they
 * took half of a list of six.
 */
function mergeOverlapping(tallyList: TallyType[]) {
    const kept: TallyType[] = [];
    for (const tally of [...tallyList].sort((a, b) => {
        return a.firstAt - b.firstAt;
    })) {
        const { span } = tally;
        const found =
            span.chapter !== span.endChapter
                ? undefined
                : kept.find((one) => {
                      return (
                          one.span.bookKey === span.bookKey &&
                          one.span.chapter === one.span.endChapter &&
                          one.span.chapter === span.chapter &&
                          one.span.verse <= span.endVerse &&
                          span.verse <= one.span.endVerse
                      );
                  });
        if (found === undefined) {
            kept.push({ ...tally, from: [...tally.from] });
            continue;
        }
        const verse = Math.min(found.span.verse, span.verse);
        const endVerse = Math.max(found.span.endVerse, span.endVerse);
        found.span = { ...found.span, verse, endVerse };
        found.key =
            `${span.bookKey} ${span.chapter}:${verse}` +
            (endVerse > verse ? `-${endVerse}` : '');
        found.startKey = toStartKey(found.span);
        for (const from of tally.from) {
            if (!found.from.includes(from)) {
                found.from.push(from);
            }
        }
    }
    return kept;
}

/**
 * The passage's cross references, told the way a reader wants them: the
 * references its verses lead to most, the other Testament's, and each
 * verse's first themes -- every list bounded, the passage itself left out.
 */
export function toPassageCrossRefs(
    verseList: VerseCrossRefsType[],
    options: PassageCrossRefsOptionsType,
): PassageCrossRefsType {
    const {
        passageKey,
        bookOrder,
        maxCited = 10,
        maxOtherTestament = 10,
        maxThemesPerVerse = 2,
        maxRefsPerTheme = 4,
        maxVerses = 40,
        isFromChapterNamed = false,
    } = options;
    const passage = toCrossRefSpan(passageKey);
    const isOneChapter =
        !isFromChapterNamed &&
        (passage === null || passage.chapter === passage.endChapter);
    const bookIndexMap = new Map(
        bookOrder.map((bookKey, index) => {
            return [bookKey, index];
        }),
    );
    const newTestamentStart =
        bookIndexMap.get(FIRST_NEW_TESTAMENT_BOOK) ?? Number.MAX_SAFE_INTEGER;
    const toIsNewTestament = (bookKey: string) => {
        return (bookIndexMap.get(bookKey) ?? -1) >= newTestamentStart;
    };
    const isPassageNew = passage !== null && toIsNewTestament(passage.bookKey);
    const tallyMap = new Map<string, TallyType>();
    let themeCount = 0;
    let referenceCount = 0;
    const byVerse: PassageCrossRefsType['byVerse'] = [];
    verseList.forEach((verseRefs, verseIndex) => {
        const from = toFromLabel(verseRefs.verse, isOneChapter);
        const shownThemes: { theme: string; refs: string[] }[] = [];
        verseRefs.themes.forEach((theme, themeIndex) => {
            if (
                typeof theme?.title !== 'string' ||
                !Array.isArray(theme.verses)
            ) {
                return;
            }
            themeCount++;
            const themeRefs: string[] = [];
            theme.verses.forEach((key, refIndex) => {
                if (typeof key !== 'string') {
                    return;
                }
                const span = toCrossRefSpan(key);
                if (span === null || !bookIndexMap.has(span.bookKey)) {
                    return;
                }
                if (passage !== null && checkIsInside(span, passage)) {
                    return;
                }
                referenceCount++;
                themeRefs.push(key.trim());
                const startKey = toStartKey(span);
                const found = tallyMap.get(startKey);
                if (found === undefined) {
                    tallyMap.set(startKey, {
                        key: key.trim(),
                        startKey,
                        span,
                        from: [from],
                        firstAt:
                            verseIndex * 1_000_000 +
                            themeIndex * 1000 +
                            refIndex,
                    });
                } else if (!found.from.includes(from)) {
                    found.from.push(from);
                }
            });
            if (
                themeRefs.length > 0 &&
                shownThemes.length < maxThemesPerVerse
            ) {
                shownThemes.push({
                    theme: theme.title.trim(),
                    refs: themeRefs.slice(0, maxRefsPerTheme),
                });
            }
        });
        if (shownThemes.length > 0 && byVerse.length < maxVerses) {
            byVerse.push({ verse: from, themes: shownThemes });
        }
    });
    const toBookIndex = (tally: TallyType) => {
        return bookIndexMap.get(tally.span.bookKey) ?? 0;
    };
    const byCanon = (a: TallyType, b: TallyType) => {
        return (
            toBookIndex(a) - toBookIndex(b) ||
            toPosition(a.span.chapter, a.span.verse) -
                toPosition(b.span.chapter, b.span.verse)
        );
    };
    const byCount = (a: TallyType, b: TallyType) => {
        return b.from.length - a.from.length || a.firstAt - b.firstAt;
    };
    const tallyList = mergeOverlapping(Array.from(tallyMap.values()));
    const toCited = (tally: TallyType): CitedRefType => {
        return { key: tally.key, from: tally.from };
    };
    // One verse leads to each reference once: its own order is the order
    // its themes give them.
    const isOneVerse = verseList.length === 1;
    const mostCited = (
        isOneVerse
            ? [...tallyList].sort((a, b) => {
                  return a.firstAt - b.firstAt;
              })
            : tallyList
                  .filter((tally) => {
                      return tally.from.length >= 2;
                  })
                  .sort(byCount)
    )
        .slice(0, maxCited)
        .map(toCited);
    const otherTestament = tallyList
        .filter((tally) => {
            return toIsNewTestament(tally.span.bookKey) !== isPassageNew;
        })
        .sort((a, b) => {
            return b.from.length - a.from.length || byCanon(a, b);
        })
        .slice(0, maxOtherTestament)
        .map(toCited);
    return {
        verseCount: verseList.length,
        themeCount,
        referenceCount,
        mostCited,
        otherTestament,
        otherTestamentName: isPassageNew ? 'Old Testament' : 'New Testament',
        byVerse,
    };
}

/**
 * Where the other Testament speaks of the chapters AROUND a passage -- the
 * rest of the same story -- that it does not already say of the passage
 * itself (2026-10-23, `EC-416`). The bundle ties a saying to the chapters
 * that tell its event: Jesus on the days of Noah (Matthew 24:37-39, Luke
 * 17:26-27) is led to from Genesis 6-7 a dozen times each and never from
 * Genesis 8, so _where does the New Testament speak of this?_ under Genesis
 * 8 left out the words of Jesus himself. Each is named by the verses around
 * it that lead there (`7:11`).
 */
export function listAroundOtherTestament(
    aroundList: VerseCrossRefsType[],
    options: {
        passageKey: string;
        bookOrder: string[];
        shownKeys: string[];
        max?: number;
    },
): CitedRefType[] {
    const { passageKey, bookOrder, shownKeys, max = 6 } = options;
    const shownSet = new Set(
        shownKeys.flatMap((key) => {
            const span = toCrossRefSpan(key);
            return span === null ? [] : [toStartKey(span)];
        }),
    );
    return toPassageCrossRefs(aroundList, {
        passageKey,
        bookOrder,
        maxOtherTestament: max + shownSet.size,
        isFromChapterNamed: true,
    })
        .otherTestament.filter((cited) => {
            const span = toCrossRefSpan(cited.key);
            return span !== null && !shownSet.has(toStartKey(span));
        })
        .slice(0, max);
}

/**
 * Every theme of the passage's verses, for a button that lists them a page
 * at a time: each with the verse of the passage it belongs to, and its
 * references outside the passage.
 */
export function listPassageCrossRefThemes(
    verseList: VerseCrossRefsType[],
    passageKey: string,
) {
    const passage = toCrossRefSpan(passageKey);
    const isOneChapter =
        passage === null || passage.chapter === passage.endChapter;
    return verseList.flatMap((verseRefs) => {
        const from = toFromLabel(verseRefs.verse, isOneChapter);
        return verseRefs.themes.flatMap((theme) => {
            if (
                typeof theme?.title !== 'string' ||
                !Array.isArray(theme.verses)
            ) {
                return [];
            }
            const refs = theme.verses.filter((key) => {
                const span =
                    typeof key === 'string' ? toCrossRefSpan(key) : null;
                return (
                    span !== null &&
                    (passage === null || !checkIsInside(span, passage))
                );
            });
            return refs.length === 0
                ? []
                : [{ verse: from, theme: theme.title.trim(), refs }];
        });
    });
}
