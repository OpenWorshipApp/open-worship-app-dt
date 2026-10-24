// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    names: new Map<
        string,
        { id: string; name: string; kjvName: string; title: string }
    >(),
    locations: new Map<
        string,
        { id: string; name: string; kjvName: string; title: string }
    >(),
    opened: [] as unknown[],
    menus: [] as unknown[],
    titleReads: [] as string[],
}));

vi.mock('../helper/appHooks', async () => {
    const { useEffect, useRef, useState } = await import('react');
    return {
        useAppCurrentRef: <T,>(value: T) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
        useAppEffect: useEffect,
        useAppStateAsync: <T,>(read: () => Promise<T>, deps: unknown[]) => {
            const [value, setValue] = useState<T | undefined>(undefined);
            useEffect(() => {
                let active = true;
                read().then((nextValue) => {
                    if (active) setValue(nextValue);
                });
                return () => {
                    active = false;
                };
                // eslint-disable-next-line react-hooks/exhaustive-deps
            }, deps);
            return [value] as const;
        },
    };
});
vi.mock('../helper/bible-helpers/bibleModelHelpers', () => ({
    BIBLE_KJV_KEY: 'KJV',
}));
vi.mock('../helper/helpers', () => ({
    mapInYieldingBatches: async <T, R>(
        items: T[],
        read: (item: T) => Promise<R>,
    ) => Promise.all(items.map(read)),
}));
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('./bibleVerseHelpers', () => ({
    BIBLE_REFERENCE_KIND_BY_SCHEME: {
        'book-key': 'book',
        'chapter-key': 'chapter',
        'verse-key': 'verse',
    },
    shortToReferenceTitle: async (
        _bibleKey: string,
        kind: string,
        target: string,
    ) => {
        h.titleReads.push(`${kind}:${target}`);
        return `Localized ${target}`;
    },
    shortToVerseTitle: async (_bibleKey: string, target: string) => {
        h.titleReads.push(target);
        return `Verse ${target}`;
    },
}));
vi.mock('../graph-view/graphContextMenuHelpers', () => ({
    showGraphPreviewContextMenu: (_event: unknown, data: unknown) =>
        h.menus.push(data),
}));
vi.mock('./detailPanelHelpers', () => ({
    openDetailPanel: (data: unknown) => h.opened.push(data),
}));
vi.mock('./lookupManagersContext', () => ({
    useLookupManagersContext: () => ({
        namesLookupManager: {
            getRecordById: (id: string) => h.names.get(id) ?? null,
        },
        locationsLookupManager: {
            getRecordById: (id: string) => h.locations.get(id) ?? null,
        },
    }),
}));
vi.mock('./lookupLangHelpers', () => ({ useLookupLangCode: () => 'km' }));
vi.mock('./lookupPresentationHelpers', () => ({
    REFERENCE_TOKEN_SCHEME_LIST: [
        'name-id',
        'location-id',
        'book-key',
        'chapter-key',
        'verse-key',
    ],
    getPlainReferenceText: (text: string) => text.replace(/\[[^\]]+\]/g, ''),
    getRecordKjvName: (record: { kjvName: string }) => record.kjvName,
}));
vi.mock('./lookupRecordHelpers', () => ({
    checkHasDetailValue: (value: string | null) =>
        value !== null && value.trim() !== '',
    getFormattedDetailValue: (value: string) => `Formatted ${value}`,
    getFormattedLinkType: (type: string) => `Link ${type}`,
    resolveLocationReference: (
        manager: { getRecordById: (id: string) => unknown },
        id: string,
    ) => manager.getRecordById(id),
}));

import {
    BasicInfoComp,
    DetailsSectionComp,
    OptionalLinkRowComp,
    OptionalLocationListRowComp,
    OptionalNameListRowComp,
    OptionalTextListRowComp,
    OptionalTextRowComp,
    OptionalVerseListRowComp,
    ReferenceTextComp,
} from './LookupDetailPartsComp';

let host: HTMLDivElement;
let root: Root;

async function render(element: React.ReactNode) {
    await act(async () => {
        root.render(element);
        await Promise.resolve();
    });
}

function press(text: string) {
    const button = Array.from(host.querySelectorAll('button')).find(
        (item) => item.textContent?.trim() === text,
    );
    if (button === undefined) throw new Error(`Missing button: ${text}`);
    act(() => button.click());
}

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    h.names.clear();
    h.locations.clear();
    h.opened.length = 0;
    h.menus.length = 0;
    h.titleReads.length = 0;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
});

afterEach(() => {
    act(() => root.unmount());
    host.remove();
});

