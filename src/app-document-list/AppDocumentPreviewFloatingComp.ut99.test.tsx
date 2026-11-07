// @vitest-environment jsdom

import { act, use } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The app-wide host of the floating document previews and the widget it
// lazily loads per open file. The widget's heavy insides (the previewer card,
// the floating frame) are mocked to expose what they were handed.

const { state, mocks } = vi.hoisted(() => ({
    state: {
        openedFilePaths: [] as string[],
        theme: 'dark',
        deleteCallback: null as null | ((filePath: unknown) => void),
        updateCallbacks: new Map<string, () => void>(),
        documentCount: 0,
    },
    mocks: {
        close: vi.fn(),
        keyboardEvent: vi.fn(),
    },
}));

vi.mock('../helper/appHooks', async () => {
    const { useEffect, useRef } = await import('react');
    return {
        useAppEffect: useEffect,
        useAppCurrentRef: (value: unknown) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('../helper/dirSourceHelpers', () => ({
    useFileSourceEvents: (
        events: string[],
        callback: (data: unknown) => void,
        _deps?: unknown[],
        filePath?: string,
    ) => {
        if (events.includes('delete')) {
            state.deleteCallback = callback;
        } else if (filePath !== undefined) {
            state.updateCallbacks.set(filePath, callback as () => void);
        }
    },
}));
vi.mock('../others/AppSuspenseComp', async () => {
    const { Suspense } = await import('react');
    return {
        default: ({ children }: any) => (
            <Suspense fallback={<span data-testid="loading">Loading</span>}>
                {children}
            </Suspense>
        ),
    };
});
vi.mock('./appDocumentHelpers', async () => {
    const { createContext } = await import('react');
    return {
        SelectedVaryAppDocumentContext: createContext<any>(null),
        SelectedEditingSlideContext: createContext<any>(null),
        varyAppDocumentFromFilePath: (filePath: string) => {
            state.documentCount += 1;
            return { filePath, version: state.documentCount };
        },
    };
});
vi.mock('./appDocumentPreviewFloatingHelpers', () => ({
    closeAppDocumentPreviewFloating: mocks.close,
    useOpenedAppDocumentPreviewFilePaths: () => state.openedFilePaths,
    DEFAULT_PREVIEW_THUMBNAIL_SCALE: 30,
    toAppDocumentPreviewRectSettingName: (filePath: string) =>
        `rect:${filePath}`,
    toAppDocumentPreviewScaleSettingName: (filePath: string) =>
        `scale:${filePath}`,
}));
vi.mock('../app-modal/FloatingWidgetComp', () => ({
    default: ({ title, persistKey, onClose, options, children }: any) => (
        <section
            data-widget={persistKey}
            data-offset={options.initialOffset}
            data-class={options.extraClassName}
        >
            <h2>{title}</h2>
            <button type="button" data-testid="close" onClick={onClose}>
                Close
            </button>
            {children}
        </section>
    ),
}));
vi.mock(
    '../app-document-presenter/items/AppDocumentPreviewerComp',
    async () => {
        const { SelectedEditingSlideContext } =
            await import('./appDocumentHelpers');
        const { ThumbnailScaleSettingContext } =
            await import('../app-document-presenter/items/slidesPreviewerScopeHelpers');
        return {
            VaryAppDocumentPreviewerCardComp: function PreviewerCardMockComp({
                varyAppDocument,
                isDisableChanging,
                shouldShowHistory,
                flexSizeNamePrefix,
            }: any) {
                const editingContext = use(SelectedEditingSlideContext) as any;
                const scaleSetting = use(ThumbnailScaleSettingContext);
                return (
                    <div
                        data-testid="card"
                        data-document={`${varyAppDocument.filePath}#${varyAppDocument.version}`}
                        data-disable-changing={String(isDisableChanging)}
                        data-history={String(shouldShowHistory)}
                        data-prefix={flexSizeNamePrefix}
                        data-scale={`${scaleSetting?.settingName}=${scaleSetting?.defaultSize}`}
                        data-editing={String(
                            editingContext.selectedSlideEditing,
                        )}
                        data-holding={editingContext.holdingSlides.length}
                    >
                        <button
                            type="button"
                            data-testid="key"
                            onClick={(event) => {
                                editingContext.setSelectedSlide({ id: 1 });
                                editingContext.onSlideItemsKeyboardEvent(event);
                            }}
                        >
                            key
                        </button>
                    </div>
                );
            },
        };
    },
);
vi.mock('../helper/FileSource', () => ({
    default: {
        getInstance: (filePath: string) => ({
            name: filePath.split('/').at(-1)?.split('.')[0],
        }),
    },
}));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../others/themeHelpers', () => ({
    useThemeSource: () => ({ theme: state.theme }),
}));
vi.mock('../slide-editor/slideEditingKeyboardEventHelpers', () => ({
    onSlideItemsKeyboardEvent: mocks.keyboardEvent,
}));

import { SelectedVaryAppDocumentContext } from './appDocumentHelpers';
import AppDocumentPreviewFloatingComp from './AppDocumentPreviewFloatingComp';
import AppDocumentPreviewFloatingItemComp from './AppDocumentPreviewFloatingItemComp';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function widget(filePath: string) {
    const element = document.querySelector<HTMLElement>(
        `[data-widget="rect:${filePath}"]`,
    );
    if (element === null) {
        throw new Error(`Missing widget ${filePath}`);
    }
    return element;
}

