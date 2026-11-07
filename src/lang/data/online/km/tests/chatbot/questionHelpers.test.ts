import { afterEach, describe, expect, it, test } from 'vitest';

describe('a picked question is a known one', () => {
    // 2026-10-12, a local model over the whole corpus. Half the supported
    // questions are filed under a page longer than what rides; the help
    // window's own is 41 000 characters, and its first 6 000 say nothing of
    // the commands "What commands can I type instead of asking?" is about.
    const filler = (name: string) => {
        return `${name} ${'plain words about something else entirely. '.repeat(22)}`;
    };
    const LONG_PAGE = [
        '# Ask the app for help',
        '',
        '**Goal:** get an answer without leaving the app.',
        '',
        `1. ${filler('Open the window.')}`,
        `2. ${filler('Tabs along the top.')}`,
        `3. ${filler('Rename a tab.')}`,
        `4. ${filler('Lock a tab.')}`,
        `5. ${filler('The pickers.')}`,
        `6. ${filler('Type a question.')}`,
        `7. ${filler('Attach a picture.')}`,
        '   **Some things need no assistant at all — type a slash.** A line that',
        '   starts with a slash is a command, and the list of commands appears',
        '   above the box.',
        `8. ${filler('Copy an answer.')}`,
    ].join('\n');

    test('a row that names its passage is cut around it, whatever the words and the control say', async () => {
        const { clipKnownPageParts } =
            await import('../../../../../../chatbot/questionHelpers');
        const page = [
            LONG_PAGE,
            '9. Press **Report**: **Copy report**, **Copy subject** and **Copy picture**, then paste it and save it.',
            `10. ${filler('The settings button.')}`,
            '11. Under every answer is **Copy**, which says **✓ Copied**.',
        ].join('\n');
        const row = {
            text: 'How do I copy an answer?',
            keywords: ['copy', 'clipboard', 'paste', 'save answer'],
            // The control is written first in the bug report's step.
            resources: { recipe: 'W-42', find: 'Copy' },
            focus: null,
        } as any;
        const byControl = clipKnownPageParts(page, 'Copy', row);
        expect(byControl.mode).toBe('step');
        expect(byControl.text).toContain('9. Press **Report**');
        const named = clipKnownPageParts(page, 'Copy', {
            ...row,
            resources: {
                ...row.resources,
                passage: 'Under every answer is Copy',
            },
        });
        expect(named.mode).toBe('matching');
        expect(named.text).toContain('11. Under every answer is **Copy**');
        // ...and the model is told which part that is: the parts ride in the
        // page's order, and the first that seems to fit is not always it.
        const { genKnownQuestionHint } =
            await import('../../../../../../chatbot/questionHelpers');
        const labelled = {
            ...row,
            resources: {
                recipe: 'W-42',
                passage: 'Under every answer is Copy',
            },
        };
        expect(genKnownQuestionHint(labelled, { pageText: page })).toContain(
            'The part that answers THIS question is the one with the words ' +
                '"Under every answer is Copy"',
        );
        // On a page too long to quote whole the named part is quoted FIRST,
        // by itself: the parts ride in the page's order, its opening first,
        // and "Can you walk me through it step by step?" was answered from
        // the opening every time it was asked (2026-10-13).
        const longHint = genKnownQuestionHint(labelled, { pageText: page });
        expect(longHint).toContain(
            '"Under every answer is Copy", quoted first below:',
        );
        const firstAt = longHint?.indexOf(
            'The part that answers this question, quoted first and by itself:',
        );
        const pageAt = longHint?.indexOf('The guide page, put here by the');
        expect(firstAt).toBeGreaterThan(0);
        expect(pageAt).toBeGreaterThan(firstAt ?? 0);
        expect(longHint?.slice(firstAt, pageAt)).toContain(
            '11. Under every answer is **Copy**',
        );
        // Short pages need the same priority: an earlier step can describe
        // a different job, such as adding a version before a pane split.
        const shortHint = genKnownQuestionHint(
            {
                ...labelled,
                resources: { ...labelled.resources, recipe: 'W-11' },
            },
            {
                pageText:
                    '1. Open the window.\n2. Under every answer is **Copy**.',
                localPageText: '1. បើកវា។\n2. ក្រោមចម្លើយនីមួយៗមាន **ចម្លង**។',
            },
        );
        expect(shortHint).toContain('answer from that part in ITS OWN WORDS');
        const shortFirstAt = shortHint!.indexOf('quoted first and by itself:');
        const shortPageAt = shortHint!.indexOf(
            'The guide page, put here by the',
        );
        expect(shortFirstAt).toBeGreaterThan(0);
        expect(shortPageAt).toBeGreaterThan(shortFirstAt);
        const shortFirst = shortHint!.slice(shortFirstAt, shortPageAt);
        expect(shortFirst).toContain('ក្រោមចម្លើយនីមួយៗមាន **ចម្លង**');
        expect(shortFirst).not.toContain('បើកវា');
        expect(shortHint!.slice(shortPageAt)).toContain('បើកវា');
        // ...and to answer in the part's OWN words: a sentence copied
        // cannot change its noun (two of twenty-seven had, 2026-10-13).
        expect(genKnownQuestionHint(labelled, { pageText: page })).toContain(
            'copy the sentences you use as they stand, change no name in ' +
                'them and add no step the page does not have',
        );
        // ...and the WHOLE job (2026-10-17, EC-310): told to take "only what
        // it leaves out", answers stopped where their part did.
        expect(genKnownQuestionHint(labelled, { pageText: page })).toContain(
            'the steps after it that finish the job',
        );
        expect(genKnownQuestionHint(row, { pageText: page })).not.toContain(
            'The part that answers THIS question',
        );
    });
});

