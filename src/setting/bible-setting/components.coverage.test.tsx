// @vitest-environment jsdom

import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The Bible settings page, piece by piece: every module these components
// reach that touches the disk, the network or Monaco is replaced here, and
// the children that are not under test expose their props.
const { state, mocks } = vi.hoisted(() => ({
    state: {
        isDev: false,
        bibleKeysMap: null as Record<string, string> | null,
        isPending: false,
        bibleInfo: null as any,
        isInfoPending: false,
        xmlData: undefined as any,
        editorProps: null as any,
        infoProps: [] as any[],
        downloadProps: new Map<string, any>(),
        progress: {} as Record<string, number>,
        xmlFileKeys: {} as Record<string, string>,
        downloadedList: [] as any[] | null,
        onlineList: [] as any[] | null,
        droppedFiles: [] as File[],
        settingKeys: [] as string[],
        diagnostics: [] as any[],
    },
    mocks: {
        loadBibleKeys: vi.fn(),
        getXMLData: vi.fn(),
        saveXML: vi.fn(),
        updateInfo: vi.fn(),
        addActions: vi.fn(),
        reload: vi.fn(),
        toast: vi.fn(),
        warnKey: vi.fn(),
        warnAny: vi.fn(),
        downloadJSON: vi.fn(),
        initKJV: vi.fn(),
        toBiblePath: vi.fn(),
        clearData: vi.fn(),
        checkDir: vi.fn(),
        deleteDir: vi.fn(),
        showProgress: vi.fn(),
        hideProgress: vi.fn(),
        confirm: vi.fn(),
        startDownload: vi.fn(),
        getAllXMLFileKeys: vi.fn(),
        getDownloaded: vi.fn(),
        getOnline: vi.fn(),
        exportArchive: vi.fn(),
        importArchive: vi.fn(),
        checkIsBundle: vi.fn(),
    },
}));

vi.mock('../../server/appProvider', () => ({
    default: {
        systemUtils: {
            get isDev() {
                return state.isDev;
            },
        },
    },
}));
vi.mock('monaco-editor', () => ({
    json: {
        jsonDefaults: {
            setDiagnosticsOptions: (options: unknown) => {
                state.diagnostics.push(options);
            },
        },
    },
}));
vi.mock('../../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../../others/LoadingComp', () => ({
    default: () => <div className="loading-stub">Loading</div>,
}));
vi.mock('../../helper/appHooks', async () => {
    const { useEffect, useRef, useState } = await import('react');
    return {
        useAppEffect: useEffect,
        useAppEffectAsync: (
            callback: (context: unknown) => Promise<void>,
            deps: unknown[],
            context: unknown,
        ) => {
            useEffect(() => {
                void callback(context);
                // eslint-disable-next-line react-hooks/exhaustive-deps
            }, deps);
        },
        useAppCurrentRef: (value: unknown) => {
            const ref = useRef(value);
            ref.current = value;
            return ref;
        },
        useAppStateAsync: <T,>(
            read: () => Promise<T>,
            deps: unknown[] = [],
        ) => {
            const [value, setValue] = useState<T | undefined>(undefined);
            useEffect(() => {
                void read().then(setValue);
                // eslint-disable-next-line react-hooks/exhaustive-deps
            }, deps);
            return [value, setValue] as const;
        },
    };
});
vi.mock('../../helper/settingHelpers', async () => {
    const { useState } = await import('react');
    return {
        useStateSettingString: (key: string, defaultValue: string) => {
            state.settingKeys.push(key);
            return useState(defaultValue);
        },
    };
});
vi.mock('./bibleXMLHelpers', () => ({
    useBibleXMLKeys: () => ({
        bibleKeysMap: state.bibleKeysMap,
        isPending: state.isPending,
        loadBibleKeys: mocks.loadBibleKeys,
    }),
    useBibleXMLInfo: () => ({
        bibleInfo: state.bibleInfo,
        isPending: state.isInfoPending,
    }),
    getBibleXMLDataFromKey: mocks.getXMLData,
    saveJsonDataToXMLfile: mocks.saveXML,
    updateBibleXMLInfo: mocks.updateInfo,
}));
vi.mock('./BibleXMLEditorComp', () => ({
    BIBLE_EDITOR_BODY_HEIGHT: 450,
    BIBLE_EDITOR_FOOTER_HEIGHT: 35,
    addMonacoBibleInfoActions: mocks.addActions,
    default: (props: any) => {
        state.editorProps = props;
        return <div className="editor-stub">{String(props.editorUri)}</div>;
    },
}));
vi.mock('./BibleXMLBookChapterEditorComp', () => ({
    default: ({ bibleKey }: { bibleKey: string }) => (
        <div className="editor-stub">book-chapter {bibleKey}</div>
    ),
}));
vi.mock('./BibleXMLInfoComp', () => ({
    default: (props: any) => {
        state.infoProps.push(props);
        return <li className="info-stub">{props.bibleKey}</li>;
    },
}));
vi.mock('./BibleXMLImportComp', () => ({
    default: () => <div className="import-stub">Import</div>,
}));
vi.mock('./schemas/bibleSchemaHelpers', () => ({
    infoEditorSchemaHandler: { schema: { $id: 'info-schema' } },
    extraEditorSchemaHandler: { schema: { $id: 'extra-schema' } },
    bookChapterEditorSchemaHandler: { schema: { $id: 'chapter-schema' } },
}));
vi.mock('./schemas/bibleEditorUriHelpers', () => ({
    bibleInfoUri: { toString: () => 'bible-info' },
    bibleExtraUri: { toString: () => 'bible-extra' },
    bibleBookChapterUri: { toString: () => 'book-chapter' },
}));
vi.mock('../settingHelpers', () => ({ forceReloadAppWindows: mocks.reload }));
vi.mock('../../toast/toastHelpers', () => ({ showSimpleToast: mocks.toast }));
vi.mock('./bibleEditorDirtyHelpers', () => ({
    warnIfBibleKeyDirty: mocks.warnKey,
    warnIfAnyBibleEditorDirty: mocks.warnAny,
}));
vi.mock('./bibleXMLDownloadHelpers', () => ({
    downloadBibleJSON: mocks.downloadJSON,
}));
vi.mock('../../helper/bible-helpers/BibleDataReader', () => ({
    bibleDataReader: {
        initKJVBible: mocks.initKJV,
        toBiblePath: mocks.toBiblePath,
        clearBibleDatabaseData: mocks.clearData,
    },
}));
vi.mock('../../helper/bible-helpers/bibleModelHelpers', () => ({
    BIBLE_KJV_KEY: 'KJV',
}));
vi.mock('../../server/fileHelpers', () => ({
    fsCheckDirExist: mocks.checkDir,
    fsDeleteDir: mocks.deleteDir,
    getFileFullName: (file: File) => file.name,
}));
vi.mock('../../progress-bar/progressBarHelpers', () => ({
    showProgressBar: mocks.showProgress,
    hideProgressBar: mocks.hideProgress,
}));
vi.mock('../../popup-widget/popupWidgetHelpers', () => ({
    showAppConfirm: mocks.confirm,
}));
vi.mock('./bibleDownloadingHelpers', () => ({
    useDownloadBible: (bibleInfo: any, onDownloaded: () => void) => {
        state.downloadProps.set(bibleInfo.key, onDownloaded);
        return [
            state.progress[bibleInfo.key] ?? null,
            () => mocks.startDownload(bibleInfo.key),
        ];
    },
}));
vi.mock('./bibleXMLJsonDataHelpers', () => ({
    getAllXMLFileKeys: mocks.getAllXMLFileKeys,
}));
vi.mock('../../helper/bible-helpers/bibleDownloadHelpers', () => ({
    getDownloadedBibleInfoList: mocks.getDownloaded,
    getOnlineBibleInfoList: mocks.getOnline,
}));
vi.mock('./bibleXMLArchiveHelpers', () => ({
    BIBLE_XML_ARCHIVE_DOT_EXTENSION: '.owabdata.tar.gz',
    checkIsBibleXMLArchiveFileFullName: mocks.checkIsBundle,
}));
vi.mock('./bibleXMLArchiveMenuHelpers', () => ({
    handleBibleXMLExporting: mocks.exportArchive,
    handleBibleXMLImporting: mocks.importArchive,
}));
vi.mock('../../others/droppingFileHelpers', () => ({
    readDroppedFiles: async function* () {
        for (const file of state.droppedFiles) {
            yield file;
        }
    },
}));

