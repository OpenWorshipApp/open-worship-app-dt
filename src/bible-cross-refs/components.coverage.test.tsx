// @vitest-environment jsdom

/**
 * The Cross Reference panel's components, driven through their DOM: the
 * renderer with its collapsible sources, the three AI bodies (bundled, the
 * user's OpenAI and Anthropic keys), the theme list, one theme, one AI row,
 * and the two older found-item rows. The cross-reference data hooks, the row
 * menu and everything that leaves the panel are this file's own mocks.
 */

import type { ReactNode } from 'react';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const realSetImmediate = globalThis.setImmediate.bind(globalThis);

const h = vi.hoisted(() => ({
    settings: {} as Record<string, boolean>,
    viewController: { isFakeViewController: true } as any,
    isOpenAIAvailable: false,
    isAnthropicAvailable: false,
    lastHeaderProps: null as any,
    aiData: {
        bundled: undefined as any,
        openAI: undefined as any,
        anthropic: undefined as any,
    },
    refresh: {
        bundled: (() => {}) as () => void,
        openAI: (() => {}) as () => void,
        anthropic: (() => {}) as () => void,
    },
    openExternalURL: vi.fn(),
    showAppContextMenu: vi.fn(),
    openContextMenu: vi.fn(),
    openInBibleLookup: vi.fn(),
    openFoundBibleItem: vi.fn(),
    handleDragStart: vi.fn(),
    breakItem: vi.fn(),
    useGettingBibleCrossRefAI: vi.fn(),
    useGetBibleCrossRefOpenAI: vi.fn(),
    useGetBibleCrossRefAnthropic: vi.fn(),
    handleError: vi.fn(),
}));

vi.mock('../server/appProvider', () => ({
    default: {
        systemUtils: { isDev: false },
        envUtils: { isFEUseEffectWarning: false },
        appInfo: { homepage: 'https://owa.test' },
        browserUtils: { openExternalURL: h.openExternalURL },
    },
}));
vi.mock('../helper/errorHelpers', () => ({ handleError: h.handleError }));
vi.mock('../helper/loggerHelpers', () => ({
    appError: () => {},
    appWarning: () => {},
    appLog: () => {},
}));
vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('./bibleCrossRefsHelpers', () => ({
    breakItem: h.breakItem,
    useGettingBibleCrossRefAI: h.useGettingBibleCrossRefAI,
}));
vi.mock('../helper/ai/openAIBibleCrossRefHelpers', () => ({
    useGetBibleCrossRefOpenAI: h.useGetBibleCrossRefOpenAI,
}));
vi.mock('../helper/ai/anthropicBibleCrossRefHelpers', () => ({
    useGetBibleCrossRefAnthropic: h.useGetBibleCrossRefAnthropic,
}));
vi.mock('../helper/ai/openAIAvailabilityHelpers', () => ({
    useAvailable: () => h.isOpenAIAvailable,
}));
vi.mock('../helper/ai/anthropicAvailabilityHelpers', () => ({
    useAvailable: () => h.isAnthropicAvailable,
}));
// The real module pulls in the JSON schema validator and the data folder; the
// three things these components use are copied here as they are.
vi.mock('../helper/ai/bibleCrossRefHelpers', async () => {
    const { createContext, use, useEffect } = await import('react');
    const defaultRefreshingRef = { refresh: () => {} };
    const BibleKeyContext = createContext<string>('KJV');
    return {
        defaultRefreshingRef,
        BibleKeyContext,
        useBibleKeyContext: () => use(BibleKeyContext),
        useGenRefreshRef: (ref: any, refresh: () => void) => {
            useEffect(() => {
                ref.current = { refresh };
                return () => {
                    ref.current = defaultRefreshingRef;
                };
            }, [refresh]);
        },
    };
});
vi.mock('../bible-reader/SelectedBibleVerseHeaderComp', () => ({
    default: (props: any) => {
        h.lastHeaderProps = props;
        const { bookKey, chapter, verseStart, verseEnd } =
            props.bibleItem.target;
        return (
            <div className="ut-verse-header">
                {`${props.bibleItem.bibleKey} ${bookKey} ` +
                    `${chapter}:${verseStart}-${verseEnd}`}
            </div>
        );
    },
}));
vi.mock('../bible-find/bibleFindHelpers', () => ({
    openContextMenu: h.openContextMenu,
    openInBibleLookup: h.openInBibleLookup,
    openFoundBibleItem: h.openFoundBibleItem,
}));
vi.mock('../helper/dragHelpers', () => ({
    handleDragStart: h.handleDragStart,
}));
vi.mock('../bible-reader/LookupBibleItemController', () => ({
    useLookupBibleItemControllerContext: () => h.viewController,
}));
vi.mock('../bible-reader/view-extra/BibleDirectViewTitleComp', () => ({
    BibleDirectViewTitleComp: ({ bibleItem }: any) => {
        return <span className="ut-title">{bibleItem.title}</span>;
    },
}));
vi.mock('../helper/bible-helpers/bibleStyleHelpers', () => ({
    useBibleFontFamily: (bibleKey: string) => `${bibleKey}-font`,
}));
vi.mock('../helper/settingHelpers', async () => {
    const { useState } = await import('react');
    return {
        useStateSettingBoolean: (name: string, defaultValue: boolean) => {
            const [value, setValue] = useState(
                h.settings[name] ?? defaultValue,
            );
            return [
                value,
                (newValue: boolean) => {
                    h.settings[name] = newValue;
                    setValue(newValue);
                },
            ];
        },
    };
});
vi.mock('../context-menu/appContextMenuHelpers', () => ({
    showAppContextMenu: h.showAppContextMenu,
}));
vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: (name: string) => `icon:${name}`,
}));
vi.mock('../others/LoadingComp', () => ({
    default: () => <div className="ut-loading">loading</div>,
}));

