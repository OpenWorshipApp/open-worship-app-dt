import { afterEach, describe, expect, test, vi } from 'vitest';

const { execFileMock } = vi.hoisted(() => ({
    execFileMock: vi.fn(),
}));

vi.mock('node:child_process', () => ({
    execFile: execFileMock,
}));

import {
    appKitWeightToCssWeight,
    fontconfigWeightToCssWeight,
    getSystemFontListMap,
    parseDarwinFontList,
    parseLinuxFontList,
    parseSystemProfilerFontList,
    parseWin32FontList,
    styleNameToCssWeight,
} from './fontListHelpers';

const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');

function setPlatform(platform: NodeJS.Platform) {
    Object.defineProperty(process, 'platform', {
        ...originalPlatform,
        value: platform,
    });
}

type ExecFileCallbackType = (error: Error | null, stdout: string) => void;

function answerExecFile(answer: (file: string, args: string[]) => string) {
    execFileMock.mockImplementation(
        (
            file: string,
            args: string[],
            _options: unknown,
            callback: ExecFileCallbackType,
        ) => {
            try {
                callback(null, answer(file, args));
            } catch (error) {
                callback(error as Error, '');
            }
        },
    );
}

afterEach(() => {
    if (originalPlatform !== undefined) {
        Object.defineProperty(process, 'platform', originalPlatform);
    }
});

describe('parseWin32FontList', () => {
    test('merges a family listed twice and sorts families and weights', () => {
        const stdout =
            '\uFEFFSegoe UI\t400,700,300,400\r\n' +
            'arial\t400,700,abc,0\r\n' +
            'Battambang\t100,900\r\n' +
            'Battambang\t400,100\r\n' +
            'WARNING: a line with no tab\r\n' +
            '\r\n' +
            'Khmer OS Muol\t\r\n';

        const fontListMap = parseWin32FontList(stdout);

        expect(fontListMap).toEqual({
            arial: ['400', '700'],
            Battambang: ['100', '400', '900'],
            'Khmer OS Muol': [],
            'Segoe UI': ['300', '400', '700'],
        });
        expect(Object.keys(fontListMap)).toEqual([
            'arial',
            'Battambang',
            'Khmer OS Muol',
            'Segoe UI',
        ]);
    });
});

describe('styleNameToCssWeight', () => {
    test.each([
        ['Regular', 400],
        ['Book', 400],
        ['Thin', 100],
        ['ExtraLight', 200],
        ['UltraLight', 200],
        ['Light', 300],
        ['Demi Light', 350],
        ['Medium', 500],
        ['SemiBold', 600],
        ['Semibold Italic', 600],
        ['Bold Italic', 700],
        ['Extra Bold', 800],
        ['Black', 900],
        ['Heavy', 900],
        ['Italic', null],
        ['W3', null],
    ])('%s is %s', (styleName, weight) => {
        expect(styleNameToCssWeight(styleName)).toBe(weight);
    });
});

describe('appKitWeightToCssWeight', () => {
    test.each([
        [0, 100],
        [3, 200],
        [4, 300],
        [5, 400],
        [8, 600],
        [9, 700],
        [12, 900],
        [20, 900],
    ])('%s is %s', (appKitWeight, weight) => {
        expect(appKitWeightToCssWeight(appKitWeight)).toBe(weight);
    });
});

describe('parseDarwinFontList', () => {
    test('reads the style name first and the AppKit weight after', () => {
        const stdout = JSON.stringify([
            [
                'Helvetica Neue',
                [
                    ['Regular', 5],
                    ['Bold', 9],
                    ['Italic', 5],
                    ['UltraLight', 2],
                ],
            ],
            [
                'Hiragino Sans',
                [
                    ['W3', 4],
                    ['W6', 8],
                ],
            ],
            ['', []],
            'not a family',
        ]);

        expect(parseDarwinFontList(stdout)).toEqual({
            'Helvetica Neue': ['200', '400', '700'],
            'Hiragino Sans': ['300', '600'],
        });
    });

    test('accepts the list printed as a quoted string', () => {
        const stdout = JSON.stringify(JSON.stringify([['Avenir', []]]));

        expect(parseDarwinFontList(stdout)).toEqual({ Avenir: [] });
    });

    test('refuses something that is not a list', () => {
        expect(() => {
            return parseDarwinFontList('{}');
        }).toThrow();
    });
});

describe('parseSystemProfilerFontList', () => {
    test('reads each typeface by its family and style', () => {
        const stdout = JSON.stringify({
            SPFontsDataType: [
                {
                    typefaces: [
                        { family: 'Avenir', style: 'Book' },
                        { family: 'Avenir', style: 'Heavy' },
                        { family: 'Avenir', style: 'Oblique' },
                    ],
                },
                { typefaces: [{ style: 'Regular' }] },
                {},
            ],
        });

        expect(parseSystemProfilerFontList(stdout)).toEqual({
            Avenir: ['400', '900'],
        });
    });
});

