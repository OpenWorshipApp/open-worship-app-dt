// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
    props: null as any,
    doc: null as any,
    selectedPath: null as string | null,
    canSave: false,
    showing: false,
    fileUpdate: null as null | (() => void),
    fromPath: vi.fn(),
    setSelected: vi.fn(),
    openFloating: vi.fn(),
    closeFloating: vi.fn(),
    genFloatingMenu: vi.fn(),
    showPreview: vi.fn(),
    onScreen: vi.fn(),
    drag: vi.fn(),
    openEditor: vi.fn(),
    print: vi.fn(),
    exportArchive: vi.fn(),
    exportPptx: vi.fn(),
    openPdf: vi.fn(),
    removePdf: vi.fn(),
    removePptx: vi.fn(),
    removeDocx: vi.fn(),
    openFile: vi.fn(),
    getInstance: vi.fn(),
}));

vi.mock('../others/FileItemHandlerComp', () => ({
    default: (props: any) => {
        h.props = props;
        return createElement(
            'div',
            { 'data-selected': props.isSelected },
            props.fileData ? props.renderChild(props.fileData) : 'Loading',
        );
    },
}));
vi.mock('../helper/FileSource', () => ({
    default: { getInstance: h.getInstance },
}));
vi.mock('./AppDocument', () => ({
    default: { checkIsThisType: (doc: any) => doc?.kind === 'app' },
    openAppDocumentEditorExternal: h.openEditor,
}));
vi.mock('./PdfAppDocument', () => ({
    default: { checkIsThisType: (doc: any) => doc?.kind === 'pdf' },
}));
vi.mock('./PptxAppDocument', () => ({
    default: { checkIsThisType: (doc: any) => doc?.kind === 'pptx' },
}));
vi.mock('./DocxAppDocument', () => ({
    default: { checkIsThisType: (doc: any) => doc?.kind === 'docx' },
}));
vi.mock('../event/PreviewingEventListener', () => ({
    previewingEventListener: { showVaryAppDocument: h.showPreview },
}));
vi.mock('../helper/appHooks', async () => {
    const react = await import('react');
    return {
        useAppEffect: react.useEffect,
        useAppCurrentRef: <T,>(value: T) => {
            const ref = react.useRef(value);
            ref.current = value;
            return ref;
        },
    };
});
vi.mock('../context-menu/contextMenuIconHelpers', () => ({
    genContextMenuItemIcon: () => null,
}));
vi.mock('../helper/pdfHelpers', () => ({
    removePdfImagesPreview: h.removePdf,
}));
vi.mock('./appDocumentHelpers', async () => {
    const react = await import('react');
    return {
        varyAppDocumentFromFilePath: h.fromPath,
        useSelectedAppDocumentSetterContext: () => h.setSelected,
        SelectedVaryAppDocumentContext: react.createContext(null),
        checkIsVaryAppDocumentFilePathOnScreen: h.onScreen,
    };
});
vi.mock('../editing-manager/editingHelpers', () => ({
    useEditingHistoryStatus: () => ({ canSave: h.canSave }),
}));
vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../helper/pdfPreviewHelpers', () => ({ openPdfPreview: h.openPdf }));
vi.mock('../server/pptxHelpers', () => ({
    removePptxHtmlsPreview: h.removePptx,
}));
vi.mock('../server/docxHelpers', () => ({
    removeDocxHtmlsPreview: h.removeDocx,
}));
vi.mock('../server/appProvider', () => ({
    default: { systemUtils: { openFile: h.openFile } },
}));
vi.mock('../app-document-presenter/presenterRendererHelpers', () => ({
    getIsShowingVaryAppDocumentPreviewer: () => h.showing,
}));
vi.mock('./appDocumentPrintHelpers', () => ({ printAppDocument: h.print }));
vi.mock('../helper/dirSourceHelpers', () => ({
    useFileSourceEvents: (_events: unknown, callback: () => void) => {
        h.fileUpdate = callback;
    },
}));
vi.mock('../helper/dragHelpers', () => ({
    handleAppDocumentDragStart: h.drag,
}));
vi.mock('./appDocumentArchiveHelpers', () => ({
    exportAppDocument: h.exportArchive,
}));
vi.mock('../ms-office/pptxExportHelpers', () => ({
    exportAppDocumentToPptx: h.exportPptx,
}));
vi.mock('./appDocumentPreviewFloatingHelpers', () => ({
    checkHandleOpenSlidesPreviewClicking: h.openFloating,
    closeAppDocumentPreviewFloating: h.closeFloating,
    genOpenSlidesPreviewContextMenu: h.genFloatingMenu,
}));

import VaryAppDocumentFileComp from './VaryAppDocumentFileComp';
import { SelectedVaryAppDocumentContext } from './appDocumentHelpers';

type MenuItem = { menuElement: unknown; onSelect: () => void | Promise<void> };
let root: Root;
let container: HTMLDivElement;

function makeDoc(kind: string, path = 'C:/documents/example.owa') {
    return {
        kind,
        filePath: path,
        fileSource: {
            name: path.split('/').at(-1),
            fireUpdateEvent: vi.fn(),
        },
    };
}

async function renderFile() {
    await act(async () => {
        root.render(
            createElement(
                SelectedVaryAppDocumentContext,
                {
                    value: {
                        selectedVaryAppDocument: h.selectedPath
                            ? { filePath: h.selectedPath }
                            : null,
                    } as any,
                },
                createElement(VaryAppDocumentFileComp, {
                    filePath: 'C:/documents/example.owa',
                    index: 3,
                }),
            ),
        );
    });
}

