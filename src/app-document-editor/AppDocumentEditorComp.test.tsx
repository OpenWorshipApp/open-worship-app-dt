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

vi.mock('../resize-actor/ResizeActorComp', () => ({
    default: ({ children }: any) => (
        <div data-testid="resize-actor">{children}</div>
    ),
}));

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

vi.mock('../helper/debuggerHelpers', () => ({
    useAppEffect: (effect: any) => effect,
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
});