import { BibleKeyContext } from '../helper/ai/bibleCrossRefHelpers';
import BibleCrossRefRendererComp from './BibleCrossRefRendererComp';
import BibleCrossRefWrapperComp from './BibleCrossRefWrapperComp';
import BibleCrossRefAIItemRendererBodyComp from './BibleCrossRefAIItemRendererBodyComp';
import BibleCrossRefOpenAIItemRendererBodyComp from './BibleCrossRefOpenAIItemRendererBodyComp';
import BibleCrossRefAnthropicItemRendererBodyComp from './BibleCrossRefAnthropicItemRendererBodyComp';
import RenderAIBibleCrossReferenceListComp from './RenderAIBibleCrossReferenceListComp';
import RenderAIBibleCrossReferenceComp from './RenderAIBibleCrossReferenceComp';
import BibleCrossRefAIRenderFoundItemComp from './BibleCrossRefAIRenderFoundItemComp';
import BibleCrossRefRenderFoundItemComp from './BibleCrossRefRenderFoundItemComp';
import BibleCrossRefRenderFoundItemsComp from './BibleCrossRefRenderFoundItemsComp';

let root: Root | null = null;
let container: HTMLDivElement | null = null;

async function flush(times = 4) {
    for (let i = 0; i < times; i++) {
        await act(async () => {
            await new Promise((resolve) => {
                realSetImmediate(resolve);
            });
        });
    }
}

async function render(node: ReactNode) {
    if (root === null) {
        container = document.createElement('div');
        document.body.append(container);
        root = createRoot(container);
    }
    await act(async () => {
        root!.render(node);
    });
    await flush();
}

async function unmount() {
    if (root !== null) {
        const oldRoot = root;
        root = null;
        await act(async () => {
            oldRoot.unmount();
        });
    }
}

async function press(element: Element | null | undefined) {
    expect(element).toBeTruthy();
    await act(async () => {
        (element as HTMLElement).click();
    });
    await flush();
}

async function rightClick(element: Element | null | undefined) {
    expect(element).toBeTruthy();
    await act(async () => {
        element!.dispatchEvent(
            new MouseEvent('contextmenu', { bubbles: true, cancelable: true }),
        );
    });
}

