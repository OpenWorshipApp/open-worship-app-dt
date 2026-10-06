// @vitest-environment jsdom

import { describe, expect, test } from 'vitest';

import {
    decodeHtmlEntities,
    escapeHtmlText,
    sanitizeHtml,
    sanitizeSlideHtml,
} from './sanitizeHelpers';

function parse(html: string) {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div;
}

describe('decodeHtmlEntities', () => {
    test('reads the named entities a <title> carries', () => {
        expect(decodeHtmlEntities('Tom &amp; Jerry')).toBe('Tom & Jerry');
        expect(decodeHtmlEntities('&quot;Oceans&quot; &lt;Live&gt;')).toBe(
            '"Oceans" <Live>',
        );
        expect(decodeHtmlEntities('It&apos;s')).toBe("It's");
    });

    test('reads decimal and hexadecimal references', () => {
        expect(decodeHtmlEntities('It&#39;s &#x2014; ok')).toBe("It's — ok");
        expect(decodeHtmlEntities('&#6016;')).toBe('ក');
    });

    test('leaves what it does not know as written', () => {
        expect(decodeHtmlEntities('a &bogus; b')).toBe('a &bogus; b');
        expect(decodeHtmlEntities('a & b')).toBe('a & b');
        expect(decodeHtmlEntities('&#0;')).toBe('&#0;');
    });

    test('undoes escapeHtmlText', () => {
        const text = 'a < b & "c" > d';
        expect(decodeHtmlEntities(escapeHtmlText(text))).toBe(text);
    });
});

describe('document HTML sanitization', () => {
    test.each([
        '<img src="missing" onerror="globalThis.__en39Marker = true">',
        '<svg onload="globalThis.__en39Marker = true"><path d="M0 0" /></svg>',
        '<a href="java&#x09;script:globalThis.__en39Marker = true">link</a>',
        '<script>globalThis.__en39Marker = true</script>',
        '<iframe srcdoc="<p>embedded</p>"></iframe>',
        '<iframe src="https://www.youtube.com/embed/demo"></iframe>',
        '<object data="data:text/html,embedded"></object>',
        '<embed src="data:text/html,embedded">',
        '<base href="https://example.org/"><meta http-equiv="refresh" content="0">',
    ])('removes executable markup: %s', (dirty) => {
        const clean = parse(sanitizeHtml(dirty));
        expect(
            clean.querySelector('script,iframe,object,embed,base,meta'),
        ).toBeNull();
        expect(clean.querySelector('[onerror],[onload],[srcdoc]')).toBeNull();
        expect(clean.querySelector('a')?.hasAttribute('href') ?? false).toBe(
            false,
        );
    });

    test('preserves lyric formatting, styles, SVG and Bible annotation data', () => {
        const clean = parse(
            sanitizeHtml(
                '<style>.verse { color: red; }</style>' +
                    '<div class="verse" style="font-size:61px; font-family:serif">' +
                    '<strong>ខ្មែរ</strong><br><em>Français</em>' +
                    '<span data-title-verse-key="GEN 1:1" data-dict-locale="en">Verse</span>' +
                    '<svg viewBox="0 0 16 16"><path d="M0 0L16 16" /></svg></div>',
            ),
        );
        expect(clean.querySelector('style')?.textContent).toContain('.verse');
        expect(clean.querySelector('.verse')?.getAttribute('style')).toContain(
            '61px',
        );
        expect(clean.querySelector('strong')?.textContent).toBe('ខ្មែរ');
        expect(clean.querySelector('em')?.textContent).toBe('Français');
        expect(clean.querySelector('br')).not.toBeNull();
        expect(clean.querySelector('[data-title-verse-key]')?.textContent).toBe(
            'Verse',
        );
        expect(clean.querySelector('svg path')).not.toBeNull();
    });

    test.each([
        'file:///C:/media/a.png',
        'blob:https://localhost/id',
        'owa://local/a.png',
        'data:image/png;base64,YQ==',
    ])('preserves media source %s', (src) => {
        const clean = parse(
            sanitizeHtml(
                `<img src="${src}"><video src="${src}" muted loop playsinline></video>`,
            ),
        );
        expect(clean.querySelector('img')?.getAttribute('src')).toBe(src);
        expect(clean.querySelector('video')?.getAttribute('src')).toBe(src);
    });

    test('HTML cannot forge managed website or camera hydration markers', () => {
        const clean = parse(
            sanitizeHtml(
                '<div data-website-item data-website-url="https://example.org" data-website-capture-size="800x600"></div>' +
                    '<video data-camera-item data-camera-device-id="device" data-camera-device-label="Camera"></video>',
            ),
        );
        expect(
            clean.querySelector('[data-website-item],[data-camera-item]'),
        ).toBeNull();
        expect(clean.innerHTML).not.toContain('data-website-');
        expect(clean.innerHTML).not.toContain('data-camera-');
    });

    test('local-file exceptions do not allow executable links or SVG references', () => {
        const clean = parse(
            sanitizeHtml(
                '<a href="file:///C:/media/a.html">file</a>' +
                    '<svg><use href="file:///C:/media/a.svg"></use></svg>' +
                    '<video src="javascript:globalThis.__en39Marker=true"></video>',
            ),
        );
        expect(clean.querySelector('a')?.hasAttribute('href')).toBe(false);
        expect(clean.querySelector('use')?.hasAttribute('href') ?? false).toBe(
            false,
        );
        expect(clean.querySelector('video')?.hasAttribute('src')).toBe(false);
    });
});

