// @vitest-environment jsdom
import { describe, expect, test } from 'vitest';

import {
    genDefaultWebPageName,
    genWebBackgroundHint,
    readHtmlBlock,
    readWebBackgroundAsk,
    toSafeWebPage,
} from './webBackgroundAskHelpers';

describe('a background web page asked for', () => {
    test('the ask the baseline run answered with steps', () => {
        expect(
            readWebBackgroundAsk(
                'Make a background web page with a soft blue gradient.',
            ),
        ).toEqual({ name: null, description: 'a soft blue gradient' });
    });

    test('the other ways a person says it', () => {
        expect(
            readWebBackgroundAsk(
                'Can you create a web background called Calm Sea showing slow waves?',
            ),
        ).toEqual({ name: 'Calm Sea', description: 'slow waves' });
        expect(
            readWebBackgroundAsk(
                'Please make me an animated web page background for Easter',
            ),
        ).toEqual({ name: null, description: 'Easter' });
        expect(
            readWebBackgroundAsk('I need a new web page for the background'),
        ).toEqual({ name: null, description: '' });
        expect(
            readWebBackgroundAsk(
                'Design an HTML background named "Welcome" that says Welcome Home',
            ),
        ).toEqual({ name: 'Welcome', description: 'Welcome Home' });
    });

    test('a how-to, a picture or a video, and a change are not asks for one', () => {
        for (const text of [
            'How do I make a background web page?',
            'Can I make a web background?',
            'Make a background from this picture',
            'Add this video as a background: https://youtu.be/x',
            'Make the web background brighter',
            'Make a new running order',
            'Show the web background',
            '/web',
            '',
        ]) {
            expect(readWebBackgroundAsk(text)).toBeNull();
        }
    });

    test('a page with no name is named after the day', () => {
        expect(genDefaultWebPageName(new Date(2026, 10, 12))).toBe(
            'Background 2026-11-12',
        );
    });

    test('the model is told to write it, one block, nothing that loads', () => {
        const hint = genWebBackgroundHint('Calm Sea');
        expect(hint).toContain('"Calm Sea"');
        expect(hint).toContain('```html');
        expect(hint).toContain('no script');
        expect(hint).toContain('call no tool');
        // A projector computer may be old: a moving page repaints nothing.
        expect(hint).toContain('ONLY by animating transform or opacity');
    });
});

describe('the page in the answer', () => {
    test('taken out of the answer, the words around it kept', () => {
        const answer =
            'A soft blue gradient that slowly shifts.\n\n```html\n' +
            '<!doctype html><html><head><style>body{background:blue}</style>' +
            '</head><body></body></html>\n```\n';
        expect(readHtmlBlock(answer)).toEqual({
            html:
                '<!doctype html><html><head><style>body{background:blue}' +
                '</style></head><body></body></html>',
            rest: 'A soft blue gradient that slowly shifts.',
        });
    });

    test('no block, or a block that is no page, is nothing', () => {
        expect(readHtmlBlock('Here are the steps: 1. Open Webs')).toBeNull();
        expect(readHtmlBlock('```html\njust words\n```')).toBeNull();
        expect(readHtmlBlock('```html\n```')).toBeNull();
    });
});

describe('the page as it is saved', () => {
    test('a gradient and its animation are kept whole', () => {
        const page = toSafeWebPage(
            '<!doctype html><html><head><style>' +
                'body{background:linear-gradient(#0af,#036);' +
                'animation:shift 20s ease-in-out infinite alternate}' +
                '@keyframes shift{to{filter:hue-rotate(20deg)}}' +
                '</style></head><body><h1 class="t">Welcome</h1></body></html>',
            'Calm Sea',
        );
        expect(page).toContain('<title>Calm Sea</title>');
        expect(page).toContain('linear-gradient(#0af,#036)');
        expect(page).toContain('@keyframes shift');
        expect(page).toContain('<h1 class="t">Welcome</h1>');
        expect(page.startsWith('<!doctype html>')).toBe(true);
    });

    test('nothing runs and nothing loads', () => {
        const page = toSafeWebPage(
            '<html><head>' +
                '<script>fetch("https://x.example/?k=1")</script>' +
                '<link rel="stylesheet" href="https://x.example/a.css">' +
                '<style>@import url("https://x.example/b.css");' +
                'body{background:url(https://x.example/p.png)}' +
                '.dot{background:url("data:image/png;base64,AAAA")}</style>' +
                '</head><body onload="alert(1)">' +
                '<img src="https://x.example/i.png" onerror="alert(2)">' +
                '<iframe src="https://x.example"></iframe>' +
                '<a href="javascript:alert(3)">go</a>' +
                '<div style="background:url(https://x.example/q.png)">hi</div>' +
                '<svg><use href="https://x.example/s.svg#a"></use></svg>' +
                '</body></html>',
            'Probe',
        );
        expect(page).not.toMatch(/<script|<iframe|<img|<link|onload|onerror/i);
        expect(page).not.toContain('x.example');
        expect(page).not.toContain('javascript:');
        expect(page).toContain('data:image/png;base64,AAAA');
        expect(page).toContain('>hi</div>');
    });

    test('a title cannot break out of its tag', () => {
        expect(toSafeWebPage('<body></body>', '</title><b>x')).toContain(
            '<title>/titlebx</title>',
        );
    });
});
