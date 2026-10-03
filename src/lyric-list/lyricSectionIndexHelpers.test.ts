import { describe, expect, it } from 'vitest';

import { addTitleToSectionIndex } from './lyricSectionIndexHelpers';

const FREE_WIDTH_STYLE =
    'left: auto; inset-inline-start: auto; width: auto; ' +
    'min-width: max-content; max-width: none; white-space: nowrap;';

function genBadge(text: string) {
    return (
        '<span class="ol-song-view__section-index" aria-hidden="true" ' +
        `style="width: 21px; left: 300px;">${text}</span>`
    );
}

describe('addTitleToSectionIndex', () => {
    it('writes the title in front of the badge and keeps the rest', () => {
        const html = `<section>${genBadge('2/7')}<p>When the oceans</p></section>`;
        const result = addTitleToSectionIndex(html, 'Chorus (2/3)');
        expect(result).toContain('>Chorus (2/3) · 2/7</span>');
        expect(result).toContain('<p>When the oceans</p>');
    });

    it('frees the width and left measured for the bare number', () => {
        const result = addTitleToSectionIndex(genBadge('1/7'), 'Verse 1');
        expect(result).toContain(
            `style="width: 21px; left: 300px; ${FREE_WIDTH_STYLE}"`,
        );
    });

    it("puts the slide's own step in place of the part's first one", () => {
        const result = addTitleToSectionIndex(genBadge('2/7'), 'Chorus', 7);
        expect(result).toContain('>Chorus · 7/7</span>');
    });

    it("keeps the badge's number for a slide with no step", () => {
        const result = addTitleToSectionIndex(genBadge('2/7'), 'Chorus', -1);
        expect(result).toContain('>Chorus · 2/7</span>');
    });

    it('adds a style to a badge that had none', () => {
        const html = '<span class="x ol-song-view__section-index">1</span>';
        expect(addTitleToSectionIndex(html, 'V')).toBe(
            '<span class="x ol-song-view__section-index" ' +
                `style="${FREE_WIDTH_STYLE}">V · 1</span>`,
        );
    });

    it('leaves markup with no badge alone', () => {
        const html = '<div class="ol-song-view__info-card">Title</div>';
        expect(addTitleToSectionIndex(html, 'Info')).toBe(html);
    });

    it('escapes a title that carries markup', () => {
        const result = addTitleToSectionIndex(genBadge('1/2'), 'A<b>&');
        expect(result).toContain('>A&lt;b&gt;&amp; · 1/2</span>');
    });

    it('does not touch a class that only starts with the badge name', () => {
        const html = '<span class="ol-song-view__section-index-note">x</span>';
        expect(addTitleToSectionIndex(html, 'V')).toBe(html);
    });
});