function query(selector: string) {
    return container!.querySelector(selector);
}

function queryAll(selector: string) {
    return [...container!.querySelectorAll(selector)];
}

function lastMenuItems() {
    const { calls } = h.showAppContextMenu.mock;
    return calls[calls.length - 1][1] as any[];
}

function genFoundData(key: string) {
    return {
        htmlText: `<b>${key}</b> text`,
        bibleText: `${key} full text`,
        bibleItem: { bibleKey: 'KJV', title: key },
    };
}

function genBibleItem(
    bibleKey = 'KJV',
    target: any = { bookKey: 'JHN', chapter: 3, verseStart: 16, verseEnd: 18 },
) {
    return {
        bibleKey,
        target,
        clone(): any {
            return genBibleItem(this.bibleKey, { ...this.target });
        },
    };
}

const love = {
    title: 'Love',
    titleEn: 'Love',
    verses: ['JHN 15:13', '1JN 4:8'],
};
const life = { title: 'Life', verses: ['ROM 6:23'] };

beforeEach(() => {
    h.settings = {};
    h.isOpenAIAvailable = false;
    h.isAnthropicAvailable = false;
    h.lastHeaderProps = null;
    h.aiData = { bundled: undefined, openAI: undefined, anthropic: undefined };
    h.refresh = { bundled: vi.fn(), openAI: vi.fn(), anthropic: vi.fn() };
    h.useGettingBibleCrossRefAI.mockImplementation(() => {
        return { bibleCrossRef: h.aiData.bundled, refresh: h.refresh.bundled };
    });
    h.useGetBibleCrossRefOpenAI.mockImplementation(() => {
        return { bibleCrossRef: h.aiData.openAI, refresh: h.refresh.openAI };
    });
    h.useGetBibleCrossRefAnthropic.mockImplementation(() => {
        return {
            bibleCrossRef: h.aiData.anthropic,
            refresh: h.refresh.anthropic,
        };
    });
    h.breakItem.mockImplementation(async (_bibleKey: string, key: string) => {
        return genFoundData(key);
    });
});

afterEach(async () => {
    await unmount();
    container?.remove();
    container = null;
});

