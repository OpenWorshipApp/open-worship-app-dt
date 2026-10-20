// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { openChatbotAsking, openBibleSetting, getCurrentLocale, mocks } =
    vi.hoisted(() => {
        return {
            openChatbotAsking: vi.fn(async (_text: string) => true),
            openBibleSetting: vi.fn(),
            getCurrentLocale: vi.fn(() => 'en-US'),
            mocks: {
                initKJVBible: vi.fn(async () => {}),
                showAppConfirm: vi.fn(
                    async (_title: string, _body: string, _options?: unknown) =>
                        false,
                ),
                notifyBibleListChanged: vi.fn(),
                showProgressBar: vi.fn(),
                hideProgressBar: vi.fn(),
                showSimpleToast: vi.fn(),
                handleError: vi.fn(),
            },
        };
    });

vi.mock('../lang/langHelpers', () => ({
    tran: (text: string) => `translated:${text}`,
    getCurrentLocale,
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
    const { useEffect, useRef } = await import('react');
    return {
        useAppCurrentRef: <T,>(value: T) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
        useAppEffect: (effect: () => void, deps: unknown[]) => {
            useEffect(effect, deps);
        },
    };
});
vi.mock('../helper/bible-helpers/bibleStyleHelpers', () => ({
    useBibleFontFamily: () => undefined,
}));
vi.mock('../helper/ai/chatbotHandoffHelpers', () => ({ openChatbotAsking }));
vi.mock('../helper/bible-helpers/BibleDataReader', () => ({
    bibleDataReader: { initKJVBible: mocks.initKJVBible },
}));
vi.mock('../helper/bible-helpers/bibleModelHelpers', () => ({
    BIBLE_KJV_KEY: 'KJV',
}));
vi.mock('../helper/bible-helpers/bibleListChangeHelpers', () => ({
    notifyBibleListChanged: mocks.notifyBibleListChanged,
}));
vi.mock('../popup-widget/popupWidgetHelpers', () => ({
    showAppConfirm: mocks.showAppConfirm,
}));
vi.mock('../progress-bar/progressBarHelpers', () => ({
    showProgressBar: mocks.showProgressBar,
    hideProgressBar: mocks.hideProgressBar,
}));
vi.mock('../toast/toastHelpers', () => ({
    showSimpleToast: mocks.showSimpleToast,
}));
vi.mock('../helper/errorHelpers', () => ({
    handleError: mocks.handleError,
}));

import { BibleNotAvailableComp } from './RenderLookupSuggestionComp';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    openChatbotAsking.mockClear();
    openBibleSetting.mockClear();
    getCurrentLocale.mockReturnValue('en-US');
    for (const mock of Object.values(mocks)) {
        mock.mockReset();
    }
    mocks.showAppConfirm.mockResolvedValue(false);
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

async function flush() {
    await act(async () => {
        await new Promise((resolve) => {
            setTimeout(resolve, 0);
        });
    });
}

async function renderCard(bibleKey: string) {
    await act(async () => {
        root.render(<BibleNotAvailableComp bibleKey={bibleKey} />);
    });
    await flush();
}

function findButton(words: string) {
    return Array.from(host.querySelectorAll('button')).find((button) => {
        return button.textContent?.includes(words);
    }) as HTMLButtonElement;
}

describe('BibleNotAvailableComp', () => {
    test('says how the assistant imports a Bible in your language, in steps', async () => {
        await renderCard('KJV');

        expect(host.querySelector('h2')?.textContent).toContain('"KJV"');
        expect(host.textContent).toContain(
            'translated:Or let the assistant import a Bible in your language for you:',
        );
        // Three steps, each through `tran`: a hardcoded one would read
        // English in a Khmer window.
        const stepList = Array.from(host.querySelectorAll('ol > li'));
        expect(stepList).toHaveLength(3);
        for (const step of stepList) {
            expect(step.textContent).toMatch(/^translated:/);
        }
    });

    test('the assistant button asks for a Bible in the current language', async () => {
        await renderCard('KJV');
        const button = findButton(
            'translated:Let the assistant import a Bible for me',
        );
        // Its words and nothing more, or a press by label is refused.
        expect(button.textContent).toBe(
            'translated:Let the assistant import a Bible for me',
        );

        await act(async () => button.click());

        expect(openChatbotAsking).toHaveBeenCalledTimes(1);
        expect(openChatbotAsking).toHaveBeenCalledWith(
            'Import bible for English',
        );
        // The Settings form is still there, and is not what was pressed.
        expect(openBibleSetting).not.toHaveBeenCalled();
        await act(async () => {
            findButton('translated:Go to Bible Setting').click();
        });
        expect(openBibleSetting).toHaveBeenCalledTimes(1);
    });

    test('it asks in the window language, whichever key is missing', async () => {
        await renderCard('KJV');
        await renderCard('គខប');
        getCurrentLocale.mockReturnValue('km-KH');

        await act(async () => {
            findButton(
                'translated:Let the assistant import a Bible for me',
            ).click();
        });

        expect(openChatbotAsking).toHaveBeenCalledWith(
            'Import bible for Khmer',
        );
    });

    test('a missing KJV asks first, and agreeing creates the provided one', async () => {
        mocks.showAppConfirm.mockResolvedValueOnce(true);
        await renderCard('KJV');

        expect(mocks.showAppConfirm).toHaveBeenCalledTimes(1);
        expect(mocks.showAppConfirm.mock.calls[0][0]).toBe(
            'translated:Create the KJV Bible?',
        );
        expect(mocks.showAppConfirm.mock.calls[0][2]).toEqual({
            escToCancel: true,
            confirmButtonLabel: 'Create the provided KJV',
            cancelButtonLabel: 'Cancel',
        });
        expect(mocks.initKJVBible).toHaveBeenCalledTimes(1);
        // The Reader listens for this to ask about the key again, so the card
        // goes away without a reload.
        expect(mocks.notifyBibleListChanged).toHaveBeenCalledTimes(1);
        expect(mocks.showProgressBar).toHaveBeenCalledTimes(1);
        expect(mocks.hideProgressBar).toHaveBeenCalledTimes(1);
    });

    test('cancelling asks nothing more, and the card keeps its own button', async () => {
        await renderCard('KJV');

        expect(mocks.showAppConfirm).toHaveBeenCalledTimes(1);
        expect(mocks.initKJVBible).not.toHaveBeenCalled();
        // Re-rendered, still one ask.
        await renderCard('KJV');
        expect(mocks.showAppConfirm).toHaveBeenCalledTimes(1);

        await act(async () => {
            findButton('translated:Create the provided KJV').click();
        });
        await flush();
        expect(mocks.initKJVBible).toHaveBeenCalledTimes(1);
    });

    test('another missing Bible is not offered the KJV', async () => {
        await renderCard('គខប');

        expect(mocks.showAppConfirm).not.toHaveBeenCalled();
        expect(
            findButton('translated:Create the provided KJV'),
        ).toBeUndefined();
    });

    test('a failed creation says so and leaves the card alone', async () => {
        mocks.showAppConfirm.mockResolvedValueOnce(true);
        mocks.initKJVBible.mockRejectedValueOnce(new Error('disk full'));
        await renderCard('KJV');

        expect(mocks.handleError).toHaveBeenCalledTimes(1);
        expect(mocks.showSimpleToast).toHaveBeenCalledWith(
            'translated:Create the provided KJV',
            'translated:Failed to create the KJV Bible. Please try again.',
        );
        expect(mocks.hideProgressBar).toHaveBeenCalledTimes(1);
        expect(mocks.notifyBibleListChanged).not.toHaveBeenCalled();
    });
});
