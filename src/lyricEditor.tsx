import './bootstrapCss';

import { getDashboardInstance, getLyric } from './lyricEditorBoot';
import { checkIsDarkMode } from './others/themeHelpers';

const isDark = checkIsDarkMode();
document.body.setAttribute('data-theme', isDark ? 'dark' : 'light');
document.body.setAttribute('data-bs-theme', isDark ? 'dark' : 'light');

const [dashboard, { lyric, content }] = await Promise.all([
    getDashboardInstance(),
    getLyric(),
]);

dashboard.loadValue = async () => {
    return content;
};
dashboard.saveValue = async (value) => {
    await lyric.setContent(value);
};
void dashboard.mount().catch((error: any) => {
    // The app already rendered its failure state (failBoot); just log here.
    console.error('Failed to boot the Open Lyric dashboard.', error);
});