describe('BibleCrossRefRendererComp', () => {
    it('heads the first verse alone and lists the bundled themes under a source card', async () => {
        h.aiData.bundled = [love, life];
        const setBibleItem = vi.fn();
        await render(
            <BibleCrossRefRendererComp
                bibleItem={genBibleItem() as any}
                setBibleItem={setBibleItem}
            />,
        );
        expect(query('.ut-verse-header')?.textContent).toBe('KJV JHN 3:16-16');
        expect(h.useGettingBibleCrossRefAI).toHaveBeenCalledWith(
            'anthropic',
            'KJV',
            'JHN',
            3,
            16,
        );
        expect(h.useGetBibleCrossRefOpenAI).not.toHaveBeenCalled();
        expect(h.useGetBibleCrossRefAnthropic).not.toHaveBeenCalled();
        expect(
            queryAll('.app-xref-card-title').map((e) => e.textContent),
        ).toEqual(['AI Cross References']);
        const key = query('.app-xref-card-key') as HTMLElement;
        expect(key.textContent).toBe('KJV');
        expect(key.style.fontFamily).toBe('KJV-font');
        expect(query('.app-xref-meta')?.textContent).toBe(
            '2 Themes · 3 Verses',
        );
        expect(
            queryAll('.app-xref-theme-title').map((e) => e.textContent),
        ).toEqual(['Love', 'Life']);
        // Neither heading was translated, so neither carries the caution.
        expect(query('.bi-translate')).toBeNull();
        expect(
            queryAll('.app-xref-item .ut-title').map((e) => e.textContent),
        ).toEqual(['JHN 15:13', '1JN 4:8', 'ROM 6:23']);
        expect(h.breakItem).toHaveBeenCalledWith('KJV', 'ROM 6:23');
    });

    it('opens the AI caution page from its note', async () => {
        h.aiData.bundled = [];
        await render(
            <BibleCrossRefRendererComp
                bibleItem={genBibleItem() as any}
                setBibleItem={vi.fn()}
            />,
        );
        const note = query('.app-xref-note.bi-cpu') as HTMLElement;
        expect(note.getAttribute('aria-label')).toBe(
            'Generated using AI technology. Results may vary and may not ' +
                'be accurate. Please use with caution.',
        );
        const outside = vi.fn();
        document.body.addEventListener('click', outside);
        await press(note);
        document.body.removeEventListener('click', outside);
        expect(h.openExternalURL).toHaveBeenCalledWith(
            'https://owa.test/ai-vigilant',
        );
        expect(outside).not.toHaveBeenCalled();
        expect(query('.app-xref-status')?.textContent).toBe(
            'No cross references for this verse',
        );
    });

    it('swaps the bible or the verse through the header', async () => {
        h.aiData.bundled = [];
        const setBibleItem = vi.fn();
        await render(
            <BibleCrossRefRendererComp
                bibleItem={genBibleItem() as any}
                setBibleItem={setBibleItem}
            />,
        );
        h.lastHeaderProps.onBibleKeyChange('NIV');
        expect(setBibleItem).toHaveBeenCalledTimes(1);
        expect(setBibleItem.mock.calls[0][0]).toMatchObject({
            bibleKey: 'NIV',
            target: {
                bookKey: 'JHN',
                chapter: 3,
                verseStart: 16,
                verseEnd: 18,
            },
        });
        const newTarget = {
            bookKey: 'JHN',
            chapter: 4,
            verseStart: 1,
            verseEnd: 2,
        };
        h.lastHeaderProps.onTargetChange(newTarget);
        expect(setBibleItem).toHaveBeenCalledTimes(2);
        expect(setBibleItem.mock.calls[1][0]).toMatchObject({
            bibleKey: 'KJV',
            target: newTarget,
        });
    });

    it("draws the user's own OpenAI and Anthropic sources and refreshes each one", async () => {
        h.isOpenAIAvailable = true;
        h.isAnthropicAvailable = true;
        h.aiData.bundled = [life];
        h.aiData.openAI = undefined;
        h.aiData.anthropic = null;
        await render(
            <BibleCrossRefRendererComp
                bibleItem={genBibleItem() as any}
                setBibleItem={vi.fn()}
            />,
        );
        expect(
            queryAll('.app-xref-card-title').map((e) => e.textContent),
        ).toEqual(['AI Cross References', 'Custom OpenAI', 'Custom Anthropic']);
        expect(h.useGetBibleCrossRefOpenAI).toHaveBeenCalledWith('JHN', 3, 16);
        expect(h.useGetBibleCrossRefAnthropic).toHaveBeenCalledWith(
            'JHN',
            3,
            16,
        );
        const bodies = queryAll('.app-xref-card-body');
        expect(bodies[1].querySelector('.ut-loading')).not.toBeNull();
        expect(bodies[2].textContent).toBe('Data not available for "JHN 3:16"');

        const headers = queryAll('.app-xref-card-header');
        const refreshes = [
            h.refresh.bundled,
            h.refresh.openAI,
            h.refresh.anthropic,
        ];
        for (const [i, header] of headers.entries()) {
            await rightClick(header);
            const items = lastMenuItems();
            expect(items).toHaveLength(1);
            expect(items[0].menuElement).toBe('Refresh');
            items[0].onSelect();
            expect(refreshes[i]).toHaveBeenCalledTimes(1);
        }
    });
});