// The page in the language the model is asked in (2026-10-17, the whole
// corpus asked in Khmer of gemma4:cloud): handed the English page and told
// to copy the part with the words "Open View on the top menu bar again and
// click", it wrote _បើក View on the top menu bar again and click_. The cut is
// chosen in English and quoted from the translation, block for block.
describe('a known page rides in the language it is asked in', () => {
    const ENGLISH_PAGE = [
        '# W-90 — Reset the panels',
        '',
        '**Goal:** put the layout back the way it started.',
        '',
        '1. Open **View** on the top menu bar → **Widgets**.',
        '2. Click a ticked one — it collapses.',
        '',
        '**Put everything back:**',
        '',
        '3. Open **View** on the top menu bar again and click **Reset Widgets Size**.',
        '4. Answer **Yes**.',
    ].join('\n');
    const KHMER_PAGE = [
        '# W-90 — កំណត់ផ្ទាំងឡើងវិញ',
        '',
        '**គោលដៅ:** ដាក់ប្លង់ត្រឡប់ដូចពេលដំបូងវិញ។',
        '',
        '1. បើក **View** នៅលើរបារម៉ឺនុយខាងលើ → **Widgets**។',
        '2. ចុចលើផ្ទាំងដែលបានធីកមួយ — វាបង្រួម។',
        '',
        '**ដាក់អ្វីៗទាំងអស់ត្រឡប់ដូចដើមវិញ:**',
        '',
        '3. បើក **View** នៅលើរបារម៉ឺនុយខាងលើម្ដងទៀត ហើយចុច **កំណត់ទំហំ Widgets ឡើងវិញ**។',
        '4. ឆ្លើយ **បាទ/ចាស**។',
    ].join('\n');

    test('a page splits into its steps and paragraphs, its foot left off', async () => {
        const { splitPageBlocks } =
            await import('../../../../../../chatbot/questionHelpers');
        const { FRESH_PAGE_NOTE_LEAD } =
            await import('../../../../../../../tools/owa-devtools-mcp/manualPage.mjs');
        expect(splitPageBlocks(ENGLISH_PAGE)).toHaveLength(7);
        expect(splitPageBlocks(KHMER_PAGE)).toHaveLength(7);
        expect(
            splitPageBlocks(`${KHMER_PAGE}\n\n${FRESH_PAGE_NOTE_LEAD} …`),
        ).toEqual(splitPageBlocks(KHMER_PAGE));
    });

    test('a cut of the English page is the same blocks of the translation', async () => {
        const { toLocalizedCut, findLocalizedPassageLead } =
            await import('../../../../../../chatbot/questionHelpers');
        const englishCut =
            ENGLISH_PAGE.slice(0, ENGLISH_PAGE.indexOf('1. Open')) +
            '\n…\n' +
            ENGLISH_PAGE.slice(ENGLISH_PAGE.indexOf('3. Open'));
        const local = toLocalizedCut(ENGLISH_PAGE, KHMER_PAGE, englishCut)!;
        expect(local).toContain('**គោលដៅ:**');
        expect(local).toContain('3. បើក **View** នៅលើរបារម៉ឺនុយខាងលើម្ដងទៀត');
        expect(local).toContain('\n\n…\n\n');
        expect(local).not.toContain('1. បើក');
        expect(local).not.toMatch(/[A-Za-z]{4,} (?:the|on|and) /);
        // A translation that does not line up is no translation of the cut.
        expect(
            toLocalizedCut(ENGLISH_PAGE, '# W-90\n\n1. មួយ។', englishCut),
        ).toBeNull();
        const lead = findLocalizedPassageLead(
            ENGLISH_PAGE,
            KHMER_PAGE,
            'Open View on the top menu bar again and click',
        )!;
        expect(lead.startsWith('បើក View នៅលើរបារម៉ឺនុយខាងលើម្ដងទៀត')).toBe(
            true,
        );
        expect(lead.length).toBeLessThanOrEqual(60);
        // Cut at a space, never inside a word.
        expect(
            'បើក View នៅលើរបារម៉ឺនុយខាងលើម្ដងទៀត ហើយចុច កំណត់ទំហំ Widgets ឡើងវិញ។',
        ).toContain(`${lead} `);
        expect(
            findLocalizedPassageLead(ENGLISH_PAGE, KHMER_PAGE, 'Feed a zebra'),
        ).toBeNull();
    });

    // Passes 9-10 (EC-333): the short answers left out a control the part
    // named; the check is handed the part's own controls by name.
    test('the part a question is filed with names its controls, in the window’s words', async () => {
        const { findKnownPartControls } =
            await import('../../../../../../chatbot/questionHelpers');
        // The English page as the window reads it: labels resolved into
        // Khmer, emphasis left in English.
        const page = [
            '1. Open the panel.',
            '- **ការតុបតែង** is a fold under Properties, on **every** component: **ចន្លោះខាងក្នុង** is the room around it.',
            '2. Close it.',
        ].join('\n');
        const local = [
            '1. បើកផ្ទាំង។',
            '- **ការតុបតែង** គឺជាផ្នែកបត់ **គ្រប់** សមាសធាតុ៖ **ចន្លោះខាងក្នុង**។',
            '2. បិទវា។',
        ].join('\n');
        const row = { resources: { passage: 'is a fold under Properties' } };
        expect(findKnownPartControls(row, page, local)).toEqual([
            'ការតុបតែង',
            'ចន្លោះខាងក្នុង',
        ]);
        // English: emphasis and labels look alike, so no list.
        expect(findKnownPartControls(row, page, null)).toEqual([]);
        expect(
            findKnownPartControls(
                { resources: { passage: 'not on the page' } },
                page,
                local,
            ),
        ).toEqual([]);
    });

    // Pass 7 (EC-328): W-09's foreground list was one block, so the Effects
    // passage was quoted in Khmer as the volume paragraph that opened it.
    test('a bullet starts a block of its own, and a bold lead is not one', async () => {
        const { splitPageBlocks, findLocalizedPassageLead } =
            await import('../../../../../../chatbot/questionHelpers');
        const english = [
            '**The volume of what is playing.** Tick Play With Sound.',
            '- **Sessions** are the row of buttons at the top.',
            '- **Effects** is a fold under Properties, with Padding.',
        ].join('\n');
        const khmer = [
            '**កម្រិតសំឡេង។** ធីក ចាក់ជាមួយសំលេង។',
            '- **វគ្គ** គឺជាជួរប៊ូតុងនៅខាងលើ។',
            '- **ការតុបតែង** គឺជាផ្នែកបត់នៅក្រោម លក្ខណសម្បត្តិ។',
        ].join('\n');
        expect(splitPageBlocks(english)).toHaveLength(3);
        expect(
            findLocalizedPassageLead(
                english,
                khmer,
                'is a fold under Properties',
            ),
        ).toBe('ការតុបតែង គឺជាផ្នែកបត់នៅក្រោម លក្ខណសម្បត្តិ។');
    });

    // The whole corpus asked in Khmer of gemma4:cloud (2026-10-17, EC-317):
    // _How do I cast the virtual display to a TV from my phone?_ was pointed
    // at its step's first words -- the app's own cast button -- where the
    // passage is the step's later sentence about the phone's page.
    test('a passage inside its block is pointed at by its own sentence', async () => {
        const { findLocalizedPassageLead } =
            await import('../../../../../../chatbot/questionHelpers');
        const english = [
            '# Cast',
            '',
            '1. Click **Cast to a TV** on the card. It needs **Let other devices watch**',
            '   on. The browser page has the same button, with one more row:',
            '   - **Cast from this browser** uses the browser itself.',
            '2. Close it.',
        ].join('\n');
        const khmer = [
            '# បញ្ចាំង',
            '',
            '1. ចុច **បញ្ចាំងទៅទូរទស្សន៍** នៅលើកាត។ វាត្រូវការ **អនុញ្ញាតឲ្យមើល**',
            '   បើក។ ទំព័រកម្មវិធីរុករកមានប៊ូតុងដូចគ្នា ដែលមានជួរមួយបន្ថែមទៀត៖',
            '   - **បញ្ចាំងពីកម្មវិធីរុករកនេះ** ប្រើកម្មវិធីរុករកខ្លួនឯង។',
            '2. បិទវា។',
        ].join('\n');
        expect(
            findLocalizedPassageLead(
                english,
                khmer,
                'The browser page has the same button',
            ),
        ).toBe('ទំព័រកម្មវិធីរុករកមានប៊ូតុងដូចគ្នា ដែលមានជួរមួយបន្ថែមទៀត៖');
        // At the block's start, the block's first words.
        expect(
            findLocalizedPassageLead(english, khmer, 'Click Cast to a TV'),
        ).toMatch(/^ចុច បញ្ចាំងទៅទូរទស្សន៍ នៅលើកាត។/);
        // Sentences that do not pair up are not guessed at, and the block's
        // first words are not the passage's either (2026-10-18).
        expect(
            findLocalizedPassageLead(
                english,
                khmer.replace('នៅលើកាត។ វាត្រូវការ', 'នៅលើកាត វាត្រូវការ'),
                'The browser page has the same button',
            ),
        ).toBeNull();
    });

    // The help window's page, asked _What commands can I type?_ on
    // gemma-4-12b: its sixth step holds paragraphs that open on a bold lead,
    // the commands among them, and the cut that rides is made of PASSAGES --
    // a paragraph's lines joined by spaces. Read by blank lines and the
    // block's first characters, the commands never rode, and the hint pointed
    // at the step's first paragraph instead.
    test('a cut of passages finds its blocks, a bold lead starts one, and it has a ceiling', async () => {
        const { toLocalizedCut, findLocalizedPassageLead, splitPageBlocks } =
            await import('../../../../../../chatbot/questionHelpers');
        const english = [
            '# Help',
            '',
            '1. Type a question and press **Ctrl+Enter**.',
            '   **The box takes as many lines as you need.** Plain Enter',
            '   starts a new line.',
            '   **Some things need no assistant at all — type `/`.** A',
            '   line that starts with `/` is a command.',
            '2. Close the window.',
        ].join('\n');
        const khmer = [
            '# ជំនួយ',
            '',
            '1. វាយសំណួរ ហើយចុច **Ctrl+Enter**។',
            '   **ប្រអប់នេះទទួលបានបន្ទាត់ច្រើន។** ការចុច Enter',
            '   ចាប់ផ្ដើមបន្ទាត់ថ្មី។',
            '   **រឿងខ្លះមិនត្រូវការជំនួយការសោះ — វាយ `/`។** បន្ទាត់',
            '   ដែលចាប់ផ្ដើមដោយ `/` គឺជាពាក្យបញ្ជា។',
            '2. បិទបង្អួច។',
        ].join('\n');
        expect(splitPageBlocks(english)).toHaveLength(5);
        // The passage as `toPassages` writes it: one line, no indent.
        const passageCut =
            '**Some things need no assistant at all — type `/`.** A line ' +
            'that starts with `/` is a command.';
        const local = toLocalizedCut(english, khmer, passageCut)!;
        expect(local).toContain('រឿងខ្លះមិនត្រូវការជំនួយការសោះ');
        expect(local).not.toContain('ប្រអប់នេះ');
        expect(
            findLocalizedPassageLead(
                english,
                khmer,
                'Some things need no assistant at all',
            ),
        ).toBe('រឿងខ្លះមិនត្រូវការជំនួយការសោះ — វាយ `/`។ បន្ទាត់');
        // Over its ceiling the cut stops at a line and says the page goes on.
        const whole = toLocalizedCut(english, khmer, english, 60)!;
        expect(whole.length).toBeLessThan(140);
        expect(whole).toContain('the page goes on');
        // A translation whose blocks are of another kind is no translation.
        expect(
            toLocalizedCut(
                english,
                khmer.replace('2. បិទ', '- បិទ'),
                passageCut,
            ),
        ).toBeNull();
    });

    // W-34's step 8 ends on a line "Wordproject." and its step 6 has the same
    // words mid-sentence: a cut of step 6 carried step 8 in with it, and the
    // Khmer answer to "my new Bible reads in English" pasted both (2026-10-18).
    test('a short line deep in a block does not bring that block into a cut', async () => {
        const { toLocalizedCut } =
            await import('../../../../../../chatbot/questionHelpers');
        const english = [
            '# Bibles',
            '',
            '1. **Step 4 — book names**: the suggested list uses the most. ' +
                '**Find more lists online** adds lists from Bible.com and',
            '   Wordproject.',
            '2. Choose **Book name mapping**. Online lookup adds complete ' +
                'lists from Bible.com and Wordproject. Each option',
            '   shows its source.',
        ].join('\n');
        const khmer = [
            '# ព្រះគម្ពីរ',
            '',
            '1. **ជំហាន 4 — ឈ្មោះគម្ពីរ**៖ បញ្ជីដែលវាស្នើ។ ប៊ូតុង បន្ថែមបញ្ជីពី',
            '   Wordproject។',
            '2. ជ្រើសរើស **Book name mapping**។ ការស្វែងរកតាមអ៊ីនធឺណិត ' +
                'បន្ថែមបញ្ជីពេញលេញ។ ជម្រើសនីមួយៗ',
            '   បង្ហាញប្រភពរបស់វា។',
        ].join('\n');
        const local = toLocalizedCut(
            english,
            khmer,
            '2. Choose **Book name mapping**. Online lookup adds complete ' +
                'lists from Bible.com and Wordproject. Each option shows ' +
                'its source.',
        )!;
        expect(local).toContain('ជ្រើសរើស **Book name mapping**');
        expect(local).not.toContain('ជំហាន 4');
    });

    test('the hint quotes the translation and points at it in its words', async () => {
        const { genKnownQuestionHint } =
            await import('../../../../../../chatbot/questionHelpers');
        const row = {
            text: 'How do I put the layout back the way it started?',
            keywords: [],
            resources: {
                recipe: 'W-90',
                passage: 'Open View on the top menu bar again and click',
            },
            focus: null,
        } as any;
        const local = genKnownQuestionHint(row, {
            pageText: ENGLISH_PAGE,
            localPageText: KHMER_PAGE,
        })!;
        expect(local).toContain(KHMER_PAGE.slice(0, 20));
        expect(local).toContain(
            'the words "បើក View នៅលើរបារម៉ឺនុយខាងលើម្ដងទៀត',
        );
        expect(local).not.toContain('on the top menu bar');
        // Asked in English: the English page, pointed at by its English words.
        const english = genKnownQuestionHint(row, { pageText: ENGLISH_PAGE })!;
        expect(english).toContain(
            'the words "Open View on the top menu bar again and click"',
        );
        expect(english).not.toContain('បើក');
    });

    test('a passage in a quote is pointed at without its marks, and not at all out of line', async () => {
        const { findLocalizedPassageLead } =
            await import('../../../../../../chatbot/questionHelpers');
        const english = [
            '# Bibles',
            '',
            '> **Putting it back.** Press Reset. It asks first.',
            '>',
            '> **Deleted it by mistake?** Press Create.',
        ].join('\n');
        const khmer = [
            '# ព្រះគម្ពីរ',
            '',
            '> **ដាក់វាវិញ។** ចុច កំណត់ឡើងវិញ។ វាសួរជាមុន។',
            '>',
            '> **លុបវាដោយច្រឡំមែនទេ?** ចុច បង្កើត។',
        ].join('\n');
        expect(
            findLocalizedPassageLead(english, khmer, 'Deleted it by mistake?'),
        ).toBe('លុបវាដោយច្រឡំមែនទេ? ចុច បង្កើត។');
        // One sentence more in the translation: no words are named rather
        // than the block's first ones.
        expect(
            findLocalizedPassageLead(
                english,
                khmer.replace('វាសួរជាមុន។', 'វា: សួរជាមុន។'),
                'Deleted it by mistake?',
            ),
        ).toBeNull();
    });
});

