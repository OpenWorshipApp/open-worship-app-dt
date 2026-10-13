// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { openChatbotAsking, openBibleSetting } = vi.hoisted(() => ({
    openChatbotAsking: vi.fn(async (_text: string) => true),
    openBibleSetting: vi.fn(),
}));

vi.mock('../lang/langHelpers', () => ({
    tran: (text: string) => `translated:${text}`,
}));
vi.mock('./RenderChapterOptionsComp', () => ({ default: () => null }));
vi.mock('./RenderVerseOptionsComp', () => ({ default: () => null }));
vi.mock('./RenderBookOptionsComp', () => ({ default: () => null }));
vi.mock('./BibleKeySelectionComp', () => ({
    BibleKeySelectionMiniComp: ({ bibleKey }: { bibleKey: string }) => (
        <span className="bible-selector">{bibleKey}</span>
    ),
}));
vi.mock('./selectionHelpers', () => ({ RENDER_FOUND_CLASS: 'found' }));
vi.mock('../bible-reader/LookupBibleItemController', () => ({
    useEditingResult: () => null,
    useLookupBibleItemControllerContext: () => ({
        selectedBibleItem: {},
        applyTargetOrBibleKey: vi.fn(),
    }),
}));
vi.mock('../setting/settingHelpers', () => ({ openBibleSetting }));
vi.mock('../helper/appHooks', async () => {
    const { useRef } = await import('react');
    return {
        useAppCurrentRef: <T,>(value: T) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('../helper/bible-helpers/bibleStyleHelpers', () => ({
    useBibleFontFamily: () => undefined,
}));
vi.mock('../helper/ai/chatbotHandoffHelpers', () => ({ openChatbotAsking }));

import { BibleNotAvailableComp } from './RenderLookupSuggestionComp';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    openChatbotAsking.mockClear();
    openBibleSetting.mockClear();
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    host.remove();
});

async function renderCard(bibleKey: string) {
    await act(async () => {
        root.render(<BibleNotAvailableComp bibleKey={bibleKey} />);
    });
}

function findButton(words: string) {
    return Array.from(host.querySelectorAll('button')).find((button) => {
        return button.textContent?.includes(words);
    }) as HTMLButtonElement;
}

describe('BibleNotAvailableComp', () => {
    test('says how the assistant imports the missing Bible, in steps', async () => {
        await renderCard('KJV');

        expect(host.querySelector('h2')?.textContent).toContain('"KJV"');
        expect(host.textContent).toContain(
            'translated:Or let the assistant import this Bible for you:',
        );
        // Three steps, each through `tran`: a hardcoded one would read
        // English in a Khmer window.
        const stepList = Array.from(host.querySelectorAll('ol > li'));
        expect(stepList).toHaveLength(3);
        for (const step of stepList) {
            expect(step.textContent).toMatch(/^translated:/);
        }
    });

    test('the assistant button asks for the Bible the card is waiting for', async () => {
        await renderCard('KJV');
        const button = findButton(
            'translated:Let the assistant import this Bible for me',
        );
        // Its name and nothing more, or a press by label is refused: the
        // heading above is what says which Bible.
        expect(button.textContent).toBe(
            'translated:Let the assistant import this Bible for me',
        );

        await act(async () => button.click());

        expect(openChatbotAsking).toHaveBeenCalledTimes(1);
        expect(openChatbotAsking).toHaveBeenCalledWith(
            'Import the Bible called "KJV"',
        );
        // The Settings form is still there, and is not what was pressed.
        expect(openBibleSetting).not.toHaveBeenCalled();
        await act(async () => {
            findButton('translated:Go to Bible Setting').click();
        });
        expect(openBibleSetting).toHaveBeenCalledTimes(1);
    });

    test('it asks for the Bible shown NOW, after the pane moved to another', async () => {
        await renderCard('KJV');
        await renderCard('គខប');

        await act(async () => {
            findButton(
                'translated:Let the assistant import this Bible for me',
            ).click();
        });

        expect(openChatbotAsking).toHaveBeenCalledWith(
            'Import the Bible called "គខប"',
        );
    });
});
