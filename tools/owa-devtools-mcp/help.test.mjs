import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
    readHelpPage,
    scrubRecipeIds,
    searchHelp,
    toEnglishOnly,
} from './help.mjs';

// `searchHelp` decides which page answers a volunteer's question, so it is
// graded here against a fixture corpus rather than the real one -- the real one
// is rebuilt whenever the manual changes, and a ranking test that moves with it
// grades nothing. The pages below carry only the words each assertion needs.
let knowledgeDirPath = '';
let previousDirPath;

function writeEntry(entry, body) {
    const filePath = path.join(knowledgeDirPath, entry.file);
    mkdirSync(path.dirname(filePath), { recursive: true });
    writeFileSync(filePath, body);
    return { ...entry, searchText: body, headings: '' };
}

beforeAll(() => {
    knowledgeDirPath = mkdtempSync(path.join(tmpdir(), 'owa-knowledge-'));
    const entries = [
        // The page that ANSWERS "nothing is showing": written in the app's
        // words -- screen, display, audience -- and none of the user's.
        writeEntry(
            {
                id: 'W-10',
                title: 'Control what the audience sees',
                section: 'Presenting content',
                kind: 'manual',
                surface: 'presenter',
                file: 'manual/w-10.md',
            },
            '# Control what the audience sees\nShow or hide the screen, or press F5.\nThe Clear buttons empty a layer. The display button picks which display.\n',
        ),
        // The page that merely CONTAINS the user's words. This is the real
        // shape of the bug: it is the only page saying "projector" at all.
        writeEntry(
            {
                id: 'W-19',
                title: 'Draw and spotlight on the app itself',
                section: 'Configuration',
                kind: 'manual',
                surface: null,
                file: 'manual/w-19.md',
            },
            '# Draw and spotlight\nNothing is drawn until you pick a colour (W-10 step 1), and it is showing on the projector while you draw -- see W-18.\n',
        ),
        // The reader's own page, so the focus rule has something to prefer.
        writeEntry(
            {
                id: 'W-11',
                title: 'Read the Bible',
                section: 'Bible study',
                kind: 'manual',
                surface: 'reader',
                file: 'manual/w-11.md',
            },
            '# Read the Bible\nThe reference box and the version button fill the screen with a verse.\n',
        ),
        writeEntry(
            {
                id: 'internal:memory/screens.md',
                title: 'memory / screens',
                section: '',
                kind: 'internal',
                surface: null,
                file: 'internal/memory/screens.md',
            },
            `# screens\nThe audience screen and its display picker.\n${'padding for the cap. '.repeat(1200)}`,
        ),
    ];
    writeFileSync(
        path.join(knowledgeDirPath, 'index.json'),
        JSON.stringify({ generatedAt: '', entries }),
    );
    previousDirPath = process.env.OWA_KNOWLEDGE_DIR;
    process.env.OWA_KNOWLEDGE_DIR = knowledgeDirPath;
});

afterAll(() => {
    if (previousDirPath === undefined) {
        delete process.env.OWA_KNOWLEDGE_DIR;
    } else {
        process.env.OWA_KNOWLEDGE_DIR = previousDirPath;
    }
    rmSync(knowledgeDirPath, { recursive: true, force: true });
});

describe('searchHelp ranking', () => {
    it('answers a volunteer who says "projector" with the page written about the screen', () => {
        // The question that sends someone to this window mid-service. Before
        // the query-side aliases it returned W-19 -- the page about DRAWING --
        // because that one happened to carry all three of the user's words
        // while W-10 carried one of three and lost on squared coverage.
        const hits = searchHelp(
            'Nothing is showing on the projector',
            3,
            'auto',
            'presenter',
        );
        expect(hits[0].id).toBe('W-10');
        expect(hits[0].score).toBeGreaterThan(hits[1].score);
    });

    it('still prefers the page that literally matches when the words are the app own', () => {
        // The aliases must not bulldoze a plain question: asked in the app's
        // vocabulary, the drawing page is still the drawing page.
        const hits = searchHelp('draw and spotlight', 3, 'auto', 'presenter');
        expect(hits[0].id).toBe('W-19');
    });

    it('keeps a builder note below a user page that answers the same words', () => {
        // KIND_WEIGHT is the only thing holding this line, and an answer built
        // from an internal note is the defect this whole corpus split exists
        // to prevent.
        const hits = searchHelp('audience display', 5, 'auto', 'presenter');
        expect(hits[0].kind).toBe('manual');
    });

    it('drops the other half of the app when the asked-for half has an answer', () => {
        // A recipe for the other window names buttons that are not on their
        // screen, so it is worse than no recipe -- but only once something
        // else fits (see the next test).
        const hits = searchHelp('screen', 5, 'auto', 'reader');
        expect(
            hits.every((hit) => {
                return hit.surface !== 'presenter';
            }),
        ).toBe(true);
        expect(hits[0].id).toBe('W-11');
    });

    it('keeps the other half rather than answering nothing', () => {
        // "Clear" lives only on the presenter page here. Asked from the
        // reader, a presenter recipe still beats silence.
        const hits = searchHelp('clear buttons', 5, 'auto', 'reader');
        expect(hits[0].id).toBe('W-10');
    });

    it('answers nothing rather than guessing when no word matches', () => {
        expect(searchHelp('zzzz', 3, 'auto', 'presenter')).toEqual([]);
    });
});

