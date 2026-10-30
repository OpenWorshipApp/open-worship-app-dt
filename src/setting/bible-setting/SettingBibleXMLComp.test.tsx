// @vitest-environment jsdom

// The XML half of the Bible settings page on one mock surface: the section
// with its drop target, the list, the export/import panel, the data preview
// tabs and the info / extra editors around the (stubbed) Monaco editor, plus
// SettingBibleComp that holds them.

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    // Kept in plain arrays: `mockReset` would wipe a vi.fn's record of the
    // calls made at module load, before the first test runs.
    diagnosticsOptions: [] as any[],
    editorProps: [] as any[],
    settingKeys: [] as string[],
    isDev: false,
    xmlKeys: {
        bibleKeysMap: null as Record<string, string> | null,
        isPending: false,
    },
    bibleInfo: {
        value: null as Record<string, unknown> | null,
        isPending: false,
    },
    droppedFiles: [] as File[],
    loadBibleKeysMock: vi.fn(),
    getBibleXMLDataFromKeyMock: vi.fn(),
    saveJsonDataToXMLfileMock: vi.fn(),
    updateBibleXMLInfoMock: vi.fn(),
    addMonacoBibleInfoActionsMock: vi.fn(),
    forceReloadAppWindowsMock: vi.fn(),
    showSimpleToastMock: vi.fn(),
    warnIfBibleKeyDirtyMock: vi.fn(),
    warnIfAnyBibleEditorDirtyMock: vi.fn(),
    downloadBibleJSONMock: vi.fn(),
    initKJVBibleMock: vi.fn(),
    handleBibleXMLExportingMock: vi.fn(),
    handleBibleXMLImportingMock: vi.fn(),
}));

vi.mock('monaco-editor', () => ({
    json: {
        jsonDefaults: {
            setDiagnosticsOptions: (options: any) => {
                h.diagnosticsOptions.push(options);
            },
        },
    },
    Uri: { parse: (value: string) => ({ toString: () => value }) },
}));

vi.mock('./schemas/bibleSchemaHelpers', () => ({
    infoEditorSchemaHandler: { schema: { $id: 'info-schema' } },
    extraEditorSchemaHandler: { schema: { $id: 'extra-schema' } },
    bookChapterEditorSchemaHandler: { schema: { $id: 'book-chapter-schema' } },
}));

vi.mock('../../lang/langHelpers', () => ({
    tran: (text: string) => text,
}));

vi.mock('../../helper/appHooks', async () => {
    const react = await import('react');
    return {
        useAppEffect: react.useEffect,
        useAppCurrentRef: <T,>(value: T) => {
            const ref = react.useRef(value);
            ref.current = value;
            return ref;
        },
        useAppStateAsync: <T,>(callee: () => Promise<T>, deps: any[] = []) => {
            const [value, setValue] = react.useState<T | undefined>();
            react.useEffect(() => {
                let isActive = true;
                callee().then((newValue) => {
                    if (isActive) {
                        setValue(newValue);
                    }
                });
                return () => {
                    isActive = false;
                };
                // eslint-disable-next-line react-hooks/exhaustive-deps
            }, deps);
            return [value, setValue];
        },
    };
});

vi.mock('../../helper/settingHelpers', async () => {
    const react = await import('react');
    return {
        useStateSettingString: (key: string, defaultValue: string) => {
            h.settingKeys.push(key);
            return react.useState(defaultValue);
        },
    };
});

vi.mock('../../server/appProvider', () => ({
    default: {
        get systemUtils() {
            return { isDev: h.isDev };
        },
    },
}));

vi.mock('../../server/fileHelpers', () => ({
    getFileFullName: (file: File) => (file.name === '' ? undefined : file.name),
}));

vi.mock('../../others/droppingFileHelpers', () => ({
    readDroppedFiles: async function* () {
        yield* h.droppedFiles;
    },
}));

vi.mock('../../toast/toastHelpers', () => ({
    showSimpleToast: h.showSimpleToastMock,
}));