describe('a page cut for a known question, the smaller rules', () => {
    it('a passage with no words to look for is found nowhere', async () => {
        const { findLocalizedPassageLead } =
            await import('../../../../../../chatbot/questionHelpers');
        expect(
            findLocalizedPassageLead('1. Press Go.', '1. ចុច ទៅ។', '  '),
        ).toBeNull();
    });

    it('a part names its controls ten at most', async () => {
        const { findKnownPartControls } =
            await import('../../../../../../chatbot/questionHelpers');
        const names = 'កខគឃងចឆជឈញដឋ'.split('');
        const page =
            '# A page\n\n1. Press **Go**, then ' +
            names
                .map((name) => {
                    return `**${name}**`;
                })
                .join(', ') +
            '.';
        const controls = findKnownPartControls(
            { resources: { find: 'Go' } } as any,
            page,
            page,
        );
        expect(controls).toEqual(names.slice(0, 10));
    });
});

// Moved out of `src/chatbot/questionHelpers.coverage.ut99.test.ts`: the
// localized cut's edges, read on a Khmer translation.
const TAIL_NOTE =
    '\n…(the page goes on: open it with owa_help_page for the rest)';

describe('a cut of the English page made of its translation', () => {
    const ENGLISH = [
        '# Reset the panels',
        '',
        'Put the layout back the way it started, panel by panel.',
        '',
        '1. Open the View menu on the top menu bar and find Widgets.',
        '2. Click a ticked widget and it collapses out of the way.',
        '3. Open the View menu again and click Reset Widgets Size.',
    ].join('\n');
    const LOCAL_HEADING = '# កំណត់ផ្ទាំងឡើងវិញ';
    const LOCAL_STEP_3 = [
        '3. បើកម៉ឺនុយ View ម្ដងទៀត ហើយចុចកំណត់ទំហំ',
        '   បន្ទាប់មកផ្ទាំងទាំងអស់ត្រឡប់ទៅទំហំដើមវិញ',
        '   ហើយអ្នកអាចចាប់ផ្ដើមឡើងវិញបាន',
    ].join('\n');
    const LOCAL = [
        LOCAL_HEADING,
        '',
        'ដាក់ប្លង់ត្រឡប់ដូចពេលដំបូងវិញ ផ្ទាំងម្ដងមួយៗ។',
        '',
        '1. បើកម៉ឺនុយ View នៅលើរបារម៉ឺនុយខាងលើ ហើយរក Widgets។',
        '2. ចុចលើផ្ទាំងដែលបានធីក វានឹងបង្រួម។',
        LOCAL_STEP_3,
    ].join('\n');
    const CUT = '# Reset the panels\n…\n' + ENGLISH.split('\n').at(-1);

    test('the block that crosses the ceiling is cut at a line, after a gap mark', async () => {
        const { toLocalizedCut } =
            await import('../../../../../../chatbot/questionHelpers');
        const firstLine = LOCAL_STEP_3.split('\n')[0];
        // Room for the heading, the gap and the step's first line only.
        const limit = LOCAL_HEADING.length + 2 + 5 + firstLine.length + 10;
        expect(toLocalizedCut(ENGLISH, LOCAL, CUT, limit)).toBe(
            `${LOCAL_HEADING}\n\n…\n\n${firstLine}${TAIL_NOTE}`,
        );
        // With room, the whole step rides and nothing says it goes on.
        expect(toLocalizedCut(ENGLISH, LOCAL, CUT)).toBe(
            `${LOCAL_HEADING}\n\n…\n\n${LOCAL_STEP_3}`,
        );
    });

    test('a first block with no line that fits is cut at the ceiling itself', async () => {
        const { toLocalizedCut } =
            await import('../../../../../../chatbot/questionHelpers');
        const stepOnly = ENGLISH.split('\n').at(-1)!;
        expect(toLocalizedCut(ENGLISH, LOCAL, stepOnly, 10)).toBe(
            LOCAL_STEP_3.slice(0, 8).trimEnd() + TAIL_NOTE,
        );
    });

    test('a cut that is no block of the page is no cut of the translation', async () => {
        const { toLocalizedCut } =
            await import('../../../../../../chatbot/questionHelpers');
        expect(
            toLocalizedCut(ENGLISH, LOCAL, 'Nothing like this is on the page.'),
        ).toBeNull();
    });

    test('no lead for an empty passage, nor for pages that do not line up', async () => {
        const { findLocalizedPassageLead } =
            await import('../../../../../../chatbot/questionHelpers');
        expect(findLocalizedPassageLead(ENGLISH, LOCAL, '  ')).toBeNull();
        expect(
            findLocalizedPassageLead(
                ENGLISH,
                '# មិនត្រូវគ្នា\n\n1. មួយ។',
                'Click a ticked widget',
            ),
        ).toBeNull();
        // Lined up and named, it is found.
        expect(
            findLocalizedPassageLead(ENGLISH, LOCAL, 'Click a ticked widget'),
        ).toBe('ចុចលើផ្ទាំងដែលបានធីក វានឹងបង្រួម។');
    });
});