describe('readHelpPage', () => {
    it('round-trips the id a search hit carries', () => {
        expect(readHelpPage('W-10').title).toBe(
            'Control what the audience sees',
        );
        expect(readHelpPage('unknown-id')).toBeNull();
    });

    it('gives the model a whole manual page', () => {
        // A manual page IS the answer; cutting one loses a step the user needs.
        const page = readHelpPage('W-10');
        expect(page.body).toContain('display button');
        expect(page.body).not.toContain('longer than what is shown');
    });

    it('caps a builder note so one lookup cannot eat the conversation', () => {
        // The measured worst case was 208 KB (~52 000 tokens) returned as one
        // tool result, which then rides every remaining round of the loop on
        // the user's own API key.
        const page = readHelpPage('internal:memory/screens.md');
        expect(page.body.length).toBeLessThan(9 * 1024);
        // ...and says so, or the model reports that the note ends there.
        expect(page.body).toContain('longer than what is shown');
        expect(page.body).toContain('display picker');
    });
});

describe('toEnglishOnly', () => {
    it('takes the Khmer twin and whatever introduced it', () => {
        expect(toEnglishOnly('Bible Lookup / ស្វែងរក in the header')).toBe(
            'Bible Lookup in the header',
        );
        expect(toEnglishOnly('press Clear All (លុបទាំងអស់)')).toBe(
            'press Clear All',
        );
    });
});

describe('the Khmer twin the manual writes beside every label', () => {
    it('takes the whole bracket, not only the Khmer inside it', () => {
        // The card read "...and choose Download From URL (URL)." because the
        // bracket held a Latin word too, so only its Khmer was stripped.
        expect(
            toEnglishOnly(
                'choose **Download From URL** (ទាញយកពី URL).',
            ),
        ).toBe('choose **Download From URL**.');
    });

    it('leaves a bracket that is all English alone', () => {
        const text = 'Click **Add URL** (or right-click the empty list).';
        expect(toEnglishOnly(text)).toBe(text);
    });
});

// Measured 2026-09-02: on all 258 corpus questions that name a recipe, the
// ranking put that recipe first for 147. A question picked off the app's own
// list is not a search; its page is already known.
describe('a supported question is a label, not a search', () => {
    it('puts the filed recipe first, marked, even when the words point elsewhere', () => {
        // The fixture's W-19 is the only page saying "projector"; the corpus
        // files this exact question under W-10.
        const hits = searchHelp(
            'Nothing is showing on the projector — what do I check?',
            5,
            'manual',
            'presenter',
        );
        expect(hits[0].id).toBe('W-10');
        expect(hits[0].isKnownQuestion).toBe(true);
        expect(hits.filter((hit) => hit.id === 'W-10').length).toBe(1);
    });

    it('a paraphrase is ranked as before, with no mark on it', () => {
        const hits = searchHelp('nothing comes out on the projector', 5, 'manual');
        expect(hits.some((hit) => hit.isKnownQuestion)).toBe(false);
    });

    it('never files a question under an internal note', () => {
        const hits = searchHelp(
            'Nothing is showing on the projector — what do I check?',
            5,
            'internal',
        );
        expect(hits.some((hit) => hit.isKnownQuestion)).toBe(false);
    });
});

describe('scrubRecipeIds', () => {
    it('takes a cited id out with its aside, keeping the step structure', () => {
        expect(
            scrubRecipeIds(
                '1. Open the **Background** panel (W-08 step 1) and choose\n' +
                    '   the **Videos** tab — see W-28.\n' +
                    '2. Right-click the row (W-01b), see also W-03; then click.',
            ),
        ).toBe(
            '1. Open the **Background** panel and choose\n' +
                '   the **Videos** tab.\n' +
                '2. Right-click the row; then click.',
        );
    });
    it('leaves a page with no id exactly as it was', () => {
        const text = '1. Press **Ctrl+B**.\n   Type the book. You can see it.';
        expect(scrubRecipeIds(text)).toBe(text);
    });
    it('reaches the search excerpts too', () => {
        // W-21 step 1 cites "(W-08 step 1)"; the excerpt used to hand the
        // model the id the page tool had scrubbed, and a two-round answer is
        // written from the excerpt.
        const hits = searchHelp('pick a colour and draw', 5, 'manual');
        const hit = hits.find((one) => one.id === 'W-19');
        expect(hit).toBeDefined();
        expect(hit.excerpt).toContain('pick a colour, and it is showing');
        expect(hit.excerpt).not.toMatch(/\bW-\d/);
        expect(hit.excerpt).not.toMatch(/see\./);
    });
});
