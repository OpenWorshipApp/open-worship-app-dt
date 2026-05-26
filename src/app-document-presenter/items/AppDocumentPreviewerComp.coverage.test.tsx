// @vitest-environment jsdom

import { act, createContext, useContext } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const SelectedVaryAppDocumentContext = createContext<any>(null);
const VaryAppDocumentContext = createContext<any>(null);
const appProviderMock = {
    isPagePresenter: false,
    systemUtils: {
        isDev: false,
    },
};

class PdfAppDocumentMock {
    fileSource = { fullName: 'sample.pdf' };

    constructor(public filePath: string) {}

    static checkIsThisType(value: unknown) {
        return value instanceof PdfAppDocumentMock;
    }
}

class DocxAppDocumentMock {
    fileSource = { fullName: 'sample.docx' };

    constructor(public filePath: string) {}

    static checkIsThisType(value: unknown) {
        return value instanceof DocxAppDocumentMock;
    }
}

vi.mock('../../app-document-list/appDocumentHelpers', () => ({
    SelectedVaryAppDocumentContext,
    VaryAppDocumentContext,
    useVaryAppDocumentContext: () => useContext(VaryAppDocumentContext),
}));

vi.mock('./VarySlidesPreviewerComp', () => ({
    default: () => <div data-testid="vary-slides-previewer" />,
}));

vi.mock('./AppDocumentPreviewerFooterComp', () => ({
    default: () => <div data-testid="app-document-footer" />,
}));

vi.mock('../../resize-actor/ResizeActorComp', () => ({
    default: ({ dataInput, flexSizeName }: any) => (
        <div data-testid="resize-actor">
            <span>{flexSizeName}</span>
            {dataInput?.map((input: any) => (
                <div key={input.key} data-testid={`resize-item-${input.key}`}>
                    {input.children.render()}
                </div>
            ))}
        </div>
    ),
}));

vi.mock('../../slide-editor/note/PresenterNoteContainerHandlerComp', () => ({
    default: ({ varyAppDocumentWithNote }: any) => (
        <div data-testid="presenter-note">
            {varyAppDocumentWithNote.fileSource.fullName}
        </div>
    ),
}));

vi.mock('../../screen-setting/PageBaseAppearanceSettingComp', () => ({
    default: () => <div data-testid="page-base-appearance" />,
}));

vi.mock('../../lang/langHelpers', () => ({
    tran: (value: string) => value,
}));

vi.mock('../../helper/settingHelpers', () => ({
    useStateSettingString: (_settingName: string, defaultString = '') => [
        defaultString,
        vi.fn(),
    ],
}));

vi.mock('./slideItemRenderHelpers', () => ({
    DOCX_PREVIEW_BACKGROUND_COLOR_VAR_NAME: '--app-docx-preview-background',
}));

vi.mock('../../server/appProvider', () => ({
    default: appProviderMock,
}));

vi.mock('../../app-document-list/PdfAppDocument', () => ({
    default: PdfAppDocumentMock,
}));

vi.mock('../../app-document-list/DocxAppDocument', () => ({
    default: DocxAppDocumentMock,
}));

describe('AppDocumentPreviewerComp branch coverage', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
        appProviderMock.isPagePresenter = false;
        vi.clearAllMocks();
    });

    afterEach(async () => {
        await act(async () => {
            root.unmount();
        });
        container.remove();
        (globalThis as any).IS_REACT_ACT_ENVIRONMENT = false;
    });

    test('renders the empty state when no app document is selected', async () => {
        const { default: AppDocumentPreviewerComp } =
            await import('./AppDocumentPreviewerComp');

        await act(async () => {
            root.render(
                <SelectedVaryAppDocumentContext.Provider value={null}>
                    <AppDocumentPreviewerComp />
                </SelectedVaryAppDocumentContext.Provider>,
            );
        });

        expect(container.textContent).toContain('No App Document Selected');
        expect(
            container.querySelector('[data-testid="app-document-footer"]'),
        ).toBeNull();
        expect(
            container.querySelector('[data-testid="page-base-appearance"]'),
        ).toBeNull();
    });

    test('renders the presenter editor layout for non-page-base documents', async () => {
        const { default: AppDocumentPreviewerComp } =
            await import('./AppDocumentPreviewerComp');
        const selectedVaryAppDocument = {
            filePath: '/slides/service.ows',
            fileSource: { fullName: 'service.ows' },
            isEditable: true,
        };

        appProviderMock.isPagePresenter = true;

        await act(async () => {
            root.render(
                <SelectedVaryAppDocumentContext.Provider
                    value={{
                        selectedVaryAppDocument,
                    }}
                >
                    <AppDocumentPreviewerComp />
                </SelectedVaryAppDocumentContext.Provider>,
            );
        });

        expect(
            container.querySelector('[data-testid="resize-actor"]')
                ?.textContent,
        ).toContain('service.ows');
        expect(
            container.querySelector('[data-testid="vary-slides-previewer"]'),
        ).not.toBeNull();
        expect(
            container.querySelector('[data-testid="presenter-note"]')
                ?.textContent,
        ).toContain('service.ows');
        expect(
            container.querySelector('[data-testid="app-document-footer"]'),
        ).not.toBeNull();
        expect(
            container.querySelector('[data-testid="page-base-appearance"]'),
        ).toBeNull();
    });

    test('uses the compact presenter layout for page-base documents', async () => {
        const { default: AppDocumentPreviewerComp } =
            await import('./AppDocumentPreviewerComp');
        const selectedVaryAppDocument = new DocxAppDocumentMock(
            '/slides/sample.docx',
        );

        appProviderMock.isPagePresenter = true;

        await act(async () => {
            root.render(
                <SelectedVaryAppDocumentContext.Provider
                    value={{
                        selectedVaryAppDocument,
                    }}
                >
                    <AppDocumentPreviewerComp />
                </SelectedVaryAppDocumentContext.Provider>,
            );
        });

        expect(
            container.querySelector('[data-testid="vary-slides-previewer"]'),
        ).not.toBeNull();
        expect(
            container.querySelector('[data-testid="resize-actor"]'),
        ).toBeNull();
        expect(
            container.querySelector('[data-testid="presenter-note"]'),
        ).toBeNull();
        expect(
            container.querySelector('[data-testid="page-base-appearance"]'),
        ).not.toBeNull();
    });
});
