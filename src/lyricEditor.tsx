import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './bootstrapCss';
import { init } from './boot';
import LyricAppDocument from './lyric-list/LyricAppDocument';

import { getDashboardInstance, getLyric } from './lyricEditorBoot';
import AppWindowToolsComp from './others/AppWindowToolsComp';
import { getReactRoot } from './others/rootHelpers';
import { checkIsDarkMode } from './others/themeHelpers';
import LyricEditorChatbotButtonComp from './lyric-list/LyricEditorChatbotButtonComp';
import {
    applyLyricEditorText,
    createLyricEditorSync,
    type LyricEditorSyncType,
} from './lyric-list/lyricEditorChatbotSync';

// This window is the one that never went through `boot`/`run`: its body is the
// Open Lyric dashboard, mounted imperatively. The app's own window-level tools
// need what `init` sets up (the locale, so their menu labels are translated),
// so it is started here -- deliberately NOT awaited before the dashboard, which
// is what the user came for and must not wait on a settings read.
const initializing = init();
void initializing
    .then(() => {
        getReactRoot('app-window-tools').render(
            <StrictMode>
                <AppWindowToolsComp />
            </StrictMode>,
        );
    })
    .catch((error: any) => {
        // The editor itself is unaffected; say so and carry on rather than
        // failing a window the user opened to edit a song.
        console.error('Failed to mount the app window tools.', error);
    });

const isDarkMode = checkIsDarkMode();
document.body.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
document.body.setAttribute('data-bs-theme', isDarkMode ? 'dark' : 'light');

const [{ dashboard, openLyric, editor }, { lyric, content, slideId }] =
    await Promise.all([getDashboardInstance(), getLyric()]);

// Set once the dashboard is up: the editor following a song changed from
// outside it -- by the help window's assistant above all
// (`lyricEditorChatbotSync.ts`).
let chatbotSync: LyricEditorSyncType | null = null;

// The song as SAVED is what the editor opens on and calls clean; edits not
// saved yet (the song's editing head, an assistant's change among them) go
// in on top of it as an edit, so Reset / Save are there to press. Opened on
// the head itself, the editor called those edits clean and greyed Save out,
// and the Lyric Editor is the only place a song is saved.
async function readSavedContent() {
    try {
        const saved = await lyric.getJsonData?.(true);
        return typeof saved?.content === 'string' ? saved.content : content;
    } catch (error) {
        console.error('Failed to read the saved song.', error);
        return content;
    }
}
const savedContent = await readSavedContent();

dashboard.loadValue = async () => {
    return savedContent;
};

/** Text into the editor as an edit; the baseline-resetting setter last. */
function showInEditor(value: string) {
    if (
        !applyLyricEditorText(dashboard.editor, value) &&
        dashboard.editor !== null
    ) {
        dashboard.editor.value = value;
    }
}

// Monaco's model comes up a moment after the dashboard says it mounted.
async function showUnsavedEdits() {
    for (let attempt = 0; attempt < 30; attempt += 1) {
        if (applyLyricEditorText(dashboard.editor, content)) {
            return;
        }
        await new Promise((resolve) => {
            setTimeout(resolve, 100);
        });
    }
    showInEditor(content);
}
dashboard.saveValue = async (value) => {
    await lyric.setContent(value);
    await lyric.save();
    chatbotSync?.markSaved(value);
};

/**
 * The 🤖 left of Reset / Save, in the slot the dashboard keeps for its host
 * (`getSlot`). After `init`, because its label is translated.
 */
function mountChatbotButton(sync: LyricEditorSyncType) {
    void initializing.then(
        () => {
            try {
                createRoot(dashboard.getSlot(0)).render(
                    <StrictMode>
                        <LyricEditorChatbotButtonComp
                            sync={sync}
                            filePath={lyric.filePath}
                        />
                    </StrictMode>,
                );
            } catch (error) {
                // The editor itself is unaffected, as with the tools above.
                console.error('Failed to mount the chatbot button.', error);
            }
        },
        () => {
            // A failed `init` is already said once, by the window tools.
        },
    );
}

void dashboard
    .mount()
    .then(async () => {
        chatbotSync = createLyricEditorSync({
            lyric,
            initialContent: content,
            getShown: () => {
                return dashboard.value;
            },
            setShown: showInEditor,
        });
        mountChatbotButton(chatbotSync);
        if (content !== savedContent) {
            await showUnsavedEdits();
        }
        if (slideId === null) {
            return;
        }

        openLyric.value = content;
        const lyricAppDocument = LyricAppDocument.getInstance(lyric.filePath);
        lyricAppDocument.openLyric = openLyric;
        const slide = (await lyricAppDocument.getSlidesQuick()).find(
            (slide) => slide.id === slideId,
        );
        if (slide !== undefined) {
            const key = slide.openLyricKey;
            dashboard.isEditorOpened = true;
            editor.focusFence(key);
        }
    })
    .catch((error: any) => {
        // The app already rendered its failure state (failBoot); just log here.
        console.error('Failed to boot the Open Lyric dashboard.', error);
    });