describe('lookup detail parts', () => {
    test('turns person, place and verse tokens into detail links', async () => {
        h.names.set('n1', { id: 'n1', name: 'Moses', kjvName: '', title: '' });
        h.locations.set('l1', {
            id: 'l1',
            name: 'Egypt',
            kjvName: '',
            title: '',
        });
        await render(
            <ReferenceTextComp
                bibleKey="KJV"
                value="See [M.](name-id://n1) in [E.](location-id://l1): [Gen](book-key://GEN) [1:1](verse-key://GEN 1:1)."
            />,
        );
        expect(h.titleReads).toEqual([]);
        expect(
            host.querySelectorAll('.location-name-lookup__ref-link'),
        ).toHaveLength(3);
        expect(host.textContent).toContain('Gen');
        press('M.');
        press('E.');
        press('1:1');
        expect(h.opened).toEqual([
            { kind: 'name', target: 'n1', name: 'Moses', langCode: 'km' },
            { kind: 'location', target: 'l1', name: 'Egypt', langCode: 'km' },
            { kind: 'verse', target: 'GEN 1:1', name: '1:1', langCode: 'km' },
        ]);
        act(() =>
            host
                .querySelector('button')!
                .dispatchEvent(
                    new MouseEvent('contextmenu', { bubbles: true }),
                ),
        );
        expect(h.menus[0]).toMatchObject({ kind: 'name', recordId: 'n1' });
    });

    test('localizes Bible tokens when the selected Bible is not KJV', async () => {
        await render(
            <ReferenceTextComp
                bibleKey="KM"
                value="[Gen](book-key://GEN) [one](verse-key://GEN 1:1)"
            />,
        );
        expect(h.titleReads).toEqual(['book:GEN', 'verse:GEN 1:1']);
        expect(host.textContent).toContain('Localized GEN');
        expect(host.textContent).toContain('Localized GEN 1:1');
        press('Localized GEN 1:1');
        expect(h.opened[0]).toMatchObject({
            kind: 'verse',
            target: 'GEN 1:1',
            name: 'Localized GEN 1:1',
        });
    });

    test('folds text, link and basic-detail rows without losing their content', async () => {
        await render(
            <DetailsSectionComp>
                <OptionalTextRowComp label="Type" value="Person" />
                <OptionalTextRowComp label="Empty" value="" />
                <OptionalTextListRowComp
                    label="Facts"
                    values={['One', 'Two']}
                />
                <OptionalLinkRowComp
                    links={[{ type: 'website', url: 'https://example.org' }]}
                />
                <BasicInfoComp
                    bibleKey="KJV"
                    title="Moses"
                    description="A leader"
                    facts={['Prophet']}
                    iconClassName="bi-person"
                />
            </DetailsSectionComp>,
        );
        expect(host.textContent).toContain('Formatted Person');
        expect(host.textContent).not.toContain('Empty');
        expect(host.querySelector('a')?.getAttribute('href')).toBe(
            'https://example.org',
        );
        expect(host.querySelector('a')?.getAttribute('target')).toBe('_blank');
        press('Details');
        expect(host.textContent).not.toContain('A leader');
        press('Details');
        expect(host.textContent).toContain('A leader');
        press('Facts2');
        expect(host.textContent).not.toContain('One');
        press('Facts2');
        expect(host.textContent).toContain('One');
    });

    test('shows resolved names and places while leaving missing ids inert', async () => {
        h.names.set('n1', {
            id: 'n1',
            name: 'Moses',
            kjvName: 'Moses KJV',
            title: 'Leader',
        });
        h.locations.set('l1', {
            id: 'l1',
            name: 'Egypt',
            kjvName: 'Egypt KJV',
            title: 'Country',
        });
        await render(
            <>
                <OptionalNameListRowComp
                    label="People"
                    ids={['n1', 'missing-name']}
                />
                <OptionalLocationListRowComp
                    label="Places"
                    values={['l1', 'missing-place']}
                />
            </>,
        );
        expect(host.textContent).toContain('missing-name');
        expect(host.textContent).toContain('missing-place');
        press('Moses(Moses KJV)');
        press('Egypt(Egypt KJV)');
        expect(h.opened).toEqual([
            { kind: 'name', target: 'n1', name: 'Moses', langCode: 'km' },
            { kind: 'location', target: 'l1', name: 'Egypt', langCode: 'km' },
        ]);
        act(() =>
            host
                .querySelector('.location-name-lookup__ref-link')!
                .dispatchEvent(
                    new MouseEvent('contextmenu', { bubbles: true }),
                ),
        );
        expect(h.menus[0]).toMatchObject({ kind: 'name', recordId: 'n1' });
    });

    test('loads verse titles on expansion and pages the visible list', async () => {
        const values = Array.from(
            { length: 51 },
            (_, index) => `GEN 1:${index + 1}`,
        );
        const resolved = vi.fn();
        await render(
            <OptionalVerseListRowComp
                bibleKey="KM"
                values={values}
                onResolved={resolved}
            />,
        );
        expect(h.titleReads).toEqual([]);
        await act(async () => {
            press('Verses51');
            await Promise.resolve();
        });
        expect(h.titleReads).toHaveLength(51);
        expect(
            host.querySelectorAll('.location-name-lookup__detail-list li'),
        ).toHaveLength(50);
        expect(resolved).toHaveBeenCalledWith(
            values.map((value) => `Verse ${value}`),
        );
        press('Show more (1)');
        expect(
            host.querySelectorAll('.location-name-lookup__detail-list li'),
        ).toHaveLength(51);
        press('Verse GEN 1:51');
        expect(h.opened.at(-1)).toEqual({
            kind: 'verse',
            target: 'GEN 1:51',
            name: 'Verse GEN 1:51',
        });
    });
});
