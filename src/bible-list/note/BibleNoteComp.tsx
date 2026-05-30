import { useMemo, type CSSProperties } from 'react';

import type NoteItem from './NoteItem';
import type Note from './Note';
import { useFileSourceEvents } from '../../helper/dirSourceHelpers';

import { getSetting, setSetting } from '../../helper/settingHelpers';
import { useThemeSource } from '../../others/themeHelpers';
import type { BibleNote } from 'BibleNote.js';

const AppBibleNote = (globalThis as any).AppBibleNote as typeof BibleNote;

const stickyNoteExtraFontFamilies = ['Fasthand'];
const editorExtraFontFamilies: ReadonlyArray<[string, string]> = [
    ['Battambang', 'km'],
];
const storageManager = {
    deleteSetting(key: string) {
        setSetting(key, null);
    },
    getSetting(key: string) {
        return getSetting(key);
    },
    setSetting(key: string, value: any) {
        setSetting(key, value);
    },
};

async function resolveLocalFilePath(_file: any) {
    return null;
}

function getLangCode(text: string): string {
    if (/[\u1780-\u17FF]/u.test(text)) {
        return 'km';
    }
    return 'en';
}

export default function BibleNoteComp({
    note,
    noteItem,
    extraStyle,
}: Readonly<{
    note: Note;
    noteItem: NoteItem;
    title?: string;
    extraStyle?: CSSProperties;
}>) {
    const themeSource = useThemeSource();
    const bibleNote = useMemo(() => {
        async function saveData(data: string) {
            if (data === noteItem.content) {
                return;
            }
            noteItem.content = data;
            await note.updateAndSaveNoteItem(noteItem, true);
        }

        function loadData() {
            return noteItem.content || null;
        }

        return new AppBibleNote({
            getLangCode,
            editorExtraFontFamilies,
            loadData,
            saveData,
            storageManager: storageManager as any,
            stickyNoteExtraFontFamilies,
            resolveFilePath: resolveLocalFilePath,
        });
    }, [note, noteItem]);

    bibleNote.setColorScheme(themeSource.theme as 'light' | 'dark');

    useFileSourceEvents(
        ['update'],
        async () => {
            await new Promise((resolve) => {
                setTimeout(resolve, 2_000);
            });
            await note.reload();
            const newNoteItem = note.getItemById(noteItem.id);
            if (
                newNoteItem === null ||
                newNoteItem.content === bibleNote.content
            ) {
                return;
            }
            bibleNote.content = newNoteItem.content;
        },
        [note, noteItem, bibleNote],
        note.filePath,
    );

    return (
        <div
            className="w-100 h-100 app-overflow-hidden"
            style={{
                ...extraStyle,
            }}
            ref={(el) => {
                if (el === null) {
                    return;
                }
                bibleNote.render(el);
                return () => {
                    bibleNote.unmount();
                };
            }}
        />
    );
}
