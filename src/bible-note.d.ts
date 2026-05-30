declare module 'BibleNote.js' {
    type EditorFontFamily = readonly [fontFamily: string, languageCode: string];

    interface BibleNoteFooterActionButton {
        id: string;
        description: string;
        children: React.ReactNode;
    }

    interface BibleNoteStorageManager {
        setSetting(key: string, value: unknown): Promise<void>;
        getSetting<T = unknown>(key: string): Promise<T | null>;
        deleteSetting(key: string): Promise<void>;
    }

    interface BibleNoteOptions {
        getLangCode: (text: string) => string;
        editorExtraFontFamilies: ReadonlyArray<ExtraFontFamilyOption>;
        excalidrawLibraryItems?: LibraryItems;
        stickyNoteExtraFontFamilies: ReadonlyArray<string>;
        storageManager: BibleNoteStorageManager;
        saveData: (data: string) => Promise<void> | void;
        loadData: () => Promise<string | null> | string | null;
        resolveFilePath?: FilePathResolver;
        revealFile?: (filePath: string) => void;
    }

    interface BibleNoteRenderOptions {
        settings?: unknown;
        settingsContainerElement?: Element | DocumentFragment;
    }

    export class BibleNote {
        constructor(options: BibleNoteOptions);

        content: string;

        addText(text: string): void;
        render(element: HTMLElement, options?: BibleNoteRenderOptions): void;
        setColorScheme(mode: 'light' | 'dark'): void;
        unmount(): void;
        prependFooterActionButton(button: BibleNoteFooterActionButton): void;
        getFooterActionButton(id: string): BibleNoteFooterActionButton | null;
        getIsFocusing(): boolean;
    }
}