import BibleXMLArchiveComp from './BibleXMLArchiveComp';
import BibleXMLDataPreviewComp from './BibleXMLDataPreviewComp';
import BibleXMLExtraEditorComp from './BibleXMLExtraEditorComp';
import BibleXMLInfoEditorComp from './BibleXMLInfoEditorComp';
import BibleXMLListComp from './BibleXMLListComp';
import DownloadedBibleItemComp from './DownloadedBibleItemComp';
import OnlineBibleItemComp from './OnlineBibleItemComp';
import SettingBibleComp from './SettingBibleComp';
import SettingBibleJsonComp from './SettingBibleJsonComp';
import SettingDownloadedBibleComp from './SettingDownloadedBibleComp';
import SettingOnlineBibleComp from './SettingOnlineBibleComp';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const kjv: any = { key: 'KJV', title: 'King James', version: 1, locale: 'en' };
const esv: any = { key: 'ESV', title: 'English Standard', version: 1 };

let container: HTMLDivElement;
let root: Root;

async function flush() {
    await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
    });
}

async function render(element: ReactElement) {
    await act(async () => {
        root.render(element);
    });
    await flush();
}

async function click(element: Element | null | undefined) {
    if (!element) {
        throw new Error('Nothing to click');
    }
    await act(async () => {
        element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flush();
}

function findButton(text: string) {
    return Array.from(container.querySelectorAll('button')).find((button) => {
        return button.textContent?.trim() === text;
    });
}

beforeEach(() => {
    state.isDev = false;
    state.bibleKeysMap = null;
    state.isPending = false;
    state.bibleInfo = null;
    state.isInfoPending = false;
    state.xmlData = undefined;
    state.editorProps = null;
    state.infoProps = [];
    state.downloadProps.clear();
    state.progress = {};
    state.xmlFileKeys = {};
    state.downloadedList = [];
    state.onlineList = [];
    state.droppedFiles = [];
    state.settingKeys = [];
    mocks.getXMLData.mockImplementation(async () => state.xmlData);
    mocks.saveXML.mockResolvedValue(true);
    mocks.updateInfo.mockResolvedValue(true);
    mocks.warnKey.mockReturnValue(false);
    mocks.warnAny.mockReturnValue(false);
    mocks.initKJV.mockResolvedValue(undefined);
    mocks.toBiblePath.mockResolvedValue('/bibles/KJV');
    mocks.clearData.mockResolvedValue(undefined);
    mocks.checkDir.mockResolvedValue(true);
    mocks.deleteDir.mockResolvedValue(undefined);
    mocks.confirm.mockResolvedValue(true);
    mocks.getAllXMLFileKeys.mockImplementation(async () => state.xmlFileKeys);
    mocks.getDownloaded.mockImplementation(async () => state.downloadedList);
    mocks.getOnline.mockImplementation(async () => state.onlineList);
    mocks.importArchive.mockResolvedValue(undefined);
    mocks.checkIsBundle.mockImplementation((name: string) =>
        name.endsWith('.owabdata.tar.gz'),
    );
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => {
        root.unmount();
    });
    container.remove();
});

describe('the Bible settings page', () => {
    test('shows the downloaded and online lists only in development', async () => {
        await render(<SettingBibleComp />);
        expect(container.textContent).not.toContain('Downloaded Bible List');
        expect(container.querySelector('.import-stub')).not.toBeNull();
        expect(mocks.getDownloaded).not.toHaveBeenCalled();

        await act(async () => {
            root.unmount();
        });
        root = createRoot(container);
        state.isDev = true;
        await render(<SettingBibleComp />);
        expect(container.textContent).toContain('Downloaded Bible List');
        expect(container.textContent).toContain('Online Bible List');
        expect(mocks.getDownloaded).toHaveBeenCalledOnce();
        expect(mocks.getOnline).toHaveBeenCalledOnce();
    });
});

describe('the Bible Data archive panel', () => {
    test('exports, and imports with a reload of the list once it is done', async () => {
        await render(
            <BibleXMLArchiveComp loadBibleKeys={mocks.loadBibleKeys} />,
        );
        expect(container.querySelector('code')!.textContent).toBe(
            '.owabdata.tar.gz',
        );
        await click(findButton('Export Bible Data'));
        expect(mocks.exportArchive).toHaveBeenCalledOnce();

        await click(findButton('Import Bible Data'));
        const [filePath, onImported] = mocks.importArchive.mock.calls[0];
        expect(filePath).toBeUndefined();
        expect(mocks.loadBibleKeys).not.toHaveBeenCalled();
        onImported();
        expect(mocks.loadBibleKeys).toHaveBeenCalledOnce();
    });
});

describe('dropping a Bible Data bundle onto the XML section', () => {
    function dispatchDrag(type: string, items: { kind: string }[]) {
        const section = container.firstElementChild as HTMLElement;
        const event = new Event(type, { bubbles: true, cancelable: true });
        Object.defineProperty(event, 'dataTransfer', {
            value: { items, files: [] },
        });
        section.dispatchEvent(event);
        return section;
    }

    function toFile(name: string, appFilePath?: string) {
        const file = new File(['x'], name);
        if (appFilePath !== undefined) {
            (file as any).appFilePath = appFilePath;
        }
        return file;
    }

    test('dims only for a drag of files, and brightens again on leave', async () => {
        const { default: SettingBibleXMLComp } =
            await import('./SettingBibleXMLComp');
        await render(<SettingBibleXMLComp />);
        let section!: HTMLElement;
        await act(async () => {
            section = dispatchDrag('dragover', [{ kind: 'string' }]);
        });
        expect(section.style.opacity).toBe('');
        await act(async () => {
            dispatchDrag('dragover', []);
        });
        expect(section.style.opacity).toBe('');
        await act(async () => {
            dispatchDrag('dragover', [{ kind: 'file' }, { kind: 'file' }]);
        });
        expect(section.style.opacity).toBe('0.5');
        await act(async () => {
            dispatchDrag('dragleave', []);
        });
        expect(section.style.opacity).toBe('1');
    });

    test('imports the first bundle that has a real path, and only that one', async () => {
        const { default: SettingBibleXMLComp } =
            await import('./SettingBibleXMLComp');
        await render(<SettingBibleXMLComp />);
        state.droppedFiles = [
            toFile('notes.txt', '/drop/notes.txt'),
            toFile('copy.owabdata.tar.gz'),
            toFile('first.owabdata.tar.gz', '/drop/first.owabdata.tar.gz'),
            toFile('second.owabdata.tar.gz', '/drop/second.owabdata.tar.gz'),
        ];
        let section!: HTMLElement;
        await act(async () => {
            dispatchDrag('dragover', [{ kind: 'file' }]);
            section = dispatchDrag('drop', [{ kind: 'file' }]);
        });
        await flush();
        expect(section.style.opacity).toBe('1');
        expect(mocks.importArchive).toHaveBeenCalledOnce();
        const [filePath, onImported] = mocks.importArchive.mock.calls[0];
        expect(filePath).toBe('/drop/first.owabdata.tar.gz');
        onImported();
        expect(mocks.loadBibleKeys).toHaveBeenCalledOnce();
    });

    test('a drop of nothing it owns imports nothing', async () => {
        const { default: SettingBibleXMLComp } =
            await import('./SettingBibleXMLComp');
        await render(<SettingBibleXMLComp />);
        state.droppedFiles = [toFile('song.mp3', '/drop/song.mp3')];
        await act(async () => {
            dispatchDrag('drop', [{ kind: 'file' }]);
        });
        await flush();
        expect(mocks.importArchive).not.toHaveBeenCalled();
    });
});

describe('the Bible XML list', () => {
    test('shows a spinner while the keys load', async () => {
        await render(
            <BibleXMLListComp
                isPending
                bibleKeysMap={null}
                loadBibleKeys={mocks.loadBibleKeys}
            />,
        );
        expect(container.querySelector('.loading-stub')).not.toBeNull();
    });

    test('an empty list offers to create the KJV, then reloads', async () => {
        await render(
            <BibleXMLListComp
                isPending={false}
                bibleKeysMap={{}}
                loadBibleKeys={mocks.loadBibleKeys}
            />,
        );
        expect(container.textContent).toContain('No Bible XML files');
        await click(findButton('Create KJV Bible XML'));
        expect(mocks.initKJV).toHaveBeenCalledOnce();
        expect(mocks.loadBibleKeys).toHaveBeenCalledOnce();
    });

    test('lists the bibles in order and keeps the KJV offer when the KJV is gone', async () => {
        await render(
            <BibleXMLListComp
                isPending={false}
                bibleKeysMap={{ NIV: '/x/NIV.xml', ESV: '/x/ESV.xml' }}
                loadBibleKeys={mocks.loadBibleKeys}
            />,
        );
        expect(
            Array.from(container.querySelectorAll('.info-stub')).map(
                (item) => item.textContent,
            ),
        ).toEqual(['ESV', 'NIV']);
        expect(state.infoProps.at(-1)).toMatchObject({
            bibleKey: 'NIV',
            filePath: '/x/NIV.xml',
        });
        expect(findButton('Create KJV Bible XML')).toBeDefined();
    });

    test('no KJV offer once the KJV is listed', async () => {
        await render(
            <BibleXMLListComp
                isPending={false}
                bibleKeysMap={{ KJV: '/x/KJV.xml' }}
                loadBibleKeys={mocks.loadBibleKeys}
            />,
        );
        expect(findButton('Create KJV Bible XML')).toBeUndefined();
    });

    test('refresh is refused while an editor holds unsaved changes', async () => {
        await render(
            <BibleXMLListComp
                isPending={false}
                bibleKeysMap={{ KJV: '/x/KJV.xml' }}
                loadBibleKeys={mocks.loadBibleKeys}
            />,
        );
        mocks.warnAny.mockReturnValue(true);
        await click(findButton('Refresh'));
        expect(mocks.warnAny).toHaveBeenCalledWith(
            'Save or discard unsaved Bible changes before refreshing.',
        );
        expect(mocks.loadBibleKeys).not.toHaveBeenCalled();

        mocks.warnAny.mockReturnValue(false);
        await click(findButton('Refresh'));
        expect(mocks.loadBibleKeys).toHaveBeenCalledOnce();
    });
});

describe('the Extra editor', () => {
    const xmlData = {
        info: { key: 'KJV' },
        newLines: ['GEN 1:1'],
        newLinesTitleMap: { 'GEN 1:1': [] },
        customVersesMap: { 'GEN 1:2': [] },
    };

    test('loads, then hands the editor only the extra parts of the Bible', async () => {
        let resolve!: (value: unknown) => void;
        mocks.getXMLData.mockReturnValueOnce(
            new Promise((done) => {
                resolve = done;
            }),
        );
        await render(<BibleXMLExtraEditorComp bibleKey="KJV" />);
        expect(container.querySelector('.loading-stub')).not.toBeNull();
        await act(async () => {
            resolve(xmlData);
        });
        expect(container.textContent).toBe('bible-extra');
        expect(state.editorProps.id).toBe('KJV');
        expect(state.editorProps.jsonData).toEqual({
            bibleKey: 'KJV',
            newLines: ['GEN 1:1'],
            newLinesTitleMap: { 'GEN 1:1': [] },
            customVersesMap: { 'GEN 1:2': [] },
        });
        expect(state.editorProps.jsonDataSchema.schema.$id).toBe(
            'extra-schema',
        );
        // Nothing to set up on the Monaco store for this editor.
        expect(state.editorProps.onStore({})).toBeUndefined();
    });

    test('renders nothing for a Bible with no data', async () => {
        state.xmlData = null;
        await render(<BibleXMLExtraEditorComp bibleKey="KJV" />);
        expect(container.innerHTML).toBe('');
    });

    test('saves into the XML and reloads the windows', async () => {
        state.xmlData = xmlData;
        await render(<BibleXMLExtraEditorComp bibleKey="KJV" />);
        await act(async () => {
            state.editorProps.save({
                bibleKey: 'KJV',
                newLines: ['EXO 1:1'],
                newLinesTitleMap: {},
                customVersesMap: {},
            });
        });
        await flush();
        expect(mocks.saveXML).toHaveBeenCalledWith({
            info: { key: 'KJV' },
            newLines: ['EXO 1:1'],
            newLinesTitleMap: {},
            customVersesMap: {},
        });
        expect(mocks.reload).toHaveBeenCalledOnce();
    });

    test('a failed save does not reload', async () => {
        state.xmlData = xmlData;
        mocks.saveXML.mockResolvedValue(false);
        await render(<BibleXMLExtraEditorComp bibleKey="KJV" />);
        await act(async () => {
            state.editorProps.save({ bibleKey: 'KJV', newLines: [] });
        });
        await flush();
        expect(mocks.saveXML).toHaveBeenCalledOnce();
        expect(mocks.reload).not.toHaveBeenCalled();
    });

    test('refuses to save under another key, or once the Bible is gone', async () => {
        state.xmlData = xmlData;
        await render(<BibleXMLExtraEditorComp bibleKey="KJV" />);
        await act(async () => {
            state.editorProps.save({ bibleKey: 'ESV', newLines: [] });
        });
        expect(mocks.toast).toHaveBeenCalledWith(
            'Saving Bible Data',
            'Invalid Bible Key ESV',
        );

        state.xmlData = null;
        await act(async () => {
            state.editorProps.save({ bibleKey: 'KJV', newLines: [] });
        });
        await flush();
        expect(mocks.toast).toHaveBeenCalledWith(
            'Saving Bible Data',
            'Bible Data not found for key KJV',
        );
        expect(mocks.saveXML).not.toHaveBeenCalled();
    });
});

describe('the Info editor', () => {
    const bibleInfo = {
        key: 'KJV',
        title: 'King James',
        booksAvailable: ['GEN'],
    };

    test('shows a spinner, then nothing for a Bible with no info', async () => {
        state.isInfoPending = true;
        await render(<BibleXMLInfoEditorComp bibleKey="KJV" />);
        expect(container.querySelector('.loading-stub')).not.toBeNull();
        state.isInfoPending = false;
        await render(<BibleXMLInfoEditorComp bibleKey="KJV" />);
        expect(container.innerHTML).toBe('');
    });

    test('edits the info without the computed list of books', async () => {
        state.bibleInfo = bibleInfo;
        await render(<BibleXMLInfoEditorComp bibleKey="KJV" />);
        expect(container.textContent).toBe('bible-info');
        expect(state.editorProps.jsonData).toEqual({
            key: 'KJV',
            title: 'King James',
            booksAvailable: undefined,
        });
        expect(state.editorProps.jsonDataSchema.schema.$id).toBe('info-schema');
    });

    test('a save writes the new info over the old and reloads the windows', async () => {
        state.bibleInfo = bibleInfo;
        await render(<BibleXMLInfoEditorComp bibleKey="KJV" />);
        const newInfo = { ...bibleInfo, title: 'KJV 1611' };
        await act(async () => {
            state.editorProps.save(newInfo);
        });
        await flush();
        expect(mocks.updateInfo).toHaveBeenCalledWith(bibleInfo, newInfo);
        expect(mocks.reload).toHaveBeenCalledOnce();

        mocks.updateInfo.mockResolvedValue(false);
        await act(async () => {
            state.editorProps.save(newInfo);
        });
        await flush();
        expect(mocks.reload).toHaveBeenCalledOnce();
    });

    test('a save that arrives after the info went away writes nothing', async () => {
        state.bibleInfo = bibleInfo;
        await render(<BibleXMLInfoEditorComp bibleKey="KJV" />);
        const { save } = state.editorProps;
        state.bibleInfo = null;
        await render(<BibleXMLInfoEditorComp bibleKey="KJV" />);
        await act(async () => {
            save({ ...bibleInfo, title: 'late' });
        });
        expect(mocks.updateInfo).not.toHaveBeenCalled();
    });

    test('the Monaco actions read and patch the JSON being edited', async () => {
        state.bibleInfo = bibleInfo;
        await render(<BibleXMLInfoEditorComp bibleKey="KJV" />);
        let text = JSON.stringify({ key: 'KJV', title: 'Old' });
        const editorStore = {
            editorInstance: { getValue: () => text },
            replaceValue: vi.fn(),
        };
        state.editorProps.onStore(editorStore);
        const [store, getBibleInfo, setPartialBibleInfo] =
            mocks.addActions.mock.calls[0];
        expect(store).toBe(editorStore);
        expect(getBibleInfo()).toEqual({ key: 'KJV', title: 'Old' });

        setPartialBibleInfo({ title: 'New' });
        expect(editorStore.replaceValue).toHaveBeenCalledWith(
            JSON.stringify({ key: 'KJV', title: 'New' }, null, 4),
        );

        text = 'null';
        setPartialBibleInfo({ title: 'Ignored' });
        expect(editorStore.replaceValue).toHaveBeenCalledOnce();
    });
});

describe('the XML data preview tabs', () => {
    test('registered the three JSON schemas with Monaco at load', () => {
        expect(state.diagnostics).toHaveLength(1);
        const [options] = state.diagnostics;
        expect(options.validate).toBe(true);
        expect(
            options.schemas.map((schema: any) => [
                schema.uri,
                schema.fileMatch,
            ]),
        ).toEqual([
            ['info-schema', ['bible-info']],
            ['extra-schema', ['bible-extra']],
            ['chapter-schema', ['book-chapter']],
        ]);
    });

    test('opens on Info, remembered per Bible, and switches tab', async () => {
        state.bibleInfo = { key: 'KJV' };
        state.xmlData = { newLines: [], newLinesTitleMap: {} };
        await render(<BibleXMLDataPreviewComp bibleKey="KJV" />);
        expect(state.settingKeys).toContain(
            'bible-setting-KJV-xml-data-editing-type',
        );
        expect(container.querySelector('.editor-stub')!.textContent).toBe(
            'bible-info',
        );
        expect(findButton('Info')!.className).toContain('btn-light');
        expect(findButton('Extra')!.className).toContain('btn-primary');
        expect(
            (container.querySelector('.card-body') as HTMLElement).style
                .minHeight,
        ).toBe('488px');

        await click(findButton('Book Chapter'));
        expect(container.querySelector('.editor-stub')!.textContent).toBe(
            'book-chapter KJV',
        );
        await click(findButton('Extra'));
        expect(container.querySelector('.editor-stub')!.textContent).toBe(
            'bible-extra',
        );
        expect(mocks.warnKey).toHaveBeenCalledWith(
            'KJV',
            'Save or discard unsaved Bible changes before switching tabs.',
        );
    });

    test('will not switch away from an editor with unsaved changes', async () => {
        state.bibleInfo = { key: 'KJV' };
        mocks.warnKey.mockReturnValue(true);
        await render(<BibleXMLDataPreviewComp bibleKey="KJV" />);
        await click(findButton('Book Chapter'));
        expect(container.querySelector('.editor-stub')!.textContent).toBe(
            'bible-info',
        );
        // Pressing the tab already open asks nothing.
        mocks.warnKey.mockClear();
        await click(findButton('Info'));
        expect(mocks.warnKey).not.toHaveBeenCalled();
    });

    test('downloads the Bible as JSON', async () => {
        await render(<BibleXMLDataPreviewComp bibleKey="KJV" />);
        await click(findButton('Download'));
        expect(mocks.downloadJSON).toHaveBeenCalledWith('KJV');
    });
});

describe('the downloaded Bible list', () => {
    test('shows a spinner, a failure, and an empty list', async () => {
        const setList = vi.fn();
        await render(
            <SettingDownloadedBibleComp
                onlineBibleInfoList={[]}
                downloadedBibleInfoList={null}
                setDownloadedBibleInfoList={setList}
            />,
        );
        expect(container.querySelector('.loading-stub')).not.toBeNull();
        await render(
            <SettingDownloadedBibleComp
                onlineBibleInfoList={[]}
                downloadedBibleInfoList={undefined}
                setDownloadedBibleInfoList={setList}
            />,
        );
        expect(container.textContent).toBe(
            'Unable to get downloaded bible list',
        );
        await render(
            <SettingDownloadedBibleComp
                onlineBibleInfoList={[]}
                downloadedBibleInfoList={[]}
                setDownloadedBibleInfoList={setList}
            />,
        );
        expect(container.textContent).toContain('No bible downloaded');
        await click(findButton('Refresh'));
        expect(setList).toHaveBeenCalledWith(null);
    });

    test('offers an update only when the online copy is as new or newer', async () => {
        await render(
            <SettingDownloadedBibleComp
                onlineBibleInfoList={[
                    { ...kjv, version: 2, filePath: 'https://x/KJV.zip' },
                    { ...esv, version: 0, filePath: 'https://x/ESV.zip' },
                ]}
                downloadedBibleInfoList={[kjv, esv] as any}
                setDownloadedBibleInfoList={vi.fn()}
            />,
        );
        const items = Array.from(container.querySelectorAll('li'));
        expect(
            items.map((item) => item.querySelector('span')!.textContent),
        ).toEqual(['(KJV) King James', '(ESV) English Standard']);
        expect(items[0].textContent).toContain('Update');
        expect(items[1].textContent).not.toContain('Update');
    });

    test('updating turns the row into a download, and a finished one reloads the list', async () => {
        const setList = vi.fn();
        const list = [{ ...kjv }];
        await render(
            <SettingDownloadedBibleComp
                onlineBibleInfoList={[
                    { ...kjv, filePath: 'https://x/KJV.zip' },
                ]}
                downloadedBibleInfoList={list as any}
                setDownloadedBibleInfoList={setList}
            />,
        );
        await click(findButton('Update'));
        const [newList] = setList.mock.calls[0];
        expect(newList).toHaveLength(1);
        expect(newList[0]).toMatchObject({
            key: 'KJV',
            isDownloading: true,
            isUpdatable: true,
            filePath: 'https://x/KJV.zip',
        });

        await render(
            <SettingDownloadedBibleComp
                onlineBibleInfoList={[
                    { ...kjv, filePath: 'https://x/KJV.zip' },
                ]}
                downloadedBibleInfoList={newList}
                setDownloadedBibleInfoList={setList}
            />,
        );
        expect(findButton('Download')).toBeDefined();
        state.downloadProps.get('KJV')();
        expect(setList).toHaveBeenLastCalledWith(null);
    });

    test('a Bible deleted from its row reloads the list', async () => {
        const setList = vi.fn();
        await render(
            <SettingDownloadedBibleComp
                onlineBibleInfoList={[]}
                downloadedBibleInfoList={[{ ...kjv }] as any}
                setDownloadedBibleInfoList={setList}
            />,
        );
        expect(container.textContent).not.toContain('Update');
        await click(findButton('Delete'));
        expect(mocks.deleteDir).toHaveBeenCalledWith('/bibles/KJV');
        expect(setList).toHaveBeenCalledExactlyOnceWith(null);
    });
});

describe('deleting a downloaded Bible', () => {
    async function renderItem(onDeleted = vi.fn()) {
        await render(
            <DownloadedBibleItemComp
                bibleInfo={{ ...kjv, isUpdatable: false } as any}
                onDeleted={onDeleted}
                onUpdate={vi.fn()}
            />,
        );
        return onDeleted;
    }

    test('asks first, by the Bible title, and a No deletes nothing', async () => {
        mocks.confirm.mockResolvedValue(false);
        const onDeleted = await renderItem();
        await click(findButton('Delete'));
        expect(mocks.confirm).toHaveBeenCalledWith(
            'Delete Bible',
            'Are you sure to delete bible "King James"?',
            { cancelButtonLabel: 'No', confirmButtonLabel: 'Yes' },
        );
        expect(mocks.deleteDir).not.toHaveBeenCalled();
        expect(onDeleted).not.toHaveBeenCalled();
    });

    test('deletes the folder and its database, under a progress bar', async () => {
        const onDeleted = await renderItem();
        await click(findButton('Delete'));
        expect(mocks.showProgress).toHaveBeenCalledWith(
            'Deleting bible "King James"',
        );
        expect(mocks.toBiblePath).toHaveBeenCalledWith('KJV');
        expect(mocks.deleteDir).toHaveBeenCalledWith('/bibles/KJV');
        expect(mocks.clearData).toHaveBeenCalledWith('KJV');
        expect(mocks.hideProgress).toHaveBeenCalledWith(
            'Deleting bible "King James"',
        );
        expect(onDeleted).toHaveBeenCalledOnce();
    });

    test('a Bible with no folder on disk is simply taken off the list', async () => {
        mocks.checkDir.mockResolvedValue(false);
        const onDeleted = await renderItem();
        await click(findButton('Delete'));
        expect(mocks.deleteDir).not.toHaveBeenCalled();
        expect(mocks.clearData).not.toHaveBeenCalled();
        expect(onDeleted).toHaveBeenCalledOnce();

        mocks.toBiblePath.mockResolvedValue(null);
        await click(findButton('Delete'));
        expect(mocks.checkDir).toHaveBeenCalledOnce();
        expect(onDeleted).toHaveBeenCalledTimes(2);
    });

    // Found by UT-83 (2026-11-03): the progress bar was hidden only on
    // success, so a delete that threw left "Deleting bible ..." up for good.
    test('a failed delete says why, keeps the Bible listed and takes the progress bar down', async () => {
        mocks.deleteDir.mockRejectedValue(new Error('access denied'));
        const onDeleted = await renderItem();
        await click(findButton('Delete'));
        expect(mocks.toast).toHaveBeenCalledWith('Deleting', 'access denied');
        expect(onDeleted).not.toHaveBeenCalled();
        expect(mocks.hideProgress).toHaveBeenCalledExactlyOnceWith(
            'Deleting bible "King James"',
        );
    });
});

describe('the online Bible list', () => {
    test('waits for both the list and the XML keys', async () => {
        state.isPending = true;
        state.bibleKeysMap = {};
        await render(
            <SettingOnlineBibleComp
                downloadedBibleInfoList={[]}
                onlineBibleInfoList={[]}
                setOnlineBibleInfoList={vi.fn()}
                setDownloadedBibleInfoList={vi.fn()}
            />,
        );
        expect(container.querySelector('.loading-stub')).not.toBeNull();
        state.isPending = false;
        await render(
            <SettingOnlineBibleComp
                downloadedBibleInfoList={[]}
                onlineBibleInfoList={null}
                setOnlineBibleInfoList={vi.fn()}
                setDownloadedBibleInfoList={vi.fn()}
            />,
        );
        expect(container.querySelector('.loading-stub')).not.toBeNull();
    });

    test('a list that could not be read offers a refresh of both', async () => {
        const setOnline = vi.fn();
        state.bibleKeysMap = {};
        await render(
            <SettingOnlineBibleComp
                downloadedBibleInfoList={[]}
                onlineBibleInfoList={undefined}
                setOnlineBibleInfoList={setOnline}
                setDownloadedBibleInfoList={vi.fn()}
            />,
        );
        expect(container.textContent).toContain(
            'Unable to get online bible list',
        );
        await click(findButton('Refresh'));
        expect(setOnline).toHaveBeenCalledWith(null);
        expect(mocks.loadBibleKeys).toHaveBeenCalledOnce();

        state.bibleKeysMap = null;
        await render(
            <SettingOnlineBibleComp
                downloadedBibleInfoList={[]}
                onlineBibleInfoList={[]}
                setOnlineBibleInfoList={setOnline}
                setDownloadedBibleInfoList={vi.fn()}
            />,
        );
        expect(container.textContent).toContain(
            'Unable to get online bible list',
        );
    });

    test('lists only downloadable Bibles not downloaded yet', async () => {
        state.bibleKeysMap = { ESV: '/x/ESV.xml' };
        const setDownloaded = vi.fn();
        await render(
            <SettingOnlineBibleComp
                downloadedBibleInfoList={[kjv] as any}
                onlineBibleInfoList={
                    [
                        { ...kjv, filePath: 'https://x/KJV.zip' },
                        { ...esv, filePath: 'https://x/ESV.zip' },
                        { key: 'NIV', title: 'NIV', version: 1 },
                    ] as any
                }
                setOnlineBibleInfoList={vi.fn()}
                setDownloadedBibleInfoList={setDownloaded}
            />,
        );
        const items = Array.from(container.querySelectorAll('li'));
        expect(
            items.map((item) => item.querySelector('span')!.textContent),
        ).toEqual(['English Standard (ESV)']);
        // Already in XML: the row says so and cannot be downloaded.
        expect(items[0].querySelector('div')!.getAttribute('title')).toBe(
            'Already in XML',
        );
        expect(findButton('Download')!.disabled).toBe(true);

        state.downloadProps.get('ESV')();
        expect(setDownloaded).toHaveBeenCalledWith(null);
    });

    test('the whole list shows while nothing is downloaded yet', async () => {
        state.bibleKeysMap = {};
        await render(
            <SettingOnlineBibleComp
                downloadedBibleInfoList={undefined}
                onlineBibleInfoList={
                    [{ ...kjv, filePath: 'https://x/KJV.zip' }] as any
                }
                setOnlineBibleInfoList={vi.fn()}
                setDownloadedBibleInfoList={vi.fn()}
            />,
        );
        expect(container.querySelectorAll('li')).toHaveLength(1);
    });
});

describe('downloading one online Bible', () => {
    test('a Bible not yet in XML starts downloading', async () => {
        await render(
            <OnlineBibleItemComp
                bibleInfo={esv as any}
                onDownloaded={vi.fn()}
            />,
        );
        const button = findButton('Download')!;
        expect(button.disabled).toBe(false);
        await click(button);
        expect(mocks.getAllXMLFileKeys).toHaveBeenCalledOnce();
        expect(mocks.startDownload).toHaveBeenCalledWith('ESV');
        expect(mocks.toast).not.toHaveBeenCalled();
    });

    test('a Bible that became XML meanwhile is not downloaded again', async () => {
        state.xmlFileKeys = { ESV: '/x/ESV.xml' };
        const refresh = vi.fn();
        await render(
            <OnlineBibleItemComp
                bibleInfo={esv as any}
                onDownloaded={vi.fn()}
                refresh={refresh}
            />,
        );
        await click(findButton('Download'));
        expect(mocks.toast).toHaveBeenCalledWith(
            'Already in XML',
            'This bible is already in XML',
        );
        expect(refresh).toHaveBeenCalledOnce();
        expect(mocks.startDownload).not.toHaveBeenCalled();

        // Without a refresher it still only warns.
        await render(
            <OnlineBibleItemComp
                bibleInfo={esv as any}
                onDownloaded={vi.fn()}
            />,
        );
        await click(findButton('Download'));
        expect(mocks.toast).toHaveBeenCalledTimes(2);
        expect(mocks.startDownload).not.toHaveBeenCalled();
    });

    test('shows the progress bar in place of the button while downloading', async () => {
        state.progress = { ESV: 0.42 };
        await render(
            <OnlineBibleItemComp
                bibleInfo={esv as any}
                onDownloaded={vi.fn()}
            />,
        );
        expect(findButton('Download')).toBeUndefined();
        const bar = container.querySelector('[role="progressbar"]')!;
        expect((bar as HTMLElement).style.width).toBe('42%');
        expect(bar.getAttribute('aria-valuenow')).toBe('42');
    });
});

describe('the development JSON lists', () => {
    test('read both lists once, and again on a refresh', async () => {
        state.downloadedList = [kjv];
        state.onlineList = [
            { ...kjv, filePath: 'https://x/KJV.zip' },
            { ...esv, filePath: 'https://x/ESV.zip' },
        ];
        state.bibleKeysMap = {};
        await render(<SettingBibleJsonComp />);
        expect(container.textContent).toContain('(KJV) King James');
        expect(container.textContent).toContain('English Standard (ESV)');
        expect(mocks.getDownloaded).toHaveBeenCalledOnce();
        expect(mocks.getOnline).toHaveBeenCalledOnce();

        const [downloadedRefresh, onlineRefresh] = Array.from(
            container.querySelectorAll('button'),
        ).filter((button) => button.textContent?.trim() === 'Refresh');
        await click(downloadedRefresh);
        expect(mocks.getDownloaded).toHaveBeenCalledTimes(2);
        await click(onlineRefresh);
        expect(mocks.getOnline).toHaveBeenCalledTimes(2);
    });

    test('a list that cannot be read says so', async () => {
        state.downloadedList = null;
        state.onlineList = null;
        state.bibleKeysMap = {};
        await render(<SettingBibleJsonComp />);
        expect(container.textContent).toContain(
            'Unable to get downloaded bible list',
        );
        expect(container.textContent).toContain(
            'Unable to get online bible list',
        );
    });
});