describe('the controls a known question’s part names, in Khmer', () => {
    test('a part that points back with nothing before it is read by itself', async () => {
        const { findKnownPartControls } =
            await import('../../../../../../chatbot/questionHelpers');
        const pointing =
            'In that same row, **ក១** and **ខ២** sit side by side.';
        const row = { resources: { passage: 'sit side by side' } } as any;
        expect(findKnownPartControls(row, pointing, 'ទំព័រ')).toEqual([
            'ក១',
            'ខ២',
        ]);
        // With a part before it, that part is what "that row" means.
        expect(
            findKnownPartControls(
                row,
                `The row of buttons: **ឃ៤** stands first.\n\n${pointing}`,
                'ទំព័រ',
            ),
        ).toEqual(['ឃ៤', 'ក១', 'ខ២']);
    });
});

describe('the hint for a known question asked in Khmer', () => {
    const baseRow = {
        id: 'p.s.q',
        text: 'How do I write the links file?',
        kind: 'howto',
        focus: null,
        page: 'p',
        pageLabel: 'Presenter',
        section: 's',
        sectionLabel: 'S',
    };

    afterEach(async () => {
        const { setChatTranslator } =
            await import('../../../../../../chatbot/chatTranHelpers');
        setChatTranslator(
            (text) => text,
            (text) => text,
        );
    });

    test('in another language a menu item is named as that app shows it, the menus’ own items in English', async () => {
        const { genKnownQuestionHint } =
            await import('../../../../../../chatbot/questionHelpers');
        const { setChatTranslator } =
            await import('../../../../../../chatbot/chatTranHelpers');
        setChatTranslator(
            (text) => text,
            (text) => {
                return (
                    {
                        'Reset Widgets Size': 'កំណត់ទំហំ Widgets ឡើងវិញ',
                        'AI Chat': 'ជជែក AI',
                    }[text] ?? text
                );
            },
        );
        const page = '# W-90 — Reset\n\n1. Open **View** and reset.';
        const localPage = '# W-90 — កំណត់\n\n1. បើក **View** ហើយកំណត់។';
        const genHint = (menu: string, localPageText: string | null) => {
            return genKnownQuestionHint(
                { ...baseRow, resources: { recipe: 'W-90', menu } } as any,
                { pageText: page, localPageText },
            )!;
        };
        expect(genHint('View → Reset Widgets Size', localPage)).toContain(
            'the menu item View → កំណត់ទំហំ Widgets ឡើងវិញ:',
        );
        const native = genHint('Help → AI Chat', localPage);
        expect(native).toContain('the menu item Help → AI Chat:');
        expect(native).not.toContain('ជជែក AI');
        // Asked in English, the path is as the row writes it.
        expect(genHint('View → Reset Widgets Size', null)).toContain(
            'the menu item View → Reset Widgets Size:',
        );
    });
});