beforeEach(() => {
    state.openedFilePaths = [];
    state.theme = 'dark';
    state.deleteCallback = null;
    state.updateCallbacks.clear();
    state.documentCount = 0;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
});

async function renderHost(selectedFilePath: string | null = null) {
    await act(async () => {
        root.render(
            <SelectedVaryAppDocumentContext
                value={
                    selectedFilePath === null
                        ? null
                        : ({
                              selectedVaryAppDocument: {
                                  filePath: selectedFilePath,
                              },
                              setSelectedVaryAppDocument: () => true,
                          } as any)
                }
            >
                <AppDocumentPreviewFloatingComp />
            </SelectedVaryAppDocumentContext>,
        );
        // The widget is a lazy chunk: let it resolve inside the act scope.
        await new Promise((resolve) => setTimeout(resolve, 20));
    });
}

describe('AppDocumentPreviewFloatingComp', () => {
    test('draws nothing while no preview is open', async () => {
        await renderHost();
        expect(container.innerHTML).toBe('');
        expect(document.querySelector('[data-widget]')).toBeNull();
        expect(mocks.close).not.toHaveBeenCalled();
    });

    test('opens one widget per file, staggered, on the page body', async () => {
        state.openedFilePaths = ['/docs/a.ows', '/docs/b.ows'];
        await renderHost();
        expect(widget('/docs/a.ows').dataset.offset).toBe('0');
        expect(widget('/docs/b.ows').dataset.offset).toBe('24');
        expect(widget('/docs/b.ows').textContent).toContain('Slides: b');
        // Portaled out of the host's own container.
        expect(container.contains(widget('/docs/a.ows'))).toBe(false);
    });

    test('closes the preview of the document the main panel has selected', async () => {
        state.openedFilePaths = ['/docs/a.ows'];
        await renderHost('/docs/a.ows');
        expect(mocks.close).toHaveBeenCalledExactlyOnceWith('/docs/a.ows');
    });

    test('closes an open preview whose file is deleted, and nothing else', async () => {
        state.openedFilePaths = ['/docs/a.ows'];
        await renderHost();
        state.deleteCallback?.('/docs/other.ows');
        state.deleteCallback?.(42);
        expect(mocks.close).not.toHaveBeenCalled();
        state.deleteCallback?.('/docs/a.ows');
        expect(mocks.close).toHaveBeenCalledExactlyOnceWith('/docs/a.ows');
    });
});

describe('AppDocumentPreviewFloatingItemComp', () => {
    async function renderItem(filePath = '/docs/sermon.ows', index = 7) {
        await act(async () => {
            root.render(
                <AppDocumentPreviewFloatingItemComp
                    filePath={filePath}
                    index={index}
                />,
            );
        });
        return widget(filePath);
    }

    test('shows the document in a themed widget of its own', async () => {
        state.theme = 'light';
        const element = await renderItem();
        expect(element.textContent).toContain('Slides: sermon');
        // 7 % 6 = 1 step of the stagger.
        expect(element.dataset.offset).toBe('24');
        expect(element.dataset.class).toBe('app-document-preview-floating');
        expect(
            element
                .closest('.app-floating-widget-portal')
                ?.getAttribute('data-bs-theme'),
        ).toBe('light');
        const card = element.querySelector<HTMLElement>(
            '[data-testid="card"]',
        )!;
        expect(card.dataset.document).toBe('/docs/sermon.ows#1');
        expect(card.dataset.disableChanging).toBe('true');
        expect(card.dataset.history).toBe('false');
        expect(card.dataset.prefix).toBe('floating-preview-');
        expect(card.dataset.scale).toBe('scale:/docs/sermon.ows=30');
        expect(card.dataset.editing).toBe('null');
        expect(card.dataset.holding).toBe('0');
    });

    test('binds the editing keys to the document it shows, not the selected one', async () => {
        const element = await renderItem();
        await act(async () => {
            element
                .querySelector<HTMLButtonElement>('[data-testid="key"]')!
                .click();
        });
        expect(mocks.keyboardEvent).toHaveBeenCalledOnce();
        const [editingState, event] = mocks.keyboardEvent.mock
            .calls[0] as any[];
        expect(editingState).toMatchObject({
            holdingSlides: [],
            varyAppDocument: { filePath: '/docs/sermon.ows', version: 1 },
            selectedSlideEditing: null,
        });
        expect(event.type).toBe('click');
        // Holding slides is a no-op here: the widget holds none.
        expect(editingState.setHoldingSlides([{ id: 1 }])).toBeUndefined();
    });

    test('swaps in a fresh document when its file is updated', async () => {
        const element = await renderItem();
        const card = () =>
            element.querySelector<HTMLElement>('[data-testid="card"]')!;
        expect(card().dataset.document).toBe('/docs/sermon.ows#1');
        await act(async () => {
            state.updateCallbacks.get('/docs/sermon.ows')?.();
        });
        expect(card().dataset.document).toBe('/docs/sermon.ows#2');
    });

    test('its close button closes this preview only', async () => {
        const element = await renderItem('/docs/notes.ows', 0);
        expect(element.dataset.offset).toBe('0');
        await act(async () => {
            element
                .querySelector<HTMLButtonElement>('[data-testid="close"]')!
                .click();
        });
        expect(mocks.close).toHaveBeenCalledExactlyOnceWith('/docs/notes.ows');
    });
});
