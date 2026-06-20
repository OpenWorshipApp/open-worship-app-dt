declare module 'BibleNote.js' {
    type EditorFontFamily = readonly [fontFamily: string, languageCode: string];

    interface BibleNoteFooterActionButton {
        id: string;
        description?: string;
        shortcutKey?: string;
        children: React.ReactNode;
    }

    interface BibleNoteStorageManager {
        setSetting(key: string, value: unknown): Promise<void>;
        getSetting<T = unknown>(key: string): Promise<T | null>;
        deleteSetting(key: string): Promise<void>;
    }

    type MentionedBibleDataType = {
        title: string;
        fullText: string;
        style?: React.CSSProperties;
    };

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
        print(): void;
        isOnApp?: boolean;
        isMinimize?: boolean;
        shortToVerseData?: (
            shortVerse: string,
        ) => Promise<MentionedBibleDataType | null>;
        verseFullTextToListShorts?: (
            fullText: string,
        ) => Promise<string[] | null>;
        changeBibleKey?: (
            event: ReactMouseEvent<HTMLButtonElement>,
            fullText: string,
        ) => Promise<MentionedBibleDataType | null>;
        excalidrawClearLibrariesFileList?: () => void;
        excalidrawLoadLibrariesFileList?: () => string[];
        excalidrawSaveLibrariesFile?: (librariesFile: string) => void;
    }

    interface BibleNoteRenderOptions {
        settings?: unknown;
        settingsContainerElement?: Element | DocumentFragment;
    }

    export class BibleNote {
        static VERSION: string;

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