describe('composed slide HTML sanitization', () => {
    test('keeps generated camera and website markers for screen and print', () => {
        const clean = parse(
            sanitizeSlideHtml(
                '<div data-website-item data-website-url="https://example.org" data-website-capture-size="800x600"><img data-preview-only src="data:image/png;base64,YQ=="></div>' +
                    '<video data-camera-item data-camera-device-id="device" data-camera-device-label="Camera" muted playsinline></video>' +
                    '<video src="file:///C:/media/song.mp4" loop muted playsinline></video>' +
                    '<svg data-preview-only viewBox="0 0 16 16"><path d="M0 0L16 16"/></svg>',
            ),
        );
        expect(
            clean
                .querySelector('[data-website-item]')
                ?.getAttribute('data-website-capture-size'),
        ).toBe('800x600');
        expect(
            clean
                .querySelector('[data-camera-item]')
                ?.getAttribute('data-camera-device-label'),
        ).toBe('Camera');
        expect(clean.querySelector('video[src]')?.getAttribute('src')).toBe(
            'file:///C:/media/song.mp4',
        );
        expect(clean.querySelector('video[src]')?.hasAttribute('muted')).toBe(
            true,
        );
        expect(clean.querySelector('svg path')).not.toBeNull();
    });

    test.each(['www.youtube.com', 'www.youtube-nocookie.com'])(
        'preserves a managed %s player and its controls',
        (host) => {
            const src = `https://${host}/embed/abc123?rel=0&enablejsapi=1`;
            const clean = parse(
                sanitizeSlideHtml(
                    `<iframe src="${src}" allow="autoplay; encrypted-media" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" style="width:100%" srcdoc="untrusted" onload="globalThis.__en39Marker=true"></iframe>`,
                ),
            );
            const frame = clean.querySelector('iframe');
            expect(frame?.getAttribute('src')).toBe(src);
            expect(frame?.getAttribute('allow')).toContain('autoplay');
            expect(frame?.hasAttribute('allowfullscreen')).toBe(true);
            expect(frame?.getAttribute('style')).toContain('100%');
            expect(frame?.getAttribute('sandbox')).toBe(
                'allow-scripts allow-same-origin allow-presentation',
            );
            expect(frame?.hasAttribute('srcdoc')).toBe(false);
            expect(frame?.hasAttribute('onload')).toBe(false);
        },
    );

    test.each([
        'https://example.org/embed/abc',
        'https://www.youtube.com.evil.test/embed/abc',
        'https://www.youtube.com/watch?v=abc',
        'https://www.youtube.com:444/embed/abc',
        'https://user@www.youtube.com/embed/abc',
        'http://www.youtube.com/embed/abc',
        'javascript:globalThis.__en39Marker=true',
        'data:text/html,embedded',
        'file:///C:/media/a.html',
        '',
    ])('removes an unapproved frame source: %s', (src) => {
        expect(
            parse(
                sanitizeSlideHtml(`<iframe src="${src}"></iframe>`),
            ).querySelector('iframe'),
        ).toBeNull();
    });

    test('both policies still strip executable attributes after alternating calls', () => {
        for (const sanitize of [
            sanitizeSlideHtml,
            sanitizeHtml,
            sanitizeSlideHtml,
        ]) {
            const clean = parse(
                sanitize(
                    '<span onmouseover="globalThis.__en39Marker=true">safe</span>',
                ),
            );
            expect(clean.textContent).toBe('safe');
            expect(clean.querySelector('[onmouseover]')).toBeNull();
        }
        expect(
            parse(
                sanitizeHtml(
                    '<iframe src="https://www.youtube.com/embed/abc"></iframe>',
                ),
            ).querySelector('iframe'),
        ).toBeNull();
    });
});
