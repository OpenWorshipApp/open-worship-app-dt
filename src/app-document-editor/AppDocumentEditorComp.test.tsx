// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { goToPathMock, showAppConfirmMock } = vi.hoisted(() => ({
    goToPathMock: vi.fn(),
    showAppConfirmMock: vi.fn(),
}));

vi.mock('../app-document-list/appDocumentHelpers', async () => {
    const React = await import('react');
    const SelectedVaryAppDocumentContext = React.createContext<any>(null);
    return {
        SelectedVaryAppDocumentContext,
        useVaryAppDocumentContext: () =>
            React.useContext(SelectedVaryAppDocumentContext),
    };
});

vi.mock('../app-document-list/AppDocument', () => ({
    default: class AppDocument {
        static checkIsThisType(item: unknown) {
            return item instanceof AppDocument;
        }
    },
}));

vi.mock('../router/routeHelpers', () => ({
    goToPath: goToPathMock,
}));

vi.mock('../popup-widget/popupWidgetHelpers', () => ({
    showAppConfirm: showAppConfirmMock,
}));

vi.mock('../server/appProvider', () => ({
    default: {
        presenterHomePage: '/presenter.html',
        appUtils: {
            base64Encode: vi.fn(),
        },
        systemUtils: {
            isDev: false,
        },
    },
}));

vi.mock('../resize-actor/ResizeActorComp', async () => {
    const { Suspense } = await import('react');
    return {
        // Draws its panes, so the editor's two lazy chunks really load.
        default: ({ children, dataInput = [] }: any) => (
            <div data-testid="resize-actor">
                {children}
                {dataInput.map(({ children: PaneComp, key }: any) => (
                    <Suspense key={key} fallback={null}>
                        <PaneComp />
                    </Suspense>
                ))}
            </div>
        ),
    };
});

vi.mock('../app-document-presenter/items/AppDocumentPreviewerComp', () => ({
    default: () => <div data-testid="previewer" />,
}));

vi.mock('./AppDocumentEditorRightComp', () => ({
    default: () => <div data-testid="right-pane" />,
}));

vi.mock('../lang/langHelpers', () => ({
    tran: (value: string) => value,
}));

vi.mock('../server/fileHelpers', () => ({
    appDocumentFileExtension: '.ows',
}));

vi.mock('../setting/directory-setting/appLocalStorage', () => ({
    appLocalStorage: {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
    },
}));

describe('AppDocumentEditorComp', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
        goToPathMock.mockClear();
        showAppConfirmMock.mockReset();
    });

    afterEach(async () => {
        await act(async () => {
            root.unmount();
        });
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = false;
        container.remove();
        vi.clearAllMocks();
    });

    test('confirms and returns to presenter when the selected document is not OWS', async () => {
        const { default: AppDocumentEditorComp } =
            await import('./AppDocumentEditorComp');
        const { SelectedVaryAppDocumentContext } =
            await import('../app-document-list/appDocumentHelpers');

        showAppConfirmMock.mockResolvedValue(true);

        const selectedVaryAppDocument = {
            filePath: '/slides/sample.pdf',
        };

        await act(async () => {
            root.render(
                <SelectedVaryAppDocumentContext.Provider
                    value={
                        {
                            selectedVaryAppDocument,
                            setSelectedVaryAppDocument: vi.fn(),
                        } as any
                    }
                >
                    <AppDocumentEditorComp />
                </SelectedVaryAppDocumentContext.Provider>,
            );
        });

        expect(showAppConfirmMock).toHaveBeenCalledWith(
            'Open Worship slide required',
            'The selected document is not an Open Worship slide. Return to Presenter?',
            expect.objectContaining({
                confirmButtonLabel: 'Return to Presenter',
            }),
        );

        await act(async () => {
            await Promise.resolve();
        });

        expect(goToPathMock).toHaveBeenCalledWith('/presenter.html');
    });

    async function renderEditor(selectedVaryAppDocument: unknown) {
        const { default: AppDocumentEditorComp } =
            await import('./AppDocumentEditorComp');
        const { SelectedVaryAppDocumentContext } =
            await import('../app-document-list/appDocumentHelpers');
        await act(async () => {
            root.render(
                <SelectedVaryAppDocumentContext.Provider
                    value={
                        selectedVaryAppDocument === undefined
                            ? null
                            : ({
                                  selectedVaryAppDocument,
                                  setSelectedVaryAppDocument: vi.fn(),
                              } as any)
                    }
                >
                    <AppDocumentEditorComp />
                </SelectedVaryAppDocumentContext.Provider>,
            );
        });
    }

    async function toAppDocument(filePath: string, isEditable: boolean) {
        const { default: AppDocument } =
            await import('../app-document-list/AppDocument');
        return Object.assign(new (AppDocument as any)(), {
            filePath,
            isEditable,
        });
    }

    test('loads the previewer and the right pane as lazy chunks', async () => {
        await renderEditor(undefined);
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 20));
        });
        expect(container.querySelector('[data-testid="previewer"]')).not.toBe(
            null,
        );
        expect(container.querySelector('[data-testid="right-pane"]')).not.toBe(
            null,
        );
    });

    test('stays put with no selection or with an editable slide document', async () => {
        await renderEditor(undefined);
        await renderEditor(null);
        await renderEditor(await toAppDocument('/slides/sunday.ows', true));
        expect(showAppConfirmMock).not.toHaveBeenCalled();
    });

    test('a lyric — a slide document that cannot be edited — is sent back too', async () => {
        showAppConfirmMock.mockResolvedValue(false);
        await renderEditor(await toAppDocument('/lyrics/hymn.owl', false));
        expect(showAppConfirmMock).toHaveBeenCalledOnce();
        await act(async () => {
            await Promise.resolve();
        });
        // Declined: the editor stays where it is.
        expect(goToPathMock).not.toHaveBeenCalled();
    });

    test('asks once per document, and again for another one', async () => {
        showAppConfirmMock.mockResolvedValue(false);
        const pdf = { filePath: '/slides/sample.pdf' };
        await renderEditor(pdf);
        await renderEditor(null);
        await renderEditor({ ...pdf });
        expect(showAppConfirmMock).toHaveBeenCalledOnce();
        await renderEditor({ filePath: '/slides/other.pdf' });
        expect(showAppConfirmMock).toHaveBeenCalledTimes(2);
    });

    test('an answer that comes after the selection moved on does not navigate', async () => {
        let answer: (isOk: boolean) => void = () => {};
        showAppConfirmMock.mockReturnValue(
            new Promise<boolean>((resolve) => {
                answer = resolve;
            }),
        );
        await renderEditor({ filePath: '/slides/sample.pdf' });
        await renderEditor(await toAppDocument('/slides/sunday.ows', true));
        await act(async () => {
            answer(true);
            await Promise.resolve();
        });
        expect(goToPathMock).not.toHaveBeenCalled();
    });
});
