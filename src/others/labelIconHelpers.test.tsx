// @vitest-environment jsdom

import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test, vi } from 'vitest';

vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => `t:${text}` }));

import {
    genLabelIcon,
    getLabelIconName,
    LABEL_ICON_NAME_MAP,
    toIconedLabel,
    toWidgetLabel,
} from './labelIconHelpers';

describe('labelIconHelpers', () => {
    test('an English label key names its icon, an unknown one names none', () => {
        expect(getLabelIconName('Bible')).toBe('book');
        expect(getLabelIconName('Mini Screen')).toBe('aspect-ratio');
        expect(getLabelIconName('Not A Label')).toBeNull();
        // Keyed by the English key, never the translated text.
        expect(getLabelIconName('t:Bible')).toBeNull();
    });

    test('the icon element carries the bootstrap class and the given spacing', () => {
        expect(renderToStaticMarkup(<>{genLabelIcon('Videos')}</>)).toBe(
            '<i class="bi bi-film px-1"></i>',
        );
        expect(
            renderToStaticMarkup(<>{genLabelIcon('Videos', 'me-2')}</>),
        ).toBe('<i class="bi bi-film me-2"></i>');
        expect(genLabelIcon('Not A Label')).toBeNull();
    });

    test('an iconed label is the icon followed by the translated text', () => {
        expect(renderToStaticMarkup(<>{toIconedLabel('Tools')}</>)).toBe(
            '<i class="bi bi-tools px-1"></i>t:Tools',
        );
        expect(renderToStaticMarkup(<>{toIconedLabel('Plain')}</>)).toBe(
            't:Plain',
        );
    });

    test('a widget label keeps the English key beside the translated name', () => {
        expect(toWidgetLabel('Background')).toEqual({
            widgetName: 't:Background',
            widgetKey: 'Background',
            widgetIconName: 'card-image',
        });
        expect(toWidgetLabel('Something Else')).toEqual({
            widgetName: 't:Something Else',
            widgetKey: 'Something Else',
            widgetIconName: undefined,
        });
    });

    test('every mapped icon is a bare bootstrap name, never markup', () => {
        for (const iconName of Object.values(LABEL_ICON_NAME_MAP)) {
            expect(iconName).toMatch(/^[a-z0-9-]+$/);
        }
    });
});