function item(title: string): MenuItem {
    const found = h.props.contextMenuItems.find(
        ({ menuElement }: MenuItem) =>
            menuElement === title ||
            (typeof menuElement === 'object' &&
                (menuElement as any)?.props?.children?.[0] === title),
    );
    expect(found, `missing ${title}`).toBeDefined();
    return found;
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    for (const value of Object.values(h)) {
        if (vi.isMockFunction(value)) value.mockReset();
    }
    h.doc = makeDoc('app');
    h.props = null;
    h.selectedPath = null;
    h.canSave = false;
    h.showing = false;
    h.fileUpdate = null;
    h.fromPath.mockImplementation(() => h.doc);
    h.setSelected.mockResolvedValue(true);
    h.openFloating.mockReturnValue(false);
    h.genFloatingMenu.mockReturnValue({ menuElement: 'Open slide preview' });
    h.getInstance.mockImplementation((filePath: string) => ({
        name: filePath.split('/').at(-1),
    }));
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe('Documents list file row', () => {
    it('shows the slide name and unsaved marker, then selects and opens it', async () => {
        h.canSave = true;
        await renderFile();
        expect(container.textContent).toContain('example.owa*');
        expect(h.props.index).toBe(3);
        expect(h.props.isSelected).toBe(false);
        await act(async () => h.props.onClick({ type: 'click' }));
        expect(h.setSelected).toHaveBeenCalledWith(h.doc);
        expect(h.showPreview).toHaveBeenCalledWith(h.doc);
        h.showing = true;
        await act(async () => h.props.onClick({ type: 'click' }));
        expect(h.showPreview).toHaveBeenCalledTimes(1);
        expect(await h.props.checkIsOnScreen(h.doc.filePath)).toBeUndefined();
        expect(h.onScreen).toHaveBeenCalledWith(h.doc.filePath);
    });

    it('honors floating-preview shortcuts and pinned selection refusal', async () => {
        await renderFile();
        h.openFloating.mockReturnValueOnce(true);
        await act(async () => h.props.onClick({ type: 'click' }));
        expect(h.setSelected).not.toHaveBeenCalled();
        h.setSelected.mockResolvedValueOnce(false);
        await act(async () => h.props.onClick({ type: 'click' }));
        expect(h.showPreview).not.toHaveBeenCalled();
        h.props.onDragStart({ type: 'dragstart' });
        expect(h.drag).toHaveBeenCalledWith(
            { type: 'dragstart' },
            h.doc.filePath,
        );
    });

    it('follows a selected document through rename and reload', async () => {
        h.selectedPath = h.doc.filePath;
        await renderFile();
        expect(h.props.isSelected).toBe(true);
        h.props.reload();
        expect(h.doc.fileSource.fireUpdateEvent).toHaveBeenCalledTimes(1);
        const renamed = makeDoc('app', 'C:/documents/renamed.owa');
        h.fromPath.mockReturnValueOnce(renamed);
        await act(async () =>
            h.props.renamedCallback({ filePath: renamed.filePath }),
        );
        expect(h.closeFloating).toHaveBeenCalledWith(h.doc.filePath);
        expect(h.setSelected).toHaveBeenCalledWith(renamed, { isForce: true });
        h.doc = renamed;
        await act(async () => h.fileUpdate!());
        expect(h.props.fileData).toBe(renamed);
    });

    it('offers edit, print and both export actions for slide documents', async () => {
        await renderFile();
        expect(
            h.props.contextMenuItems.map(
                ({ menuElement }: MenuItem) => menuElement,
            ),
        ).toContain('Export to PPTX');
        item('Edit').onSelect();
        item('Print').onSelect();
        item('Export').onSelect();
        item('Export to PPTX').onSelect();
        expect(h.openEditor).toHaveBeenCalledWith(h.doc);
        expect(h.print).toHaveBeenCalledWith(h.doc);
        expect(h.exportArchive).toHaveBeenCalledWith(h.doc.filePath);
        await vi.waitFor(() =>
            expect(h.exportPptx).toHaveBeenCalledWith(h.doc),
        );
    });

    it.each([
        ['pdf', 'PDF Document', 'Preview PDF', 'Refresh PDF Images'],
        ['pptx', 'PowerPoint Document', 'Open PPTX', 'Refresh PPTX Slides'],
        ['docx', 'Word Document', 'Open DOCX', 'Refresh DOCX Pages'],
    ])(
        'renders and refreshes %s documents',
        async (kind, label, openTitle, refreshTitle) => {
            h.doc = makeDoc(kind);
            await renderFile();
            expect(
                container.querySelector(`[title="${label}"]`),
            ).not.toBeNull();
            item(openTitle).onSelect();
            await item(refreshTitle).onSelect();
            const open = kind === 'pdf' ? h.openPdf : h.openFile;
            const refresh =
                kind === 'pdf'
                    ? h.removePdf
                    : kind === 'pptx'
                      ? h.removePptx
                      : h.removeDocx;
            expect(open).toHaveBeenCalledWith(h.doc.filePath);
            expect(refresh).toHaveBeenCalledWith(h.doc.filePath);
            expect(h.doc.fileSource.fireUpdateEvent).toHaveBeenCalledTimes(1);
            expect(
                h.props.contextMenuItems.some(
                    ({ menuElement }: MenuItem) =>
                        menuElement === 'Export to PPTX',
                ),
            ).toBe(false);
        },
    );

    it('renders an unknown document kind with its file name', async () => {
        h.doc = makeDoc('unknown');
        await renderFile();
        expect(container.textContent).toContain('example.owa');
        expect(
            h.props.contextMenuItems.some(
                ({ menuElement }: MenuItem) => menuElement === 'Export',
            ),
        ).toBe(true);
    });
});
