import './bootstrapCss';

import { getDashboardInstance, initDataLoading } from './lyricEditorBoot';

const dashboard = getDashboardInstance();
initDataLoading(dashboard);
void dashboard.mount().catch((error: any) => {
    // The app already rendered its failure state (failBoot); just log here.
    console.error('Failed to boot the Open Lyric dashboard.', error);
});