describe('BibleCrossRefWrapperComp', () => {
    it('folds its body away, remembers that, and offers no refresh while folded', async () => {
        const onRefresh = vi.fn();
        await render(
            <BibleKeyContext value="NIV">
                <BibleCrossRefWrapperComp
                    title="Source"
                    note={<span className="ut-note">note</span>}
                    settingName="show-source"
                    onRefresh={onRefresh}
                >
                    <div className="ut-body">body</div>
                </BibleCrossRefWrapperComp>
            </BibleKeyContext>,
        );
        const toggle = query('.app-xref-card-toggle') as HTMLElement;
        expect(toggle.getAttribute('aria-expanded')).toBe('true');
        expect(query('.app-xref-card-chevron')?.className).toBe(
            'app-xref-card-chevron bi bi-chevron-down',
        );
        expect(query('.app-xref-card-key')?.textContent).toBe('NIV');
        expect(query('.ut-note')).not.toBeNull();
        expect(query('.ut-body')).not.toBeNull();

        await press(query('.app-context-menu-dots'));
        expect(h.showAppContextMenu).toHaveBeenCalledTimes(1);
        lastMenuItems()[0].onSelect();
        expect(onRefresh).toHaveBeenCalledTimes(1);

        await press(toggle);
        expect(toggle.getAttribute('aria-expanded')).toBe('false');
        expect(query('.app-xref-card-chevron')?.className).toBe(
            'app-xref-card-chevron bi bi-chevron-right',
        );
        expect(query('.ut-body')).toBeNull();
        expect(h.settings['show-source']).toBe(false);
        await press(query('.app-context-menu-dots'));
        await rightClick(query('.app-xref-card-header'));
        expect(h.showAppContextMenu).toHaveBeenCalledTimes(1);

        await press(toggle);
        expect(query('.ut-body')).not.toBeNull();
        expect(h.settings['show-source']).toBe(true);
    });

    it('opens folded when that is what was remembered', async () => {
        h.settings['show-source'] = false;
        await render(
            <BibleCrossRefWrapperComp
                title="Source"
                settingName="show-source"
                onRefresh={vi.fn()}
            >
                <div className="ut-body">body</div>
            </BibleCrossRefWrapperComp>,
        );
        expect(query('.ut-body')).toBeNull();
        expect(query('.app-xref-card-key')?.textContent).toBe('KJV');
    });
});

describe('the three AI cross reference bodies', () => {
    const cases = [
        {
            name: 'bundled',
            dataKey: 'bundled' as const,
            renderBody: (ref: any) => (
                <BibleCrossRefAIItemRendererBodyComp
                    ref={ref}
                    aiType="anthropic"
                    bibleKey="KJV"
                    bookKey="GEN"
                    chapter={1}
                    verse={1}
                    index={1}
                />
            ),
        },
        {
            name: 'OpenAI',
            dataKey: 'openAI' as const,
            renderBody: (ref: any) => (
                <BibleCrossRefOpenAIItemRendererBodyComp
                    ref={ref}
                    bookKey="GEN"
                    chapter={1}
                    verse={1}
                    index={1}
                />
            ),
        },
        {
            name: 'Anthropic',
            dataKey: 'anthropic' as const,
            renderBody: (ref: any) => (
                <BibleCrossRefAnthropicItemRendererBodyComp
                    ref={ref}
                    bookKey="GEN"
                    chapter={1}
                    verse={1}
                    index={1}
                />
            ),
        },
    ];

    for (const { name, dataKey, renderBody } of cases) {
        it(`${name}: loading, unavailable, then its themes, with its refresh on the ref`, async () => {
            const defaultRefresh = () => {};
            const ref = { current: { refresh: defaultRefresh } };
            await render(renderBody(ref));
            expect(query('.ut-loading')).not.toBeNull();
            expect(ref.current.refresh).toBe(h.refresh[dataKey]);

            h.aiData[dataKey] = null;
            await render(renderBody(ref));
            expect(container!.textContent).toBe(
                'Data not available for "GEN 1:1"',
            );

            h.aiData[dataKey] = [life];
            await render(renderBody(ref));
            // Not the first verse, so the list says it continues.
            expect(
                query('.app-xref-continued .app-xref-meta')?.textContent,
            ).toBe('1 Themes · 1 Verses');

            await unmount();
            expect(ref.current.refresh).not.toBe(h.refresh[dataKey]);
        });
    }
});

