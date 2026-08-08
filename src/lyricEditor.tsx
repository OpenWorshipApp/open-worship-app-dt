import './bootstrapCss';

import { getDashboardInstance, getLyric } from './lyricEditorBoot';
import { checkIsDarkMode } from './others/themeHelpers';

const isDarkMode = checkIsDarkMode();
document.body.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
document.body.setAttribute('data-bs-theme', isDarkMode ? 'dark' : 'light');

const [dashboard, { lyric, content }] = await Promise.all([
    getDashboardInstance(),
    getLyric(),
]);

dashboard.loadValue = async () => {
    return content;
};
dashboard.saveValue = async (value) => {
    await lyric.setContent(value);
    await lyric.save();
};
void dashboard.mount().catch((error: any) => {
    // The app already rendered its failure state (failBoot); just log here.
    console.error('Failed to boot the Open Lyric dashboard.', error);
});
