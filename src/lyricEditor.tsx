import { StrictMode } from 'react';

import './bootstrapCss';
import { init } from './boot';
import LyricAppDocument from './lyric-list/LyricAppDocument';

import { getDashboardInstance, getLyric } from './lyricEditorBoot';
import AppWindowToolsComp from './others/AppWindowToolsComp';
import { getReactRoot } from './others/rootHelpers';
import { checkIsDarkMode } from './others/themeHelpers';

// This window is the one that never went through `boot`/`run`: its body is the
// Open Lyric dashboard, mounted imperatively. The app's own window-level tools
// need what `init` sets up (the locale, so their menu labels are translated),
// so it is started here -- deliberately NOT awaited before the dashboard, which
// is what the user came for and must not wait on a settings read.
void init()
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

dashboard.loadValue = async () => {
    return content;
};
dashboard.saveValue = async (value) => {
    await lyric.setContent(value);
    await lyric.save();
};
void dashboard
    .mount()
    .then(async () => {
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
