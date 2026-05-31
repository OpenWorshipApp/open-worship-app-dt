import { type BibleNote } from 'BibleNote.js';
import { useThemeSource } from '../../others/themeHelpers';
import { useAppEffect, useAppEffectAsync } from '../../helper/debuggerHelpers';
import appProvider from '../../server/appProvider';
import { useIsOnTop } from '../../server/appHelpers';
import { getAllLangsAsync } from '../../lang/langHelpers';

export default function NoteItemEditorPopupComp({
    bibleNote,
}: Readonly<{ bibleNote: BibleNote }>) {
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
                        console.log('open bible lookup');
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
    return <div style={{ display: 'none' }}></div>;
}