describe('RenderAIBibleCrossReferenceListComp', () => {
    it('says so when a verse has no cross references, continued or not', async () => {
        await render(
            <RenderAIBibleCrossReferenceListComp
                index={0}
                bibleCrossRef={[]}
            />,
        );
        const status = query('.app-xref-status') as HTMLElement;
        expect(status.textContent).toBe('No cross references for this verse');
        expect(status.parentElement?.className).toBe('');
        await render(
            <RenderAIBibleCrossReferenceListComp
                index={2}
                bibleCrossRef={[]}
            />,
        );
        expect(query('.app-xref-status')?.parentElement?.className).toBe(
            'app-xref-continued',
        );
    });
});

describe('RenderAIBibleCrossReferenceComp', () => {
    it('opens the translation caution page without pressing the theme', async () => {
        await render(
            <BibleKeyContext value="XXB">
                <RenderAIBibleCrossReferenceComp
                    crossReference={{
                        title: '♡ ✝',
                        titleEn: 'Love',
                        verses: ['JHN 15:13'],
                    }}
                />
            </BibleKeyContext>,
        );
        const heading = query('.app-xref-theme-title') as HTMLElement;
        expect(heading.style.fontFamily).toBe('XXB-font');
        const note = query('.app-xref-note.bi-translate') as HTMLElement;
        expect(note.getAttribute('title')).toBe(
            'Generated using Google Translate. Results may vary and may ' +
                'not be accurate. Please use with caution.\nLove',
        );
        const outside = vi.fn();
        document.body.addEventListener('click', outside);
        await press(note);
        document.body.removeEventListener('click', outside);
        expect(h.openExternalURL).toHaveBeenCalledWith(
            'https://owa.test/google-translate-vigilant',
        );
        expect(outside).not.toHaveBeenCalled();
        expect(h.breakItem).toHaveBeenCalledWith('XXB', 'JHN 15:13');
    });
});

describe('BibleCrossRefAIRenderFoundItemComp', () => {
    async function renderRow() {
        await render(
            <BibleCrossRefAIRenderFoundItemComp bibleVersesKey="GEN 1:1" />,
        );
        return query('.app-xref-item') as HTMLElement;
    }

    it('says Loading until the reference is read', async () => {
        let release: (value: unknown) => void = () => {};
        h.breakItem.mockReturnValueOnce(
            new Promise((resolve) => {
                release = resolve;
            }),
        );
        await renderRow();
        expect(query('.app-xref-status')?.textContent).toBe('Loading...');
        release(genFoundData('GEN 1:1'));
        await flush();
        expect(query('.app-xref-item .ut-title')?.textContent).toBe('GEN 1:1');
        const text = query('.app-xref-text') as HTMLElement;
        expect(text.getAttribute('title')).toBe('GEN 1:1 full text');
        expect(text.style.fontFamily).toBe('KJV-font');
        expect(text.innerHTML).toBe('<b>GEN 1:1</b> text');
    });

    it('opens the verse on Enter or Space and ignores any other key', async () => {
        const row = await renderRow();
        const keyDown = async (key: string) => {
            const event = new KeyboardEvent('keydown', {
                key,
                bubbles: true,
                cancelable: true,
            });
            await act(async () => {
                row.dispatchEvent(event);
            });
            return event.defaultPrevented;
        };
        expect(await keyDown('a')).toBe(false);
        expect(h.openFoundBibleItem).not.toHaveBeenCalled();
        expect(await keyDown('Enter')).toBe(true);
        expect(await keyDown(' ')).toBe(true);
        expect(h.openFoundBibleItem).toHaveBeenCalledTimes(2);
        expect(h.openFoundBibleItem).toHaveBeenCalledWith(
            genFoundData('GEN 1:1').bibleItem,
        );
    });

    it('drags the verse and opens its menu from a right-click', async () => {
        const row = await renderRow();
        await act(async () => {
            row.dispatchEvent(new Event('dragstart', { bubbles: true }));
        });
        expect(h.handleDragStart).toHaveBeenCalledTimes(1);
        expect(h.handleDragStart.mock.calls[0][1]).toEqual(
            genFoundData('GEN 1:1').bibleItem,
        );
        await rightClick(row);
        expect(h.openContextMenu).toHaveBeenCalledTimes(1);
        expect(h.openContextMenu.mock.calls[0][1]).toEqual({
            viewController: h.viewController,
            bibleItem: genFoundData('GEN 1:1').bibleItem,
        });
    });
});

