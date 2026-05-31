import { type BibleNote } from 'BibleNote.js';
import { useThemeSource } from '../../others/themeHelpers';
import { useAppEffect, useAppEffectAsync } from '../../helper/debuggerHelpers';
import appProvider from '../../server/appProvider';
import { useIsOnTop } from '../../server/appHelpers';
import { getAllLangsAsync } from '../../lang/langHelpers';
import { useState } from 'react';
import FloatingWidgetComp from '../../app-modal/FloatingWidgetComp';
import BibleItem from '../BibleItem';

function useBibleNoteControl({
    bibleNote,
    setIsShowingBibleLookup,
}: {
    bibleNote: BibleNote;
    setIsShowingBibleLookup: (isShowing: boolean) => void;
}) {
    const [isOnTop, setIsOnTop] = useIsOnTop();
    const themeSource = useThemeSource();
    useAppEffect(() => {
        bibleNote.setColorScheme(themeSource.theme as 'light' | 'dark');
    }, [themeSource.theme]);
    useAppEffectAsync(async () => {
        const langDataList = await getAllLangsAsync();
        for (const langData of langDataList) {
            const editorLink = langData.editorLink;
            if (!editorLink) {
                continue;
            }
            bibleNote.prependFooterActionButton({
                id: 'khmer-markdown-editor ' + langData.langCode,
                description: `Open in ${langData.langCode} Markdown Editor`,
                shortcutKey: 'Ctrl+Shift+Alt+K',
                children: (
                    <button
                        className="action-button"
                        onClick={() => {
                            appProvider.browserUtils.openExternalURL(
                                editorLink,
                            );
                        }}
                        title={`Open in ${langData.langCode} Markdown Editor`}
                        aria-label={`Open in ${langData.langCode} Markdown Editor`}
                        aria-pressed={false}
                    >
                        <i className={'bi bi-spellcheck'} />
                    </button>
                ),
            });
        }
        bibleNote.prependFooterActionButton({
            id: 'bible-lookup',
            description: 'Open Bible Lookup',
            shortcutKey: 'Ctrl+Shift+B',
            children: (
                <button
                    className="action-button"
                    onClick={() => {
                        setIsShowingBibleLookup(true);
                    }}
                    title={'Open Bible Lookup'}
                    aria-label={'Open Bible Lookup'}
                    aria-pressed={false}
                >
                    <i className={'bi bi-book'} />
                </button>
            ),
        });
    }, [bibleNote]);
    useAppEffect(() => {
        // To make sure it on the most left
        setTimeout(() => {
            bibleNote.prependFooterActionButton({
                id: 'toggle-on-top',
                description: 'Toggle always on top',
                shortcutKey: 'Ctrl+Shift+Alt+T',
                children: (
                    <button
                        className="action-button"
                        onClick={() => {
                            setIsOnTop((prev) => !prev);
                        }}
                        title="Toggle Always On Top"
                        aria-label="Toggle Always On Top"
                        aria-pressed={isOnTop}
                    >
                        <i
                            className={`bi bi-${isOnTop ? 'window-stack' : 'window-desktop'}`}
                            style={{
                                color: isOnTop ? 'green' : undefined,
                            }}
                        />
                    </button>
                ),
            });
        }, 200);
    }, [bibleNote, isOnTop]);
}

async function addBibleText(bibleNote: BibleNote) {
    const bibleItem = BibleItem.fromJson({
        id: -1,
        bibleKey: 'KJV',
        target: {
            bookKey: 'GEN',
            chapter: 1,
            verseStart: 1,
            verseEnd: 3,
        },
        metadata: {},
    });
    const text = await bibleItem.toFullText();
    bibleNote.addText(text);
}

function BibleNoteBibleLookupComp({
    bibleNote,
    setIsShowingBibleLookup,
}: Readonly<{
    bibleNote: BibleNote;
    setIsShowingBibleLookup: (isShowing: boolean) => void;
}>) {
    return (
        <FloatingWidgetComp
            onClose={() => setIsShowingBibleLookup(false)}
            options={{
                width: 500,
                height: 400,
                minWidth: 300,
                minHeight: 200,
            }}
        >
            <div
                className="card w-100 h-100 app-overflow-hidden app-focusable"
                tabIndex={0}
                ref={(ele) => {
                    if (ele === null) {
                        return;
                    }
                    // Focus to enable keyboard shortcut in the popup
                    ele.focus();
                }}
            >
                <div className="card-header">
                    <span>Bible Lookup</span>
                </div>
                <div className="card-body">
                    <button
                        onClick={async () => {
                            addBibleText(bibleNote);
                        }}
                    >
                        Add Bible (Genesis 1:1-3 KJV)
                    </button>
                </div>
                <div className="card-body">
                    <button
                        onClick={async () => {
                            bibleNote.addText('^');
                            addBibleText(bibleNote);
                        }}
                    >
                        Add Bible (^ Genesis 1:1-3 KJV)
                    </button>
                </div>
            </div>
        </FloatingWidgetComp>
    );
}
export default function NoteItemEditorPopupComp({
    bibleNote,
}: Readonly<{ bibleNote: BibleNote }>) {
    const [isShowingBibleLookup, setIsShowingBibleLookup] = useState(false);
    useBibleNoteControl({ bibleNote, setIsShowingBibleLookup });
    if (isShowingBibleLookup) {
        return (
            <BibleNoteBibleLookupComp
                bibleNote={bibleNote}
                setIsShowingBibleLookup={setIsShowingBibleLookup}
            />
        );
    }
    return null;
}
