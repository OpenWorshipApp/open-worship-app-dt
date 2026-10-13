import { describe, expect, it } from 'vitest';

import { toPathScrubbed } from './accountPathHelpers';

// A problem report is handed to a stranger, and an error line names the
// file it could not open -- under a folder named after the person.
describe('toPathScrubbed', () => {
    it('takes the account name out of a home path and leaves its shape', () => {
        expect(
            toPathScrubbed(
                "ENOENT: no such file, open 'C:\\Users\\sokha\\AppData\\Roaming\\open-worship-app\\x.json'",
            ),
        ).toBe(
            "ENOENT: no such file, open 'C:\\Users\\~\\AppData\\Roaming\\open-worship-app\\x.json'",
        );
        expect(toPathScrubbed('at /home/sokha/.config/app/main.js:10:2')).toBe(
            'at /home/~/.config/app/main.js:10:2',
        );
        expect(toPathScrubbed('/Users/sokha/Library/Logs/app.log')).toBe(
            '/Users/~/Library/Logs/app.log',
        );
        // As a console writes a file it failed to load.
        expect(
            toPathScrubbed('failed: file:///C:/Users/sokha/Desktop/a.lyric'),
        ).toBe('failed: file:///C:/Users/~/Desktop/a.lyric');
    });

    it('takes a name with spaces in it, and one with nothing after it', () => {
        expect(toPathScrubbed('C:\\Users\\Sokha Chan\\Documents\\a.txt')).toBe(
            'C:\\Users\\~\\Documents\\a.txt',
        );
        expect(toPathScrubbed('cwd is C:\\Users\\sokha')).toBe(
            'cwd is C:\\Users\\~',
        );
        expect(toPathScrubbed('in C:\\Users\\sokha and nowhere else')).toBe(
            'in C:\\Users\\~ and nowhere else',
        );
    });

    it('takes every one in a line, and leaves other paths alone', () => {
        expect(
            toPathScrubbed('copy C:\\Users\\a\\x.txt to D:\\Users\\b\\y.txt'),
        ).toBe('copy C:\\Users\\~\\x.txt to D:\\Users\\~\\y.txt');
        for (const text of [
            'C:\\Program Files\\Open Worship\\resources\\app.asar',
            '/usr/lib/node_modules/x.js',
            'the Users panel is empty',
            'https://www.openworship.app/home',
            '',
        ]) {
            expect(toPathScrubbed(text)).toBe(text);
        }
    });
});
