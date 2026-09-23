import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { BOT_FOCUS_KEYS } from './botFocus.mjs';
import {
    flattenQuestions,
    listQuestionPageIds,
    loadQuestionPages,
    matchQuestions,
    outlineQuestions,
} from './questions.mjs';

// Unlike `help.test.mjs`, this runs against the REAL corpus on purpose. The
// files are the deliverable -- a question with no recipe, a duplicate id or a
// section nobody can reach is the defect this test exists to catch, and a
// fixture corpus would grade none of it.
const PAGES = loadQuestionPages();
const ROWS = flattenQuestions(PAGES);

// The manual as it exists on disk, read straight from the sources rather than
// from `electron-build/knowledge` -- that bundle is a build output, and a test
// that needs one built cannot fail on a machine that has not built it.
function listManualIds() {
    const root = join(import.meta.dirname, '..', '..', 'docs', 'manual-sources');
    const ids = [];
    const walk = (dir) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const path = join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(path);
                continue;
            }
            if (!entry.name.endsWith('.md')) {
                continue;
            }
            const found = readFileSync(path, 'utf8').match(/^id:\s*(\S+)\s*$/m);
            if (found !== null) {
                ids.push(found[1]);
            }
        }
    };
    walk(root);
    return ids;
}

describe('the question corpus', () => {
    // Not a hardcoded list: adding a page file used to mean editing this
    // assertion, the renderer's imports and the tool's enum before the file
    // counted for anything. What the assertion is really for is that every
    // file on disk actually LOADED -- `loadQuestionPages` swallows a parse
    // error per file, so a corrupt one silently leaves the corpus and nothing
    // else would notice.
    it('loads every page file on disk', () => {
        expect(PAGES.map((page) => page.page).sort()).toEqual(
            [...listQuestionPageIds()].sort(),
        );
    });

    // The invariant the tool's `page` enum is built on: it names pages from
    // the file names without parsing them.
    it('names each file after the page inside it', () => {
        expect(listQuestionPageIds().sort()).toEqual(
            PAGES.map((page) => page.page).sort(),
        );
    });

    it('gives every question a unique id', () => {
        const ids = ROWS.map((row) => row.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('writes every question as a question a volunteer would type', () => {
        for (const row of ROWS) {
            expect(row.text.length).toBeGreaterThan(8);
            if (row.isTemplate) {
                // A template is the start of a sentence the user finishes, so
                // it is an instruction rather than a question -- and it has to
                // carry a blank for them to fill, or there was nothing to
                // finish and it should have been asked outright. An example
                // address or an example verse reference is such a blank: the
                // user overtypes the example with their own.
                expect(row.text, row.id).toMatch(
                    /example\.com|\.\.\.|<[^>]+>|\b[A-Z][a-z]+ \d+:\d+\b/,
                );
                continue;
            }
            expect(row.text.endsWith('?'), row.id).toBe(true);
        }
    });

    it('backs every question with a recipe or a live tool', () => {
        // The whole point of the corpus: a suggested question the assistant
        // cannot answer is worse than no suggestion at all.
        for (const row of ROWS) {
            const { recipe, tools } = row.resources;
            expect(
                Boolean(recipe) || (tools ?? []).length > 0,
                `${row.id} has no recipe and no tool`,
            ).toBe(true);
        }
    });

    it('points every recipe at a real manual id', () => {
        for (const row of ROWS) {
            const ids = [
                row.resources.recipe,
                ...(row.resources.related ?? []),
            ].filter(Boolean);
            for (const id of ids) {
                expect(id, `${row.id} -> ${id}`).toMatch(/^W-\d{2}[a-z]?$/);
            }
        }
    });

    // The same "shape is not existence" hole, one field along. A `tools` entry
    // was checked for being non-empty and never for naming a tool that exists,
    // so a typo would have handed the model a resource it cannot call -- the
    // corpus promising an answer again.
    //
    // Read out of the source rather than off a live server: `owaTools.mjs`
    // imports chrome-devtools-mcp, and a test that needs the app running is a
    // test that gets skipped.
    it('points every named tool at one this package registers', () => {
        const source = readFileSync(
            join(import.meta.dirname, 'owaTools.mjs'),
            'utf8',
        );
        // Both spellings: most tools name themselves at `registerTool`, but
        // `owa_lyric_file` and `owa_slide_file` are one registration in a loop
        // over two descriptors, so their names appear only as a `name:` field.
        // Reading just the first spelling made two real tools invisible here,
        // and this test would have called a corpus entry citing them a typo.
        const registered = new Set([
            ...[...source.matchAll(/registerTool\(\s*'([a-z_]+)'/g)].map(
                (one) => {
                    return one[1];
                },
            ),
            ...[...source.matchAll(/name:\s*'(owa_[a-z_]+)'/g)].map((one) => {
                return one[1];
            }),
        ]);
        expect(registered.size, 'no tools found in owaTools.mjs').toBeGreaterThan(
            10,
        );
        for (const row of ROWS) {
            for (const name of row.resources.tools ?? []) {
                // Only this package's own tools can be checked here;
                // chrome-devtools' are registered in another package.
                if (!name.startsWith('owa_')) {
                    continue;
                }
                expect(registered.has(name), `${row.id} -> ${name}`).toBe(true);
            }
        }
    });

    // Shape is not existence, and reading it as if it were cost four questions
    // their answer: `W-01b` matched the pattern above for months while the
    // manual generator's own heading regex accepted digits only, so the recipe
    // was silently folded into W-01's page and no `W-01b` document was ever
    // written. `owa_help_page` could not open it and a walkthrough started on
    // it could not run -- the corpus promised an answer that did not exist.
    it('points every recipe at a manual page that IS on disk', () => {
        const onDisk = new Set(listManualIds());
        expect(onDisk.size, 'no manual pages found').toBeGreaterThan(0);
        for (const row of ROWS) {
            const ids = [
                row.resources.recipe,
                ...(row.resources.related ?? []),
            ].filter(Boolean);
            for (const id of ids) {
                expect(
                    onDisk.has(id),
                    `${row.id} -> ${id} has no page under docs/manual-sources`,
                ).toBe(true);
            }
        }
    });

    it('gives every question keywords a user might type instead', () => {
        for (const row of ROWS) {
            expect(row.keywords.length, `${row.id}`).toBeGreaterThan(0);
        }
    });

    it('leads each window with its own curated four', () => {
        // The ratchet: these are the four the window has always opened on, and
        // a corpus edit that quietly demotes them is a regression in the first
        // thing a volunteer ever sees.
        expect(
            matchQuestions('', { focus: 'presenter', limit: 4 }).map((row) => {
                return row.text;
            }),
        ).toEqual([
            'How do I present a Bible verse?',
            'How do I add a background?',
            // Took the clear button's place deliberately, 2026-09-03: the
            // clear buttons are large and labelled in the header, and nothing
            // else in the window says the assistant can write a song for you.
            'Can you make a song from words I paste in?',
            // And this took the screen check's place, 2026-09-04. It is the
            // only chip that is a TEMPLATE: it fills the box rather than
            // asking, because the address in it is the user's to supply.
            // "Is any screen showing right now?" is still one press away in
            // the suggestion list, and the projector question a volunteer
            // actually asks mid-service -- "nothing is showing" -- is the
            // troubleshooting starter, which every window carries.
            'Create a lyric file from https://example.com/lyric/amazing_grace',
        ]);
        expect(
            matchQuestions('', { focus: 'reader', limit: 4 }).map((row) => {
                return row.text;
            }),
        ).toEqual([
            'Where do I type John 3:16?',
            'The words are too small. Can you help me?',
            'I lost the passage I was reading. How do I get it back?',
            'How do I put two Bible versions side by side?',
        ]);
    });

    it('offers starters in every window', () => {
        const starters = ROWS.filter((row) => {
            return row.starter;
        });
        expect(starters.length).toBeGreaterThan(8);
        // Every window, not just the two the app used to be. A focus with no
        // page file of its own still has to open on four chips -- `common` and
        // `troubleshooting` are `focus: null` and reach all of them, which is
        // what makes a window viable before its own questions are written.
        for (const focus of BOT_FOCUS_KEYS) {
            expect(matchQuestions('', { focus, limit: 4 }).length, focus).toBe(
                4,
            );
        }
    });

    // Every page file names a window that actually exists. The key is spliced
    // into `page: "<key>.html"` by the tools, so a typo here is not a wrong
    // label -- it is a tool call that can never match an open page.
    it('names only windows that are declared', () => {
        for (const page of PAGES) {
            const declared =
                page.focus === null || page.focus === undefined
                    ? []
                    : [page.focus].flat();
            for (const focus of declared) {
                expect(BOT_FOCUS_KEYS, page.page).toContain(focus);
            }
        }
    });

    // The rule the schema states and nothing used to enforce. Ranks are
    // compared across every file a focus can see, so two files sharing a focus
    // and a rank leave the order to sort stability -- which is how
    // `troubleshooting`'s rank 5 quietly tied with the reader's fifth chip.
    it('keeps every starter rank unique within a window', () => {
        for (const focus of BOT_FOCUS_KEYS) {
            const seen = new Map();
            for (const row of ROWS) {
                const declared =
                    row.focus === null || row.focus === undefined
                        ? null
                        : [row.focus].flat();
                if (
                    !row.starter ||
                    row.starterRank === null ||
                    (declared !== null && !declared.includes(focus))
                ) {
                    continue;
                }
                const clash = seen.get(row.starterRank);
                expect(
                    clash,
                    `${focus}: rank ${row.starterRank} on both ` +
                        `${clash} and ${row.id}`,
                ).toBe(undefined);
                seen.set(row.starterRank, row.id);
            }
        }
    });
});

describe('matchQuestions', () => {
    it('answers an empty query with starters, which is what the box shows', () => {
        const results = matchQuestions('', { limit: 5 });
        expect(results).toHaveLength(5);
        for (const row of results) {
            expect(row.starter).toBe(true);
        }
    });

    it('finds the question the user is typing the words of', () => {
        const [top] = matchQuestions('how do I present a bible verse');
        expect(top.text).toBe('How do I present a Bible verse?');
    });

    it('completes a half-typed word', () => {
        const [top] = matchQuestions('backg');
        expect(top.text).toBe('How do I add a background?');
    });

    it('prefers a whole word to a longer word that starts the same', () => {
        // "song" is a prefix of "SongSelect will not connect", which a plain
        // startsWith/includes ranks above every question about songs.
        const [top] = matchQuestions('song');
        expect(top.text).toBe("How do I put a song's lyrics on the screen?");
    });

    it('understands what a volunteer calls things', () => {
        const texts = matchQuestions('projector', { limit: 5 }).map((row) => {
            return row.text;
        });
        expect(texts.join(' ')).toMatch(/screen|display/i);
    });

    it('routes the panic question to the screens it can look at', () => {
        const [top] = matchQuestions('nothing is showing');
        expect(top.resources.tools).toContain('owa_list_screens');
    });

    it('keeps the other window out of the way', () => {
        const pages = new Set(
            matchQuestions('bible', { focus: 'reader', limit: 20 }).map(
                (row) => {
                    return row.page;
                },
            ),
        );
        expect(pages.has('presenter')).toBe(false);
        expect(pages.has('editor')).toBe(false);
    });

    it('keeps what is true everywhere in every window', () => {
        for (const focus of BOT_FOCUS_KEYS) {
            const [top] = matchQuestions('back everything up', { focus });
            expect(top.page, focus).toBe('common');
        }
    });

    it('narrows to one section when asked', () => {
        const results = matchQuestions('clear', {
            page: 'screen',
            section: 'screens',
            limit: 10,
        });
        expect(results.length).toBeGreaterThan(0);
        for (const row of results) {
            expect(row.section).toBe('screens');
        }
    });

    it('returns nothing rather than a guess', () => {
        expect(matchQuestions('zzzzqqq')).toEqual([]);
    });

    it('halves a score when only some of the typed words land', () => {
        // Both words present beats one word present, so a two-word query is
        // not answered by whichever question repeats the commoner word.
        const [top] = matchQuestions('clear background');
        expect(top.text).toBe('How do I remove the background from the screen?');
    });
});

describe('outlineQuestions', () => {
    it('summarises the corpus without listing every question', () => {
        const outline = outlineQuestions();
        const presenter = outline.find((page) => {
            return page.page === 'presenter';
        });
        expect(presenter.sections.length).toBeGreaterThan(5);
        for (const section of presenter.sections) {
            expect(section.count).toBeGreaterThan(0);
            expect(section).not.toHaveProperty('questions');
        }
    });

    it('drops the other window', () => {
        const pages = outlineQuestions({ focus: 'reader' }).map((page) => {
            return page.page;
        });
        expect(pages).toContain('reader');
        expect(pages).toContain('common');
        expect(pages).not.toContain('presenter');
    });
});
