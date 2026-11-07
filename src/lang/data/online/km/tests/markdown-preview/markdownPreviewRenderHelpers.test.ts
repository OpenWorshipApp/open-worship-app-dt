// @vitest-environment jsdom
// A Khmer heading's anchor (`src/markdown-preview/markdownPreviewRenderHelpers.ts`):
// its letters, vowel signs and digits stay, as every script's do.

import { describe, expect, test } from 'vitest';

import { toHeadingSlug } from '../../../../../../markdown-preview/markdownPreviewRenderHelpers';

describe('toHeadingSlug', () => {
    test('keeps letters of every script and drops punctuation', () => {
        expect(toHeadingSlug('សេចក្ដីផ្ដើម ១')).toBe('សេចក្ដីផ្ដើម-១');
    });
});
