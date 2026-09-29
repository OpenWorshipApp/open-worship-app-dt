import { beforeEach, describe, expect, it, vi } from 'vitest';

const settings = vi.hoisted(() => new Map<string, string>());
vi.mock('../helper/settingHelpers', () => ({
    getSetting: (key: string) => settings.get(key),
}));
vi.mock('../helper/helpers', () => ({
    parseJsonSafely: (value: string) => {
        try {
            return JSON.parse(value);
        } catch {
            return null;
        }
    },
}));
vi.mock('../resize-actor/flexSizeHelpers', () => ({
    toSettingString: (name: string) => `widget-size-${name}`,
    setFlexSizeSetting: (name: string, value: unknown) => {
        settings.set(`widget-size-${name}`, JSON.stringify(value));
    },
}));

import { migrateLookupLayout } from './lookupLayoutHelpers';

describe('lookup section layout migration', () => {
    beforeEach(() => settings.clear());

    it('keeps a collapsed notes section and existing lookup width', () => {
        const old = { h1: ['1', ['first', 1]], h2: ['5'] };
        settings.set('widget-size-reader', JSON.stringify(old));
        migrateLookupLayout('reader', true, true);
        expect(JSON.parse(settings.get('widget-size-reader')!)).toEqual({
            ...old,
            h3: ['1'],
        });
    });

    it('does not expose a study section that was inside a closed lookup', () => {
        const old = { h1: ['5'], h2: ['4', ['second', 4]] };
        settings.set('widget-size-reader', JSON.stringify(old));
        migrateLookupLayout('reader', true, true);
        expect(JSON.parse(settings.get('widget-size-reader')!)).toEqual({
            ...old,
            h3: ['1', ['second', 0]],
        });
    });

    it('does not let the old toolbar preference override a saved section', () => {
        const saved = { h1: ['1'], h2: ['4'], h3: ['2', ['second', 2]] };
        settings.set('widget-size-reader', JSON.stringify(saved));
        migrateLookupLayout('reader', true, true);
        expect(JSON.parse(settings.get('widget-size-reader')!)).toEqual(saved);
    });

    it('gives the note lookup two sections and leaves the Reader untouched', () => {
        settings.set('widget-size-reader', 'unchanged');
        migrateLookupLayout('note', false, false);
        expect(JSON.parse(settings.get('widget-size-note')!)).toEqual({
            h2: ['3'],
            h3: ['1', ['second', 0]],
        });
        expect(settings.get('widget-size-reader')).toBe('unchanged');
    });

    it('recovers an invalid old layout with the legacy open preference', () => {
        settings.set('widget-size-reader', '{');
        migrateLookupLayout('reader', true, true);
        expect(JSON.parse(settings.get('widget-size-reader')!)).toEqual({
            h1: ['1'],
            h2: ['3'],
            h3: ['1'],
        });
    });
});