vi.mock('../../helper/bible-helpers/BibleDataReader', () => ({
    bibleDataReader: { initKJVBible: h.initKJVBibleMock },
}));

vi.mock('../../helper/bible-helpers/bibleModelHelpers', () => ({
    BIBLE_KJV_KEY: 'KJV',
}));

vi.mock('../settingHelpers', () => ({
    forceReloadAppWindows: h.forceReloadAppWindowsMock,
}));

vi.mock('./bibleXMLHelpers', () => ({
    useBibleXMLKeys: () => ({
        bibleKeysMap: h.xmlKeys.bibleKeysMap,
        isPending: h.xmlKeys.isPending,
        loadBibleKeys: h.loadBibleKeysMock,
    }),
    useBibleXMLInfo: () => ({
        bibleInfo: h.bibleInfo.value,
        isPending: h.bibleInfo.isPending,
    }),
    getBibleXMLDataFromKey: h.getBibleXMLDataFromKeyMock,
    saveJsonDataToXMLfile: h.saveJsonDataToXMLfileMock,
    updateBibleXMLInfo: h.updateBibleXMLInfoMock,
}));

vi.mock('./bibleXMLArchiveHelpers', () => ({
    BIBLE_XML_ARCHIVE_DOT_EXTENSION: '.owabdata.tar.gz',
    checkIsBibleXMLArchiveFileFullName: (fileFullName: string) => {
        return fileFullName.toLowerCase().endsWith('.owabdata.tar.gz');
    },
}));

vi.mock('./bibleXMLArchiveMenuHelpers', () => ({
    handleBibleXMLExporting: h.handleBibleXMLExportingMock,
    handleBibleXMLImporting: h.handleBibleXMLImportingMock,
}));

vi.mock('./bibleEditorDirtyHelpers', () => ({
    warnIfBibleKeyDirty: h.warnIfBibleKeyDirtyMock,
    warnIfAnyBibleEditorDirty: h.warnIfAnyBibleEditorDirtyMock,
}));

vi.mock('./bibleXMLDownloadHelpers', () => ({
    downloadBibleJSON: h.downloadBibleJSONMock,
}));

// The Monaco editor itself has its own test; here it only has to show what
// it was handed.
vi.mock('./BibleXMLEditorComp', () => ({
    BIBLE_EDITOR_BODY_HEIGHT: 450,
    BIBLE_EDITOR_FOOTER_HEIGHT: 35,
    addMonacoBibleInfoActions: h.addMonacoBibleInfoActionsMock,
    default: (props: any) => {
        h.editorProps.push(props);
        return (
            <div
                data-testid="editor"
                data-id={props.id}
                data-uri={props.editorUri.toString()}
            >
                {JSON.stringify(props.jsonData)}
            </div>
        );
    },
}));

vi.mock('./BibleXMLBookChapterEditorComp', () => ({
    default: ({ bibleKey }: { bibleKey: string }) => (
        <div data-testid="book-chapter-editor">{bibleKey}</div>
    ),
}));
vi.mock('./BibleXMLInfoComp', () => ({
    default: ({
        bibleKey,
        filePath,
    }: {
        bibleKey: string;
        filePath: string;
    }) => (
        <li data-testid="bible-xml-info" data-file-path={filePath}>
            {bibleKey}
        </li>
    ),
}));
vi.mock('./BibleXMLImportComp', () => ({
    default: () => <div data-testid="xml-import" />,
}));
vi.mock('./SettingBibleJsonComp', () => ({
    default: () => <div data-testid="bible-json" />,
}));

import SettingBibleComp from './SettingBibleComp';
import SettingBibleXMLComp from './SettingBibleXMLComp';
import BibleXMLListComp from './BibleXMLListComp';
import BibleXMLDataPreviewComp from './BibleXMLDataPreviewComp';
import BibleXMLExtraEditorComp from './BibleXMLExtraEditorComp';
import BibleXMLInfoEditorComp from './BibleXMLInfoEditorComp';

let container: HTMLDivElement;
let root: Root;