describe('fontconfigWeightToCssWeight', () => {
    test.each([
        [-5, 100],
        [0, 100],
        [40, 200],
        [50, 300],
        [55, 350],
        [75, 400],
        [80, 400],
        [100, 500],
        [180, 600],
        [200, 700],
        [205, 800],
        [210, 900],
        [215, 1000],
        [300, 1000],
    ])('%s is %s', (fontconfigWeight, weight) => {
        expect(fontconfigWeightToCssWeight(fontconfigWeight)).toBe(weight);
    });
});

describe('parseLinuxFontList', () => {
    test('reads plain weights and widens a variable range', () => {
        const stdout =
            'DejaVu Sans|80\n' +
            'DejaVu Sans|200\n' +
            'Noto Sans|[0 210]\n' +
            'Cantarell|[40 200]\n' +
            'Terminus|\n' +
            'a line with no separator\n';

        expect(parseLinuxFontList(stdout)).toEqual({
            Cantarell: ['200', '300', '400', '500', '600', '700'],
            'DejaVu Sans': ['400', '700'],
            'Noto Sans': [
                '100',
                '200',
                '300',
                '400',
                '500',
                '600',
                '700',
                '800',
                '900',
            ],
            Terminus: [],
        });
    });
});

describe('getSystemFontListMap', () => {
    test('asks WPF on Windows through PowerShell by its full path', async () => {
        setPlatform('win32');
        answerExecFile(() => {
            return 'Arial\t400,700\n';
        });

        await expect(getSystemFontListMap()).resolves.toEqual({
            Arial: ['400', '700'],
        });

        const [file, args, options] = execFileMock.mock.calls[0];
        expect(file).toMatch(
            /WindowsPowerShell[\\/]v1\.0[\\/]powershell\.exe$/i,
        );
        expect(args.slice(0, 3)).toEqual([
            '-NoProfile',
            '-NonInteractive',
            '-EncodedCommand',
        ]);
        const script = Buffer.from(args[3], 'base64').toString('utf16le');
        // The weights must come off real faces: `FamilyTypefaces` hands out
        // WPF's simulated bold too, which gave every one-weight family a
        // `700` it does not ship.
        expect(script).toContain('GetTypefaces()');
        expect(script).toContain('IsBoldSimulated');
        expect(script).not.toContain('FamilyTypefaces');
        expect(script).toContain('Microsoft\\Windows\\Fonts');
        expect(options).toMatchObject({ windowsHide: true });
    });

    test('asks NSFontManager on macOS', async () => {
        setPlatform('darwin');
        answerExecFile(() => {
            return JSON.stringify([['Avenir', [['Book', 5]]]]);
        });

        await expect(getSystemFontListMap()).resolves.toEqual({
            Avenir: ['400'],
        });
        expect(execFileMock).toHaveBeenCalledTimes(1);
        const [file, args] = execFileMock.mock.calls[0];
        expect(file).toBe('/usr/bin/osascript');
        expect(args[3]).toContain('availableMembersOfFontFamily');
    });

    test('falls back to system_profiler when NSFontManager fails', async () => {
        setPlatform('darwin');
        const consoleLogSpy = vi
            .spyOn(console, 'log')
            .mockImplementation(() => {});
        answerExecFile((file) => {
            if (file === '/usr/bin/osascript') {
                throw new Error('osascript failed');
            }
            return JSON.stringify({
                SPFontsDataType: [
                    { typefaces: [{ family: 'Avenir', style: 'Heavy' }] },
                ],
            });
        });

        await expect(getSystemFontListMap()).resolves.toEqual({
            Avenir: ['900'],
        });
        expect(execFileMock.mock.calls[1][0]).toBe('/usr/sbin/system_profiler');
        expect(execFileMock.mock.calls[1][1]).toEqual([
            '-json',
            'SPFontsDataType',
        ]);
        consoleLogSpy.mockRestore();
    });

    test('asks fontconfig on Linux', async () => {
        setPlatform('linux');
        answerExecFile(() => {
            return 'DejaVu Sans|200\n';
        });

        await expect(getSystemFontListMap()).resolves.toEqual({
            'DejaVu Sans': ['700'],
        });
        expect(execFileMock.mock.calls[0][0]).toBe('fc-list');
        expect(execFileMock.mock.calls[0][1]).toEqual([
            '--format=%{family[0]}|%{weight}\\n',
        ]);
    });

    test('rejects when the command fails', async () => {
        setPlatform('win32');
        answerExecFile(() => {
            throw new Error('powershell failed');
        });

        await expect(getSystemFontListMap()).rejects.toThrow(
            'powershell failed',
        );
    });
});
