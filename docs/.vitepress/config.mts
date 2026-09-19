import { defineConfig } from 'vitepress';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Sidebar tree is generated from the owa-robot-test source of truth by
// docs/scripts/build-manual.mjs (run `npm run docs:gen`). Reading it as JSON
// keeps the config free of build-order coupling on a .mjs import.
const sidebar = JSON.parse(
    readFileSync(
        fileURLToPath(new URL('./sidebar.generated.json', import.meta.url)),
        'utf8',
    ),
);

// https://vitepress.dev/reference/site-config
export default defineConfig({
    title: 'Open Worship App — Manual',
    description:
        'User manual for Open Worship App, generated from — and verified against — the owa-robot-test source of truth.',
    lang: 'en-US',
    srcDir: 'manual-sources',
    cleanUrls: true,
    lastUpdated: true,
    ignoreDeadLinks: true,
    themeConfig: {
        nav: [
            { text: 'Manual', link: sidebar[0]?.items?.[0]?.link ?? '/' },
            {
                text: 'Test coverage',
                link: 'https://github.com/OpenWorshipApp/open-worship-app-dt/blob/main/.claude/skills/owa-robot-test/references/coverage-matrix.md',
            },
        ],
        sidebar,
        outline: 'deep',
        search: { provider: 'local' },
        socialLinks: [
            {
                icon: 'github',
                link: 'https://github.com/OpenWorshipApp/open-worship-app-dt',
            },
        ],
        editLink: {
            pattern:
                'https://github.com/OpenWorshipApp/open-worship-app-dt/edit/main/.claude/skills/owa-robot-test/references/user-workflows.md',
            text: 'Edit the source of truth (user-workflows.md)',
        },
        footer: {
            message:
                'Generated from user-workflows.md — the owa-robot-test source of truth.',
            copyright: 'Open Worship Foundation',
        },
    },
});