function findButton(text: string, scope: ParentNode = container) {
    return (
        Array.from(scope.querySelectorAll('button')).find((button) => {
            return button.textContent?.trim() === text;
        }) ?? null
    );
}

function checkIsLoading() {
    return container.querySelector('img[alt="Loading..."]') !== null;
}

function getLastEditorProps() {
    return h.editorProps.at(-1);
}

async function flush() {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

function fireDragEvent(target: Element, type: string, items: any[]) {
    const event = new Event(type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'dataTransfer', { value: { items } });
    target.dispatchEvent(event);
    return event;
}

function toDroppedFile(name: string, appFilePath?: string) {
    const file = new File(['bundle'], name);
    if (appFilePath !== undefined) {
        Object.defineProperty(file, 'appFilePath', { value: appFilePath });
    }
    return file;
}

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    h.editorProps = [];
    h.settingKeys = [];
    h.isDev = false;
    h.xmlKeys.bibleKeysMap = { KJV: '/bibles/KJV.xml' };
    h.xmlKeys.isPending = false;
    h.bibleInfo.value = null;
    h.bibleInfo.isPending = false;
    h.droppedFiles = [];
    h.warnIfBibleKeyDirtyMock.mockReturnValue(false);
    h.warnIfAnyBibleEditorDirtyMock.mockReturnValue(false);
    h.initKJVBibleMock.mockResolvedValue(undefined);
    h.handleBibleXMLImportingMock.mockImplementation(
        async (_filePath: unknown, onImported: () => void) => {
            onImported();
        },
    );
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

describe('SettingBibleComp', () => {
    test('shows the downloaded-Bible lists in development only', async () => {
        await act(async () => root.render(<SettingBibleComp />));
        expect(container.querySelector('[data-testid="xml-import"]')).not.toBe(
            null,
        );
        expect(container.querySelector('[data-testid="bible-json"]')).toBe(
            null,
        );

        h.isDev = true;
        await act(async () => root.render(<SettingBibleComp key="dev" />));
        expect(container.querySelector('[data-testid="bible-json"]')).not.toBe(
            null,
        );
    });
});

describe('SettingBibleXMLComp drop target', () => {
    async function renderSection() {
        await act(async () => root.render(<SettingBibleXMLComp />));
        return container.firstElementChild as HTMLElement;
    }

    test('dims while files are dragged over it, and only for files', async () => {
        const section = await renderSection();

        const textDrag = fireDragEvent(section, 'dragover', [
            { kind: 'string' },
        ]);
        expect(textDrag.defaultPrevented).toBe(true);
        expect(section.style.opacity).toBe('');

        // An empty item list is not a file drag either.
        fireDragEvent(section, 'dragover', []);
        expect(section.style.opacity).toBe('');

        fireDragEvent(section, 'dragover', [{ kind: 'file' }]);
        expect(section.style.opacity).toBe('0.5');

        const leave = fireDragEvent(section, 'dragleave', []);
        expect(leave.defaultPrevented).toBe(true);
        expect(section.style.opacity).toBe('1');
    });

    test('imports the first Bible data bundle dropped, read where it sits', async () => {
        const section = await renderSection();
        fireDragEvent(section, 'dragover', [{ kind: 'file' }]);
        h.droppedFiles = [
            toDroppedFile('notes.txt', '/drops/notes.txt'),
            toDroppedFile('', '/drops/unnamed'),
            // A bundle with no path on disk (made in the renderer) is passed.
            toDroppedFile('memory.owabdata.tar.gz'),
            toDroppedFile(
                'Bibles.OWABDATA.tar.gz',
                '/drops/Bibles.owabdata.tar.gz',
            ),
            toDroppedFile(
                'second.owabdata.tar.gz',
                '/drops/second.owabdata.tar.gz',
            ),
        ];

        await act(async () => {
            fireDragEvent(section, 'drop', [{ kind: 'file' }]);
        });
        await flush();

        expect(section.style.opacity).toBe('1');
        // One bundle per drop.
        expect(h.handleBibleXMLImportingMock).toHaveBeenCalledOnce();
        expect(h.handleBibleXMLImportingMock.mock.calls[0][0]).toBe(
            '/drops/Bibles.owabdata.tar.gz',
        );
        // The list is reloaded once the import is done.
        expect(h.loadBibleKeysMock).toHaveBeenCalledOnce();
    });

    test('a drop with no bundle in it imports nothing', async () => {
        const section = await renderSection();
        h.droppedFiles = [toDroppedFile('kjv.xml', '/drops/kjv.xml')];

        await act(async () => {
            fireDragEvent(section, 'drop', [{ kind: 'file' }]);
        });
        await flush();

        expect(h.handleBibleXMLImportingMock).not.toHaveBeenCalled();
        expect(h.loadBibleKeysMock).not.toHaveBeenCalled();
    });
});

describe('BibleXMLArchiveComp', () => {
    test('exports, and imports then reloads the list', async () => {
        await act(async () => root.render(<SettingBibleXMLComp />));
        expect(container.textContent).toContain(
            'Drop an exported bible data file here to import (.owabdata.tar.gz)',
        );

        await act(async () => findButton('Export Bible Data')!.click());
        expect(h.handleBibleXMLExportingMock).toHaveBeenCalledOnce();

        await act(async () => findButton('Import Bible Data')!.click());
        // No file named: the import asks for one.
        expect(h.handleBibleXMLImportingMock.mock.calls[0][0]).toBeUndefined();
        expect(h.loadBibleKeysMock).toHaveBeenCalledOnce();
    });
});

describe('BibleXMLListComp', () => {
    async function renderList(
        bibleKeysMap: Record<string, string> | null,
        isPending = false,
    ) {
        const loadBibleKeys = vi.fn();
        await act(async () =>
            root.render(
                <BibleXMLListComp
                    isPending={isPending}
                    bibleKeysMap={bibleKeysMap}
                    loadBibleKeys={loadBibleKeys}
                />,
            ),
        );
        return loadBibleKeys;
    }

    test('shows loading while the keys are read', async () => {
        await renderList(null, true);
        expect(checkIsLoading()).toBe(true);
    });

    test.each([null, {}])(
        'with no Bible XML (%j) it offers to create the KJV one',
        async (bibleKeysMap) => {
            const loadBibleKeys = await renderList(bibleKeysMap);
            expect(container.textContent).toContain('No Bible XML files');
            const searchLink = container.querySelector(
                'a',
            ) as HTMLAnchorElement;
            expect(searchLink.href).toContain('holy+bible+xml+format');

            await act(async () => findButton('Create KJV Bible XML')!.click());

            expect(h.initKJVBibleMock).toHaveBeenCalledOnce();
            expect(loadBibleKeys).toHaveBeenCalledOnce();
        },
    );

    test('lists the Bibles by key with their files, KJV offer on top when lost', async () => {
        await renderList({
            ksv: '/bibles/ksv.xml',
            ABC: '/bibles/ABC.xml',
            KM: '/bibles/KM.xml',
        });
        expect(container.querySelector('h3')!.textContent).toContain(
            'Bibles XML',
        );
        const rows = Array.from(container.querySelectorAll('li'));
        expect(rows[0].textContent).toContain('Create KJV Bible XML');
        const infoRows = rows.slice(1).map((row) => {
            return [row.textContent, row.getAttribute('data-file-path')];
        });
        expect(infoRows).toEqual([
            ['ABC', '/bibles/ABC.xml'],
            ['KM', '/bibles/KM.xml'],
            ['ksv', '/bibles/ksv.xml'],
        ]);
    });

    test('a list holding the KJV does not offer to create it', async () => {
        await renderList({ KJV: '/bibles/KJV.xml' });
        expect(findButton('Create KJV Bible XML')).toBeNull();
        expect(container.querySelectorAll('li')).toHaveLength(1);
    });

    test('Refresh is refused while an editor holds unsaved changes', async () => {
        const loadBibleKeys = await renderList({ KJV: '/bibles/KJV.xml' });
        h.warnIfAnyBibleEditorDirtyMock.mockReturnValue(true);

        await act(async () => findButton('Refresh')!.click());

        expect(h.warnIfAnyBibleEditorDirtyMock).toHaveBeenCalledWith(
            'Save or discard unsaved Bible changes before refreshing.',
        );
        expect(loadBibleKeys).not.toHaveBeenCalled();

        h.warnIfAnyBibleEditorDirtyMock.mockReturnValue(false);
        await act(async () => findButton('Refresh')!.click());
        expect(loadBibleKeys).toHaveBeenCalledOnce();
    });
});

describe('BibleXMLDataPreviewComp', () => {
    test('registers the three editor schemas with the JSON language once', () => {
        expect(h.diagnosticsOptions).toHaveLength(1);
        const [options] = h.diagnosticsOptions;
        expect(options).toMatchObject({
            validate: true,
            allowComments: false,
            enableSchemaRequest: false,
        });
        expect(
            options.schemas.map((schema: any) => {
                return [schema.uri, schema.fileMatch];
            }),
        ).toEqual([
            ['info-schema', ['bible-info']],
            ['extra-schema', ['bible-extra']],
            ['book-chapter-schema', ['book-chapter']],
        ]);
    });

    test('opens on the info tab and switches tabs when nothing is unsaved', async () => {
        h.bibleInfo.value = { key: 'KJV', title: 'King James' };
        h.getBibleXMLDataFromKeyMock.mockResolvedValue({
            newLines: ['GEN 1:1'],
            newLinesTitleMap: {},
            customVersesMap: {},
        });
        await act(async () =>
            root.render(<BibleXMLDataPreviewComp bibleKey="KJV" />),
        );
        expect(h.settingKeys).toContain(
            'bible-setting-KJV-xml-data-editing-type',
        );
        expect(findButton('Info')!.className).toContain('btn-light');
        expect(findButton('Extra')!.className).toContain('btn-primary');
        expect(getLastEditorProps().editorUri.toString()).toBe('bible-info');

        await act(async () => findButton('Extra')!.click());
        await flush();

        expect(h.warnIfBibleKeyDirtyMock).toHaveBeenCalledWith(
            'KJV',
            'Save or discard unsaved Bible changes before switching tabs.',
        );
        expect(findButton('Extra')!.className).toContain('btn-light');
        expect(getLastEditorProps().editorUri.toString()).toBe('bible-extra');

        await act(async () => findButton('Book Chapter')!.click());

        expect(
            container.querySelector('[data-testid="book-chapter-editor"]')!
                .textContent,
        ).toBe('KJV');
    });

    test('stays on the tab whose editor holds unsaved changes', async () => {
        h.warnIfBibleKeyDirtyMock.mockReturnValue(true);
        await act(async () =>
            root.render(<BibleXMLDataPreviewComp bibleKey="KJV" />),
        );

        // Pressing the tab already open asks nothing.
        await act(async () => findButton('Info')!.click());
        expect(h.warnIfBibleKeyDirtyMock).not.toHaveBeenCalled();

        await act(async () => findButton('Book Chapter')!.click());

        expect(h.warnIfBibleKeyDirtyMock).toHaveBeenCalledOnce();
        expect(findButton('Info')!.className).toContain('btn-light');
        expect(
            container.querySelector('[data-testid="book-chapter-editor"]'),
        ).toBeNull();
    });

    test('Download hands the Bible key to the JSON download', async () => {
        await act(async () =>
            root.render(<BibleXMLDataPreviewComp bibleKey="KSV" />),
        );
        await act(async () => findButton('Download')!.click());
        expect(h.downloadBibleJSONMock).toHaveBeenCalledWith('KSV');
    });
});

describe('BibleXMLInfoEditorComp', () => {
    const INFO = {
        key: 'KJV',
        title: 'King James',
        locale: 'en-US',
        booksAvailable: ['GEN'],
    };

    test('waits while the info loads and shows nothing for a missing Bible', async () => {
        h.bibleInfo.isPending = true;
        await act(async () =>
            root.render(<BibleXMLInfoEditorComp bibleKey="KJV" />),
        );
        expect(checkIsLoading()).toBe(true);

        h.bibleInfo.isPending = false;
        await act(async () =>
            root.render(<BibleXMLInfoEditorComp bibleKey="KJV" />),
        );
        expect(container.innerHTML).toBe('');
    });

    test('edits the info without the list of available books', async () => {
        h.bibleInfo.value = INFO;
        await act(async () =>
            root.render(<BibleXMLInfoEditorComp bibleKey="KJV" />),
        );
        const props = getLastEditorProps();
        expect(props.id).toBe('KJV');
        expect(props.jsonData).toEqual({ ...INFO, booksAvailable: undefined });
        expect(props.editorUri.toString()).toBe('bible-info');
        expect(props.jsonDataSchema).toEqual({
            schema: { $id: 'info-schema' },
        });
    });

    test('saving reloads the windows only when the info was written', async () => {
        h.bibleInfo.value = INFO;
        h.updateBibleXMLInfoMock.mockResolvedValue(false);
        await act(async () =>
            root.render(<BibleXMLInfoEditorComp bibleKey="KJV" />),
        );
        const newInfo = { ...INFO, title: 'KJV 1611' };

        await act(async () => getLastEditorProps().save(newInfo));
        expect(h.updateBibleXMLInfoMock).toHaveBeenCalledWith(INFO, newInfo);
        expect(h.forceReloadAppWindowsMock).not.toHaveBeenCalled();

        h.updateBibleXMLInfoMock.mockResolvedValue(true);
        await act(async () => getLastEditorProps().save(newInfo));
        expect(h.forceReloadAppWindowsMock).toHaveBeenCalledOnce();
    });

    test('a save landing after the Bible went away writes nothing', async () => {
        h.bibleInfo.value = INFO;
        await act(async () =>
            root.render(<BibleXMLInfoEditorComp bibleKey="KJV" />),
        );
        const { save } = getLastEditorProps();
        h.bibleInfo.value = null;
        await act(async () =>
            root.render(<BibleXMLInfoEditorComp bibleKey="KJV" />),
        );

        await act(async () => save({ ...INFO, title: 'Late' }));

        expect(h.updateBibleXMLInfoMock).not.toHaveBeenCalled();
    });

    test('the editor actions read and patch the JSON in the editor', async () => {
        h.bibleInfo.value = INFO;
        await act(async () =>
            root.render(<BibleXMLInfoEditorComp bibleKey="KJV" />),
        );
        let text = JSON.stringify({ key: 'KJV', locale: 'en-US' });
        const editorStore = {
            editorInstance: { getValue: () => text },
            replaceValue: vi.fn(),
        };

        getLastEditorProps().onStore(editorStore);

        expect(h.addMonacoBibleInfoActionsMock).toHaveBeenCalledOnce();
        const [store, getBibleInfo, setPartialBibleInfo] =
            h.addMonacoBibleInfoActionsMock.mock.calls[0];
        expect(store).toBe(editorStore);
        expect(getBibleInfo()).toEqual({ key: 'KJV', locale: 'en-US' });

        setPartialBibleInfo({ locale: 'km-KH' });
        expect(editorStore.replaceValue).toHaveBeenCalledWith(
            JSON.stringify({ key: 'KJV', locale: 'km-KH' }, null, 4),
        );

        // An editor holding `null` has nothing to patch.
        text = 'null';
        setPartialBibleInfo({ locale: 'fr-FR' });
        expect(editorStore.replaceValue).toHaveBeenCalledOnce();
    });
});

describe('BibleXMLExtraEditorComp', () => {
    const XML_DATA = {
        info: { key: 'KJV' },
        books: { GEN: {} },
        newLines: ['MAT 7:6'],
        newLinesTitleMap: { 'GEN 1:1': [] },
        customVersesMap: {},
    };

    test('waits for the Bible data and shows nothing for a missing Bible', async () => {
        h.getBibleXMLDataFromKeyMock.mockReturnValue(new Promise(() => {}));
        await act(async () =>
            root.render(<BibleXMLExtraEditorComp bibleKey="KJV" />),
        );
        expect(checkIsLoading()).toBe(true);

        h.getBibleXMLDataFromKeyMock.mockResolvedValue(null);
        await act(async () =>
            root.render(<BibleXMLExtraEditorComp key="2" bibleKey="KJV" />),
        );
        await flush();
        expect(container.innerHTML).toBe('');
    });

    test('edits only the extra parts of the Bible', async () => {
        h.getBibleXMLDataFromKeyMock.mockResolvedValue(XML_DATA);
        await act(async () =>
            root.render(<BibleXMLExtraEditorComp bibleKey="KJV" />),
        );
        await flush();
        const props = getLastEditorProps();
        expect(props.jsonData).toEqual({
            bibleKey: 'KJV',
            newLines: ['MAT 7:6'],
            newLinesTitleMap: { 'GEN 1:1': [] },
            customVersesMap: {},
        });
        expect(props.editorUri.toString()).toBe('bible-extra');
        expect(props.onStore()).toBeUndefined();
    });

    test('saves the extra parts into the Bible and reloads the windows', async () => {
        h.getBibleXMLDataFromKeyMock.mockResolvedValue(XML_DATA);
        h.saveJsonDataToXMLfileMock.mockResolvedValue(true);
        await act(async () =>
            root.render(<BibleXMLExtraEditorComp bibleKey="KJV" />),
        );
        await flush();

        await act(async () =>
            getLastEditorProps().save({
                bibleKey: 'KJV',
                newLines: ['JHN 3:16'],
                newLinesTitleMap: {},
                customVersesMap: { 'MAT 3:15': [] },
            }),
        );
        await flush();

        expect(h.saveJsonDataToXMLfileMock).toHaveBeenCalledWith({
            ...XML_DATA,
            newLines: ['JHN 3:16'],
            newLinesTitleMap: {},
            customVersesMap: { 'MAT 3:15': [] },
        });
        expect(h.forceReloadAppWindowsMock).toHaveBeenCalledOnce();
    });

    test('a failed write does not reload the windows', async () => {
        h.getBibleXMLDataFromKeyMock.mockResolvedValue(XML_DATA);
        h.saveJsonDataToXMLfileMock.mockResolvedValue(false);
        await act(async () =>
            root.render(<BibleXMLExtraEditorComp bibleKey="KJV" />),
        );
        await flush();

        await act(async () =>
            getLastEditorProps().save({ bibleKey: 'KJV', newLines: [] }),
        );
        await flush();

        expect(h.saveJsonDataToXMLfileMock).toHaveBeenCalledOnce();
        expect(h.forceReloadAppWindowsMock).not.toHaveBeenCalled();
    });

    test('refuses JSON that names another Bible, and a Bible gone meanwhile', async () => {
        h.getBibleXMLDataFromKeyMock.mockResolvedValue(XML_DATA);
        await act(async () =>
            root.render(<BibleXMLExtraEditorComp bibleKey="KJV" />),
        );
        await flush();

        await act(async () =>
            getLastEditorProps().save({ bibleKey: 'KSV', newLines: [] }),
        );
        expect(h.showSimpleToastMock).toHaveBeenCalledWith(
            'Saving Bible Data',
            'Invalid Bible Key KSV',
        );
        expect(h.saveJsonDataToXMLfileMock).not.toHaveBeenCalled();

        h.getBibleXMLDataFromKeyMock.mockResolvedValue(null);
        await act(async () =>
            getLastEditorProps().save({ bibleKey: 'KJV', newLines: [] }),
        );
        await flush();
        expect(h.showSimpleToastMock).toHaveBeenLastCalledWith(
            'Saving Bible Data',
            'Bible Data not found for key KJV',
        );
        expect(h.saveJsonDataToXMLfileMock).not.toHaveBeenCalled();
    });
});
