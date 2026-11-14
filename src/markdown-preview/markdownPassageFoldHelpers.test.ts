// @vitest-environment jsdom

import { describe, expect, it } from 'vitest';

import {
    addPassageFolds,
    findPassageToggle,
    MARKDOWN_PASSAGE_CLASS,
    MARKDOWN_PASSAGE_FOLDED_CLASS,
    togglePassageFold,
} from './markdownPassageFoldHelpers';
import { renderPreviewMarkdown } from './markdownPreviewRenderHelpers';
import { snapshotMarkdownWordPage } from './markdownWordHelpers';

const LABELS = { collapse: 'Collapse', expand: 'Expand' };

// A study as the app writes one (`toStudyQuoteLines`): its title, the
// passage it quotes, then its own words -- among them a quote that is not a
// passage, and the same passage quoted a second time.
const STUDY_TEXT = [
    '# The Call of Moses at Horeb',
    '',
    '> **Exodus 3:1-2** (KJV)',
    '>',
    '> **1** Now Moses kept the flock of Jethro his father in law.',
    '>',
    '> **2** And the angel of the LORD appeared unto him.',
    '',
    'Words of the study.',
    '',
    '> A plain quote, no passage.',
    '',
    '> **Note** something else (said here)',
    '',
    '> **Exodus 3:1-2** (KJV)',
    '>',
    '> **1** Now Moses kept the flock of Jethro his father in law.',
].join('\n');

function drawPage(text = STUDY_TEXT) {
    const article = document.createElement('div');
    article.innerHTML = renderPreviewMarkdown(text, () => {
        return null;
    }).html;
    return article;
}

function listPassages(article: HTMLElement) {
    return Array.from(
        article.querySelectorAll(`blockquote.${MARKDOWN_PASSAGE_CLASS}`),
    );
}

describe('addPassageFolds', () => {
    it('gives a toggle to each passage in the app form, and nothing else', () => {
        const article = drawPage();
        expect(addPassageFolds(article, new Set(), LABELS)).toBe(2);
        const passages = listPassages(article);
        expect(passages).toHaveLength(2);
        expect(article.querySelectorAll('blockquote')).toHaveLength(4);
        for (const passage of passages) {
            const head = passage.firstElementChild!;
            const toggle = head.firstElementChild!;
            expect(toggle.tagName).toBe('BUTTON');
            expect(toggle.getAttribute('aria-expanded')).toBe('true');
            expect(toggle.getAttribute('title')).toBe('Collapse');
            expect(head.textContent).toBe('Exodus 3:1-2 (KJV)');
            expect(
                passage.classList.contains(MARKDOWN_PASSAGE_FOLDED_CLASS),
            ).toBe(false);
        }
    });

    it('leaves a reference line with no verse under it alone', () => {
        const article = drawPage('> **Exodus 3:1-2** (KJV)');
        expect(addPassageFolds(article, new Set(), LABELS)).toBe(0);
        expect(article.querySelector('button')).toBeNull();
    });

    it('folds again, on a new draw, only the passage that was folded', () => {
        const foldedKeySet = new Set<string>();
        const article = drawPage();
        addPassageFolds(article, foldedKeySet, LABELS);
        const secondToggle = listPassages(article)[1].querySelector('button')!;
        expect(togglePassageFold(secondToggle, foldedKeySet, LABELS)).toBe(
            true,
        );
        expect(foldedKeySet.size).toBe(1);

        // A save draws the page again from new HTML.
        const redrawn = drawPage();
        addPassageFolds(redrawn, foldedKeySet, LABELS);
        const [first, second] = listPassages(redrawn);
        expect(first.classList.contains(MARKDOWN_PASSAGE_FOLDED_CLASS)).toBe(
            false,
        );
        expect(second.classList.contains(MARKDOWN_PASSAGE_FOLDED_CLASS)).toBe(
            true,
        );
        const toggle = second.querySelector('button')!;
        expect(toggle.getAttribute('aria-expanded')).toBe('false');
        expect(toggle.getAttribute('title')).toBe('Expand');
        expect(toggle.firstElementChild!.className).toBe('bi bi-chevron-right');
    });
});

describe('togglePassageFold', () => {
    it('unfolds what it folded and forgets it', () => {
        const foldedKeySet = new Set<string>();
        const article = drawPage();
        addPassageFolds(article, foldedKeySet, LABELS);
        const passage = listPassages(article)[0];
        const icon = passage.querySelector('button > i')!;
        // A press lands on the icon inside the button.
        const toggle = findPassageToggle(icon)!;
        expect(togglePassageFold(toggle, foldedKeySet, LABELS)).toBe(true);
        expect(togglePassageFold(toggle, foldedKeySet, LABELS)).toBe(false);
        expect(foldedKeySet.size).toBe(0);
        expect(passage.classList.contains(MARKDOWN_PASSAGE_FOLDED_CLASS)).toBe(
            false,
        );
        expect(toggle.getAttribute('title')).toBe('Collapse');
    });

    it('finds no toggle off one', () => {
        const article = drawPage();
        addPassageFolds(article, new Set(), LABELS);
        expect(findPassageToggle(article.querySelector('h1'))).toBeNull();
        expect(findPassageToggle(null)).toBeNull();
    });
});

describe('a folded passage in the Word document', () => {
    it('carries every verse and no toggle', () => {
        const foldedKeySet = new Set<string>();
        const article = drawPage();
        addPassageFolds(article, foldedKeySet, LABELS);
        for (const passage of listPassages(article)) {
            togglePassageFold(
                passage.querySelector('button')!,
                foldedKeySet,
                LABELS,
            );
        }
        const { bodyXml } = snapshotMarkdownWordPage([article], {
            pickTextLang: () => {
                return null;
            },
        });
        expect(bodyXml).toContain('And the angel of the LORD appeared');
        expect(bodyXml.match(/Now Moses kept the flock/g)).toHaveLength(2);
        expect(bodyXml).not.toContain('Collapse');
        expect(bodyXml).not.toContain('Expand');
    });
});
