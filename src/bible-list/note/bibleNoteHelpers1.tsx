import type { BibleNote } from 'bible-note';

import appProvider from '../../server/appProvider';
import { getAllLangsAsync, tran } from '../../lang/langHelpers';
import { useIsOnTop } from '../../server/appHelpers';
import { showBibleKeyOption } from '../../bible-lookup/BibleKeySelectionComp';
import { useThemeSource } from '../../others/themeHelpers';
import { useAppEffect, useAppEffectAsync } from '../../helper/appHooks';
import { useWatchStateSettingString } from '../../helper/settingHelpers';
import {
    BIBLE_KEY_SETTING_NAME,
    flushBibleNoteHistory,
} from './bibleNoteHelpers';
import BibleNoteEditingMenuComp from './BibleNoteEditingMenuComp';
import type Note from './Note';
import type NoteItem from './NoteItem';
import { BIBLE_KJV_KEY } from '../../helper/bible-helpers/bibleModelHelpers';
import { useBibleFontFamily } from '../../helper/bible-helpers/bibleStyleHelpers';
import { getIsAIEnabled } from '../../helper/ai/aiHelpers';
import { openNoteInChatbot } from '../../helper/ai/noteChatbotMenuHelpers';
import type { SelectionMentionType } from '../../helper/ai/chatbotHandoffStoreHelpers';
import { toNoteSelectionMention } from './noteSelectionMentionHelpers';

/**
 * The help window on this note: the last second of typing written into the
 * editing history first, because the help window reads the note from there.
 */
export async function openThisNoteInChatbot(
    note: Note,
    noteItem: NoteItem,
    mention: SelectionMentionType | string | null = null,
) {
    await flushBibleNoteHistory();
    return openNoteInChatbot(note.filePath, noteItem.id, null, mention);
}

// The id of the 🤖 on the bar over selected text.
export const ASK_CHATBOT_FLOATING_BUTTON_ID = 'ask-chatbot-about-selection';

export function useBibleNoteControl({
    bibleNote,
    note,
    noteItem,
    setIsShowingBibleLookup,
    isReadOnly = false,
}: {
    bibleNote: BibleNote;
    note: Note;
    noteItem: NoteItem;
    setIsShowingBibleLookup: (isShowing: boolean) => void;
    isReadOnly?: boolean;
}) {
    const themeSource = useThemeSource();
    useAppEffect(() => {
        if (isReadOnly) {
            // A preview writes nothing, so it has nothing to save.
            return;
        }
        bibleNote.prependFooterActionButton({
            id: 'editing-history',
            description: tran('Save'),
            // NO `shortcutKey`: the footer presses the FIRST button it finds
            // inside an entry, which here would be Undo. Ctrl+S is registered
            // by the menu itself.
            children: (
                <BibleNoteEditingMenuComp
                    note={note}
                    noteItem={noteItem}
                    bibleNote={bibleNote}
                />
            ),
        });
    }, [bibleNote, note, noteItem, isReadOnly]);
    // Open in Chatbot (2026-11-07, the user: as a slide document's editor has
    // its 🤖): this note, attached in the help window, which can change it.
    // Not on a preview, which is a file outside the notes folder.
    useAppEffect(() => {
        if (isReadOnly || !getIsAIEnabled()) {
            return;
        }
        const label = tran('Open in Chatbot');
        bibleNote.prependFooterActionButton({
            id: 'open-in-chatbot',
            description: label,
            children: (
                <button
                    className="action-button"
                    onClick={() => {
                        void openThisNoteInChatbot(note, noteItem);
                    }}
                    title={label}
                    aria-label={label}
                    aria-pressed={false}
                >
                    <i className="bi bi-robot" />
                </button>
            ),
        });
        // And on the bar over selected text (2026-11-08, the user: _as a
        // user I want to select bible note text then click the agent button
        // then writing a qustion about the selected text_): the same help
        // window on this note, the words selected quoted in its box with
        // the caret under them. It only reads, so it shows in read-only
        // mode too.
        bibleNote.appendFloatingActionButton({
            id: ASK_CHATBOT_FLOATING_BUTTON_ID,
            description: tran('Ask the assistant about this'),
            children: <i className="bi bi-robot format" />,
            onClick: ({ selection }) => {
                // Where the words are is read now, while the range still
                // matches the note.
                void openThisNoteInChatbot(
                    note,
                    noteItem,
                    toNoteSelectionMention(selection),
                );
            },
        });
    }, [bibleNote, note, noteItem, isReadOnly]);
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
                id: 'lang-markdown-editor ' + langData.langCode,
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
