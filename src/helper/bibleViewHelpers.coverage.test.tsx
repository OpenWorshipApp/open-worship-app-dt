// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test, vi } from 'vitest';

vi.mock('../server/appProvider', () => ({
    default: { isPageReader: false, systemUtils: { isDev: false } },
}));
vi.mock('./settingHelpers', () => ({
    getSetting: () => null,
    setSetting: () => {},
    removeSetting: () => {},
}));

import {
    BibleViewFontSizeContext,
    DEFAULT_BIBLE_TEXT_FONT_SIZE,
    useBibleViewFontSizeContext,
} from './bibleViewHelpers';

function FontSizeProbeComp() {
    const fontSize = useBibleViewFontSizeContext();
    return <span>{fontSize}</span>;
}

describe('useBibleViewFontSizeContext', () => {
    test('reads the size its previewer provides, the default outside one', () => {
        expect(renderToStaticMarkup(<FontSizeProbeComp />)).toBe(
            `<span>${DEFAULT_BIBLE_TEXT_FONT_SIZE}</span>`,
        );
        expect(
            renderToStaticMarkup(
                <BibleViewFontSizeContext value={48}>
                    <FontSizeProbeComp />
                </BibleViewFontSizeContext>,
            ),
        ).toBe('<span>48</span>');
    });
});
