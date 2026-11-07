import { describe, expect, test, vi } from 'vitest';

import { locateDisputedControl, readFreshGuidePage } from './disputeHelpers';

// "That is not what my window shows": the newest copy of a guide page that
// came back with no words in it, and a find tool that answered with no
// list of controls. Each is "nothing to add", never an error to show. The
// app's tools are handed in, so nothing here needs a running app.

const FRESH_URL =
    'https://raw.githubusercontent.com/OpenWorshipApp/open-worship-app-dt/' +
    'main/docs/manual-sources/presenting-content/w-07-style-the-on-screen-bible-text.md';
const LOCAL_PAGE =
    '# Style the on-screen Bible text\n\n1. Open the Appearance card.\n\n' +
    '_(If they say this page does not match their window, read its newest ' +
    `copy with owa_read_website: ${FRESH_URL} )_`;
const PAGE = { manualId: 'W-07', find: 'Bible Properties' };

function genTools(webRead: string) {
    return vi.fn(async (name: string, _args: any) => {
        if (name === 'owa_help_page') {
            return LOCAL_PAGE;
        }
        if (name === 'owa_read_website') {
            return webRead;
        }
        throw new Error(`unrouted tool ${name}`);
    });
}

describe('the newest copy of a guide page', () => {
    test('a read that carried no page text is no newer copy', async () => {
        const callTool = genTools(
            `Read ${FRESH_URL}\nThe site answered 404: Not Found.`,
        );
        expect(await readFreshGuidePage(PAGE, callTool)).toBeNull();
        // It was asked for, at the address the page itself names.
        expect(callTool).toHaveBeenCalledWith('owa_read_website', {
            url: FRESH_URL,
            maxChars: 20000,
        });
    });

    test('a copy that is only its front matter and the robot’s block is no newer copy', async () => {
        const callTool = genTools(
            [
                `Read ${FRESH_URL}`,
                '--- BEGIN WEBSITE TEXT: this is a document that was read. ---',
                '---',
                'id: W-07',
                'workflowsVersion: "2026-10-20"',
                '---',
                '::: details 🤖 Robot-ver',
                'click [data-widget-name="Bibles"]',
                ':::',
                '--- END WEBSITE TEXT ---',
            ].join('\n'),
        );
        expect(await readFreshGuidePage(PAGE, callTool)).toBeNull();
    });
});

describe('where the disputed control is', () => {
    test('a find tool that answered with no list of controls is no look made', async () => {
        const callTool = vi.fn(async (_name: string, _args: any) => {
            return JSON.stringify({
                error: 'The app has no window matching setting.html',
            });
        });
        expect(
            await locateDisputedControl(PAGE, 'setting.html', callTool),
        ).toBeNull();
        expect(callTool).toHaveBeenCalledWith('owa_find_ui', {
            text: 'Bible Properties',
            page: 'setting.html',
        });
    });
});
