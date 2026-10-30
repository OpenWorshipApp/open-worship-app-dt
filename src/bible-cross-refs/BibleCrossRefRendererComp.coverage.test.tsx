// @vitest-environment jsdom

import { act, type ReactNode, type RefObject } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

type HeaderPropsType = {
    bibleItem: FakeBibleItem;
    onBibleKeyChange: (bibleKey: string) => void;
    onTargetChange: (target: object) => void;
};
type WrapperPropsType = {
    title: ReactNode;
    note: ReactNode;
    settingName: string;
    onRefresh: () => void;
    children: ReactNode;
};
type BodyPropsType = {
    ref: RefObject<{ refresh: () => void }>;
    bookKey: string;
    chapter: number;
    verse: number;
    index: number;
};

const h = vi.hoisted(() => ({
    headerProps: null as null | HeaderPropsType,
    isOpenAIAvailable: false,
    isAnthropicAvailable: false,
    openExternalURL: vi.fn(),
    sectionClick: vi.fn(),
    refreshList: [] as string[],
    bodyPropsMap: new Map<string, Record<string, unknown>>(),
}));

function genBodyMock(name: string) {
    return {
        default: ({ ref, ...props }: BodyPropsType) => {
            h.bodyPropsMap.set(name, props);
            ref.current = {
                refresh: () => {
                    h.refreshList.push(name);
                },
            };
            return <div className={`test-body-${name}`} />;
        },
    };
}

vi.mock('../bible-reader/SelectedBibleVerseHeaderComp', () => ({
    default: (props: HeaderPropsType) => {
        h.headerProps = props;
        return null;
    },
}));
vi.mock('./BibleCrossRefWrapperComp', () => ({
    default: (props: WrapperPropsType) => (
        <section
            className="test-wrapper"
            data-setting={props.settingName}
            onClick={h.sectionClick}
        >
            <h5>{props.title}</h5>
            {props.note}
            <button
                type="button"
                className="test-refresh"
                onClick={props.onRefresh}
            />
            {props.children}
        </section>
    ),
}));
vi.mock('./BibleCrossRefAIItemRendererBodyComp', () => genBodyMock('ai'));
vi.mock('./BibleCrossRefOpenAIItemRendererBodyComp', () =>
    genBodyMock('openai'),
);
vi.mock('./BibleCrossRefAnthropicItemRendererBodyComp', () =>
    genBodyMock('anthropic'),
);
vi.mock('../helper/ai/openAIAvailabilityHelpers', () => ({
    useAvailable: () => h.isOpenAIAvailable,
}));
vi.mock('../helper/ai/anthropicAvailabilityHelpers', () => ({
    useAvailable: () => h.isAnthropicAvailable,
}));
vi.mock('../helper/ai/bibleCrossRefHelpers', async () => {
    const { createContext } = await import('react');
    return {
        BibleKeyContext: createContext('KJV'),
        defaultRefreshingRef: { refresh: () => {} },
    };
});
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../server/appProvider', () => ({
    default: {
        appInfo: { homepage: 'https://openworship.app' },
        browserUtils: { openExternalURL: h.openExternalURL },
    },
}));

import BibleCrossRefRendererComp from './BibleCrossRefRendererComp';

class FakeBibleItem {
    constructor(
        public bibleKey: string,
        public target: Record<string, unknown>,
    ) {}
    clone() {
        return new FakeBibleItem(this.bibleKey, { ...this.target });
    }
}

const TARGET = { bookKey: 'JHN', chapter: 3, verseStart: 16, verseEnd: 18 };

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.headerProps = null;
    h.isOpenAIAvailable = false;
    h.isAnthropicAvailable = false;
    h.refreshList = [];
    h.bodyPropsMap.clear();
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    host.remove();
    vi.unstubAllGlobals();
});

