import { type BibleNote, type BibleNoteFooterActionButton } from 'BibleNote.js';
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
                return;
            }
            const buttonData: BibleNoteFooterActionButton = {
                id: 'khmer-markdown-editor ' + langData.langCode,
                description: `Open in ${langData.langCode} Markdown Editor`,
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
                        <i className={`bi bi-spellcheck`} />
                    </button>
                ),
            };
            bibleNote.prependFooterActionButton(buttonData);
        }
    }, [bibleNote]);
    useAppEffect(() => {
        const onTopButton: BibleNoteFooterActionButton = {
            id: 'toggle-on-top',
            description: 'Toggle always on top',
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
        };
        bibleNote.prependFooterActionButton(onTopButton);
    }, [bibleNote, isOnTop]);
    return <div style={{ display: 'none' }}></div>;
}
