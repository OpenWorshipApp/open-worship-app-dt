// @vitest-environment jsdom

import { act, createContext } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const SelectedVaryAppDocumentContext = createContext<any>(null);
const VaryAppDocumentContext = createContext<any>(null);
const checkIsPdfFullWidthMock = vi.fn(() => false);
const setIsPdfFullWidthMock = vi.fn();
const getAllScreenManagersMock = vi.fn(() => []);

function setNativeInputValue(input: HTMLInputElement, value: string) {
    const descriptor = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
    );
    descriptor?.set?.call(input, value);
}

vi.mock('../../app-document-list/appDocumentHelpers', () => ({
    SelectedVaryAppDocumentContext,
    VaryAppDocumentContext,
    useVaryAppDocumentContext: () => {
        throw new Error('useVaryAppDocumentContext is not expected in this test');
    },
}));

vi.mock('./VarySlidesPreviewerComp', () => ({
    default: () => <div data-testid="vary-slides-previewer" />,
}));

vi.mock('./AppDocumentPreviewerFooterComp', () => ({
    default: () => <div data-testid="app-document-footer" />,
}));

vi.mock('../../resize-actor/ResizeActorComp', () => ({
    default: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('../../slide-editor/note/PresenterNoteContainerHandlerComp', () => ({
    default: () => <div data-testid="presenter-note" />,
}));

vi.mock('../../lang/langHelpers', () => ({
    tran: (value: string) => value,
}));

vi.mock('../../helper/settingHelpers', async () => {
    const { useState } = await import('react');

    return {
        useStateSettingString: (_settingName: string, defaultString = '') =>
            useState(defaultString),
    };
});

vi.mock('./slideItemRenderHelpers', () => ({
    DOCX_PREVIEW_BACKGROUND_COLOR_VAR_NAME:
        '--app-docx-preview-background',
}));

vi.mock('../../server/appProvider', () => ({
    default: {
        isPagePresenter: false,
        systemUtils: {
            isDev: false,
        },
    },
}));

vi.mock('../../_screen/managers/screenManagerHelpers', () => ({
    getAllScreenManagers: getAllScreenManagersMock,
}));

vi.mock('../../_screen/managers/ScreenVaryAppDocumentManager', () => ({
    checkIsPdfFullWidth: checkIsPdfFullWidthMock,
    setIsPdfFullWidth: setIsPdfFullWidthMock,
}));

vi.mock('../../app-document-list/PdfAppDocument', () => ({
    default: class PdfAppDocument {
        fileSource = { fullName: 'sample.pdf' };
        isEditable = false;

        constructor(public filePath: string) {}
    },
}));

vi.mock('../../app-document-list/DocxAppDocument', () => ({
    default: class DocxAppDocument {
        fileSource = { fullName: 'sample.docx' };
        isEditable = false;

        constructor(public filePath: string) {}
    },
}));

describe('AppDocumentPreviewerComp', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        globalThis.IS_REACT_ACT_ENVIRONMENT = true;
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
        checkIsPdfFullWidthMock.mockReturnValue(false);
        getAllScreenManagersMock.mockReturnValue([]);
    });

    afterEach(async () => {
        await act(async () => {
            root.unmount();
        });
        globalThis.IS_REACT_ACT_ENVIRONMENT = false;
        container.remove();
        vi.clearAllMocks();
    });

    test('shows a DOCX preview background picker and updates the preview CSS variable', async () => {
        const { default: AppDocumentPreviewerComp } = await import(
            './AppDocumentPreviewerComp'
        );
        const { default: DocxAppDocument } = await import(
            '../../app-document-list/DocxAppDocument'
        );
        const selectedVaryAppDocument = new DocxAppDocument('/slides/sample.docx');

        await act(async () => {
            root.render(
                <SelectedVaryAppDocumentContext.Provider
                    value={{
                        selectedVaryAppDocument,
                        setSelectedVaryAppDocument: vi.fn(),
                    }}
                >
                    <AppDocumentPreviewerComp />
                </SelectedVaryAppDocumentContext.Provider>,
            );
        });

        const colorPickerIcon = container.querySelector('.bi-record-circle');
        const colorInput = container.querySelector(
            'input[type="color"]',
        ) as HTMLInputElement | null;
        const cardBody = container.querySelector('.card-body') as HTMLDivElement | null;

        expect(colorPickerIcon).not.toBeNull();
        expect(colorInput).not.toBeNull();
        expect(cardBody).not.toBeNull();
        expect(
            cardBody?.style.getPropertyValue('--app-docx-preview-background'),
        ).toBe('');

        await act(async () => {
            if (colorInput) {
                setNativeInputValue(colorInput, '#123456');
                colorInput.dispatchEvent(new Event('input', { bubbles: true }));
                colorInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });

        const updatedCardBody = container.querySelector(
            '.card-body',
        ) as HTMLDivElement | null;
        expect(
            updatedCardBody?.style.getPropertyValue(
                '--app-docx-preview-background',
            ),
        ).toBe('#123456');

        await act(async () => {
            colorPickerIcon?.dispatchEvent(
                new MouseEvent('contextmenu', {
                    bubbles: true,
                    cancelable: true,
                }),
            );
        });

        expect(
            cardBody?.style.getPropertyValue('--app-docx-preview-background'),
        ).toBe('');
    });

    test('shows the page-base appearance controls for PDF previews', async () => {
        const { default: AppDocumentPreviewerComp } = await import(
            './AppDocumentPreviewerComp'
        );
        const { default: PdfAppDocument } = await import(
            '../../app-document-list/PdfAppDocument'
        );
        const selectedVaryAppDocument = new PdfAppDocument('/slides/sample.pdf');

        await act(async () => {
            root.render(
                <SelectedVaryAppDocumentContext.Provider
                    value={{
                        selectedVaryAppDocument,
                        setSelectedVaryAppDocument: vi.fn(),
                    }}
                >
                    <AppDocumentPreviewerComp />
                </SelectedVaryAppDocumentContext.Provider>,
            );
        });

        expect(container.querySelector('.bi-record-circle')).not.toBeNull();
        expect(container.querySelector('input[type="color"]')).not.toBeNull();
        expect(container.textContent).toContain('On Screen Width:');
    });
});
