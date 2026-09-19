import type { BibleNote } from 'bible-note';

import appProvider from '../../server/appProvider';
import { getAllLangsAsync, tran } from '../../lang/langHelpers';
import { useIsOnTop } from '../../server/appHelpers';
import { showBibleKeyOption } from '../../bible-lookup/BibleKeySelectionComp';
import { useThemeSource } from '../../others/themeHelpers';
import { useAppEffect, useAppEffectAsync } from '../../helper/appHooks';
import { useWatchStateSettingString } from '../../helper/settingHelpers';
import { BIBLE_KEY_SETTING_NAME } from './bibleNoteHelpers';
import { BIBLE_KJV_KEY } from '../../helper/bible-helpers/bibleModelHelpers';
import { useBibleFontFamily } from '../../helper/bible-helpers/bibleStyleHelpers';

export function useBibleNoteControl({
    bibleNote,
    setIsShowingBibleLookup,
    isReadOnly = false,
}: {
    bibleNote: BibleNote;
    setIsShowingBibleLookup: (isShowing: boolean) => void;
    isReadOnly?: boolean;
}) {
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
            const editorTitle =
                `${tran('Open in Markdown Editor')}` +
                ` (${langData.langCode})`;
            bibleNote.prependFooterActionButton({
                id: 'khmer-markdown-editor ' + langData.langCode,
                description: editorTitle,
                shortcutKey: 'Ctrl+Shift+Alt+K',
                children: (
                    <button
                        className="action-button"
                        onClick={() => {
                            appProvider.browserUtils.openExternalURL(
                                editorLink,
                            );
                        }}
                        title={editorTitle}
                        aria-label={editorTitle}
                        aria-pressed={false}
                    >
                        <i className={'bi bi-spellcheck'} />
                    </button>
                ),
            });
        }
        if (isReadOnly) {
            // Its whole job is inserting a passage into the note.
            return;
        }
        bibleNote.prependFooterActionButton({
            id: 'bible-lookup',
            description: tran('Open Bible Lookup'),
            shortcutKey: 'Ctrl+Shift+B',
            children: (
                <button
                    className="action-button"
                    onClick={() => {
                        setIsShowingBibleLookup(true);
                    }}
                    title={tran('Open Bible Lookup')}
                    aria-label={tran('Open Bible Lookup')}
                    aria-pressed={false}
                >
                    <i className={'bi bi-book'} />
                </button>
            ),
        });
    }, [bibleNote, isReadOnly]);

    const [isOnTop, setIsOnTop] = useIsOnTop();
    useAppEffect(() => {
        bibleNote.prependFooterActionButton({
            id: 'toggle-on-top',
            description: tran('Toggle Always On Top'),
            shortcutKey: 'Ctrl+Shift+Alt+T',
            children: (
                <button
                    className="action-button"
                    onClick={() => {
                        setIsOnTop((prev) => !prev);
                    }}
                    title={tran('Toggle Always On Top')}
                    aria-label={tran('Toggle Always On Top')}
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
    }, [bibleNote, isOnTop]);

    const [bibleKey, setBibleKey] = useWatchStateSettingString<string>(
        BIBLE_KEY_SETTING_NAME,
        BIBLE_KJV_KEY,
    );
    const fontFamily = useBibleFontFamily(bibleKey);
    useAppEffect(() => {
        bibleNote.prependFooterActionButton({
            id: 'bible-key',
            description: tran('Change Bible Key'),
            shortcutKey: 'Ctrl+Shift+B',
            children: (
                <button
                    className="action-button"
                    onClick={(event) => {
                        showBibleKeyOption(
                            event,
                            (newBibleKey: string) => {
                                setBibleKey(newBibleKey);
                            },
                            [bibleKey],
                        );
                    }}
                    title={tran('Change Bible Key')}
                    aria-label={tran('Change Bible Key')}
                    aria-pressed={false}
                    style={{
                        color: 'var(--bs-info)',
                    }}
                >
                    <span style={{ fontFamily }}>{bibleKey}</span>
                </button>
            ),
        });
    }, [bibleNote, fontFamily, bibleKey]);
}
