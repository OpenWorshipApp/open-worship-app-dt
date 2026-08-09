import './bootstrapCss';
import LyricAppDocument from './lyric-list/LyricAppDocument';

import { getDashboardInstance, getLyric } from './lyricEditorBoot';
import { checkIsDarkMode } from './others/themeHelpers';

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
