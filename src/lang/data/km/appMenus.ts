import type { CustomMenusDataType } from '../../langHelpers';

// Kept out of `./index.ts` on purpose: `initLangAppMenu` runs on every page of
// the main window, and importing the whole language package (its dictionary,
// bible books and the open-lyric plugin) to build three menu items would load
// it into a page that may never show a word of Khmer.
const appMenus: CustomMenusDataType = {
    tools: [
        {
            label: 'Khmer Tools',
            submenu: [
                {
                    label: 'Editor',
                    clickData: {
                        openExternalUrl: 'https://editor-km.openworship.app',
                    },
                },
                {
                    label: 'Open Lyric',
                    clickData: {
                        openExternalUrl: 'https://lyric-km.openworship.app',
                    },
                },
                {
                    label: 'BibleNote',
                    clickData: {
                        openExternalUrl: 'https://biblenote-km.openworship.app',
                    },
                },
            ],
        },
    ],
};

export default appMenus;