describe('the older found-item rows', () => {
    const rows = [
        {
            name: 'BibleCrossRefRenderFoundItemComp',
            Comp: BibleCrossRefRenderFoundItemComp,
        },
        {
            name: 'BibleCrossRefRenderFoundItemsComp',
            Comp: BibleCrossRefRenderFoundItemsComp,
        },
    ];
    const itemInfo = {
        text: 'GEN 1:1',
        isS: true,
        isFN: false,
        isStar: true,
        isTitle: false,
        isLXXDSS: true,
    };

    for (const { name, Comp } of rows) {
        it(`${name}: loading, then a row with its markers that opens, drags and has a menu`, async () => {
            let release: (value: unknown) => void = () => {};
            h.breakItem.mockReturnValueOnce(
                new Promise((resolve) => {
                    release = resolve;
                }),
            );
            await render(
                <BibleKeyContext value="NIV">
                    <Comp bibleVersesKey="GEN 1:1" itemInfo={itemInfo} />
                </BibleKeyContext>,
            );
            expect(container!.textContent).toBe('Loading...');
            expect(h.breakItem).toHaveBeenCalledWith('NIV', 'GEN 1:1');
            release(genFoundData('GEN 1:1'));
            await flush();
            const row = query('.app-border-white-round') as HTMLElement;
            expect(row.getAttribute('title')).toBe('shift + click to append');
            expect(queryAll('.badge').map((e) => e.textContent)).toEqual([
                'S ',
                '',
                '★ ',
                '',
                'LXXDSS ',
            ]);
            const text = row.querySelector('span[title]') as HTMLElement;
            expect(text.getAttribute('title')).toBe('GEN 1:1 full text');
            expect(text.style.fontFamily).toBe('NIV-font');
            expect(text.innerHTML).toBe('<b>GEN 1:1</b> text');

            await press(row);
            expect(h.openInBibleLookup).toHaveBeenCalledTimes(1);
            const [, viewController, bibleItem, isForceNew] =
                h.openInBibleLookup.mock.calls[0];
            expect(viewController).toBe(h.viewController);
            expect(bibleItem).toEqual(genFoundData('GEN 1:1').bibleItem);
            expect(isForceNew).toBe(true);

            await rightClick(row);
            await press(row.querySelector('.app-context-menu-dots'));
            expect(h.openContextMenu).toHaveBeenCalledTimes(2);
            expect(h.openContextMenu.mock.calls[1][1]).toEqual({
                viewController: h.viewController,
                bibleItem: genFoundData('GEN 1:1').bibleItem,
            });
            // The dots keep their press from also opening the verse.
            expect(h.openInBibleLookup).toHaveBeenCalledTimes(1);

            await act(async () => {
                row.dispatchEvent(new Event('dragstart', { bubbles: true }));
            });
            expect(h.handleDragStart.mock.calls[0][1]).toEqual(
                genFoundData('GEN 1:1').bibleItem,
            );
        });

        it(`${name}: no row for a reference that names no passage`, async () => {
            h.breakItem.mockResolvedValueOnce(null);
            await render(
                <Comp bibleVersesKey="PSA 119:x" itemInfo={itemInfo} />,
            );
            expect(container!.innerHTML).toBe('');
        });
    }

    it('BibleCrossRefRenderFoundItemsComp sanitizes the verse it renders', async () => {
        h.breakItem.mockResolvedValueOnce({
            ...genFoundData('GEN 1:1'),
            htmlText: 'In the <img src="x" onerror="alert(1)">beginning',
        });
        await render(
            <BibleCrossRefRenderFoundItemsComp
                bibleVersesKey="GEN 1:1"
                itemInfo={itemInfo}
            />,
        );
        const text = query('span[title]') as HTMLElement;
        expect(text.innerHTML).toBe('In the <img src="x">beginning');
    });
});