async function render(bibleItem = new FakeBibleItem('KJV', { ...TARGET })) {
    const setBibleItem = vi.fn();
    await act(async () => {
        root.render(
            <BibleCrossRefRendererComp
                bibleItem={bibleItem as any}
                setBibleItem={setBibleItem}
            />,
        );
    });
    return { bibleItem, setBibleItem };
}

function getSections() {
    return Array.from(host.querySelectorAll<HTMLElement>('.test-wrapper'));
}

describe('the verse header', () => {
    test('another bible is a copy of the passage in that bible', async () => {
        const { bibleItem, setBibleItem } = await render();
        h.headerProps!.onBibleKeyChange('KHM');
        const [newBibleItem] = setBibleItem.mock.calls[0];
        expect(newBibleItem).not.toBe(bibleItem);
        expect(newBibleItem.bibleKey).toBe('KHM');
        expect(newBibleItem.target).toEqual(TARGET);
        expect(bibleItem.bibleKey).toBe('KJV');
    });

    test('another verse is the header copy pointed at it', async () => {
        const { bibleItem, setBibleItem } = await render();
        const newTarget = {
            bookKey: 'JHN',
            chapter: 3,
            verseStart: 17,
            verseEnd: 17,
        };
        h.headerProps!.onTargetChange(newTarget);
        const [newBibleItem] = setBibleItem.mock.calls[0];
        expect(newBibleItem).toBe(h.headerProps!.bibleItem);
        expect(newBibleItem.target).toEqual(newTarget);
        expect(bibleItem.target).toEqual(TARGET);
    });
});

describe('the sources', () => {
    test('only the bundled source shows without an AI key', async () => {
        await render();
        const sections = getSections();
        expect(sections).toHaveLength(1);
        expect(sections[0].querySelector('h5')!.textContent).toBe(
            'AI Cross References',
        );
        expect(sections[0].dataset.setting).toBe('show-standard-bible-ref');
        expect(h.bodyPropsMap.get('ai')).toEqual({
            aiType: 'anthropic',
            bibleKey: 'KJV',
            bookKey: 'JHN',
            chapter: 3,
            verse: 16,
            index: 0,
        });
    });

    test("a user's own OpenAI and Anthropic keys add their sections", async () => {
        h.isOpenAIAvailable = true;
        h.isAnthropicAvailable = true;
        await render();
        expect(
            getSections().map((section) => {
                return [
                    section.querySelector('h5')!.textContent,
                    section.dataset.setting,
                ];
            }),
        ).toEqual([
            ['AI Cross References', 'show-standard-bible-ref'],
            ['Custom OpenAI', 'show-ai-bible-ref'],
            ['Custom Anthropic', 'show-ai-bible-ref'],
        ]);
        for (const name of ['openai', 'anthropic']) {
            expect(h.bodyPropsMap.get(name)).toEqual({
                bookKey: 'JHN',
                chapter: 3,
                verse: 16,
                index: 0,
            });
        }
    });

    test('each refresh reaches its own source only', async () => {
        h.isOpenAIAvailable = true;
        h.isAnthropicAvailable = true;
        await render();
        const buttons =
            host.querySelectorAll<HTMLButtonElement>('.test-refresh');
        for (const button of [buttons[2], buttons[0], buttons[1]]) {
            await act(async () => {
                button.click();
            });
        }
        expect(h.refreshList).toEqual(['anthropic', 'ai', 'openai']);
    });

    test('the AI caution opens the page about it, and nothing else', async () => {
        await render();
        const section = getSections()[0];
        const note = section.querySelector<HTMLButtonElement>(
            'button.app-xref-note',
        )!;
        expect(note.getAttribute('aria-label')).toBe(
            'Generated using AI technology. Results may vary and may not ' +
                'be accurate. Please use with caution.',
        );
        await act(async () => {
            note.click();
        });
        expect(h.openExternalURL).toHaveBeenCalledWith(
            'https://openworship.app/ai-vigilant',
        );
        // The section around it never hears the press.
        expect(h.sectionClick).not.toHaveBeenCalled();
    });
});
