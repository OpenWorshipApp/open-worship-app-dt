import type { BibleNote } from 'BibleNote.js';

import appProvider from '../../server/appProvider';
import { getAllLangsAsync } from '../../lang/langHelpers';
import { useIsOnTop } from '../../server/appHelpers';
import BibleItem from '../BibleItem';
import { showBibleKeyOption } from '../../bible-lookup/BibleKeySelectionComp';
import { useThemeSource } from '../../others/themeHelpers';
import { useAppEffect, useAppEffectAsync } from '../../helper/debuggerHelpers';
import { useWatchStateSettingString } from '../../helper/settingHelpers';
import { BIBLE_KEY_SETTING_NAME } from './bibleNoteHelpers';
import { useBibleFontFamily } from '../../helper/bible-helpers/bibleLogicHelpers2';

export function useBibleNoteControl({
    bibleNote,
    setIsShowingBibleLookup,
}: {
    bibleNote: BibleNote;
    setIsShowingBibleLookup: (isShowing: boolean) => void;
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

    const [isOnTop, setIsOnTop] = useIsOnTop();
    useAppEffect(() => {
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
    }, [bibleNote, isOnTop]);

    const [bibleKey, setBibleKey] = useWatchStateSettingString<string>(
        BIBLE_KEY_SETTING_NAME,
        'KJV',
    );
    const fontFamily = useBibleFontFamily(bibleKey);
    useAppEffect(() => {
        bibleNote.prependFooterActionButton({
            id: 'bible-key',
            description: 'Change Bible Key',
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
                    title={'Change Bible Key'}
                    aria-label={'Change Bible Key'}
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

export async function addBibleText(bibleNote: BibleNote) {
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
