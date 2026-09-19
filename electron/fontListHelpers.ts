import { execFile } from 'node:child_process';
import path from 'node:path';

/**
 * The installed font families and, for each, the CSS font weights it really
 * ships: `{ 'Segoe UI': ['300', '350', '400', '600', '700', '900'] }`.
 *
 * This replaced the `font-list` package, which named a family but never its
 * weights, so every family came back `[]` and the weight picker beside the
 * family picker never rendered. Each platform is asked through its own font
 * API in ONE child process (the caller keeps the answer for the app run):
 *
 * - Windows: WPF's `GetTypefaces()`, which reads each face's real OpenType
 *   weight and says whether that face is one WPF would SIMULATE rather than one
 *   the family ships. The research in `extra-work/font/find-font-files.ps1` loaded every
 *   font FILE and guessed the style from its name: ~11 s, and it called
 *   `segoeuib.ttf` and `Battambang-Bold.ttf` Regular. This takes ~2 s with
 *   PowerShell's own start-up. The per-user font folder that research found is
 *   read too: a double-clicked install lands there, which is where a Khmer
 *   font usually is, and a system list that leaves it out loses that font.
 * - macOS: `NSFontManager` through JXA, a face's weight read off its style
 *   name and then AppKit's 0-15 scale; `system_profiler` if that fails.
 * - Linux: `fc-list`, fontconfig's weight scale mapped onto CSS.
 */
export type FontListMapType = Record<string, string[]>;

type WeightMapType = Map<string, Set<number>>;

const COMMAND_TIMEOUT_MS = 60_000;
const COMMAND_MAX_BUFFER = 10 * 1024 * 1024;

// One line per family: the name, a tab, then every face's weight. Duplicates
// (italics, and a per-user family the system list already had) are merged by
// the parser rather than in PowerShell, which is slow at it.
const WIN32_FONT_SCRIPT = [
    "$ProgressPreference = 'SilentlyContinue'",
    '[Console]::OutputEncoding = New-Object Text.UTF8Encoding $false',
    'Add-Type -AssemblyName PresentationCore',
    "$en = [Windows.Markup.XmlLanguage]::GetLanguage('en-us')",
    '$out = [Console]::Out',
    'function Write-Family($family) {',
    '    $name = $null',
    '    if (-not $family.FamilyNames.TryGetValue($en, [ref]$name)) {',
    '        foreach ($value in $family.FamilyNames.Values) { $name = $value; break }',
    '    }',
    '    if (-not $name) { return }',
    // NOT `FamilyTypefaces`: that lists the faces WPF would SIMULATE as well as
    // the ones the family ships, so every single-weight family came back
    // `400,700` -- 113 of the 240 families on the dev machine, Jokerman and
    // Algerian among them, and the Khmer `Moul` and `Khmer OS Battambang` a
    // church actually presents in. Picking that bold got Chromium's synthetic
    // one, and the weight picker never hid itself for a one-weight family
    // (9 such families by that list against 122 real ones). `GetTypefaces()`
    // carries `IsBoldSimulated`; the weight read off the face is the same.
    '    $weights = foreach ($typeface in $family.GetTypefaces()) {',
    '        if (-not $typeface.IsBoldSimulated) { $typeface.Weight.ToOpenTypeWeight() }',
    '    }',
    "    $out.WriteLine($name + [char]9 + ($weights -join ','))",
    '}',
    'foreach ($family in [Windows.Media.Fonts]::SystemFontFamilies) { Write-Family $family }',
    "$userFontDir = Join-Path $env:LOCALAPPDATA 'Microsoft\\Windows\\Fonts'",
    'if (Test-Path $userFontDir) {',
    "    foreach ($family in [Windows.Media.Fonts]::GetFontFamilies($userFontDir + '\\')) { Write-Family $family }",
    '}',
].join('\n');

const DARWIN_FONT_SCRIPT = [
    "ObjC.import('AppKit');",
    'var manager = $.NSFontManager.sharedFontManager;',
    'var families = ObjC.deepUnwrap(manager.availableFontFamilies) || [];',
    'var result = [];',
    'for (var i = 0; i < families.length; i++) {',
    '    var members = ObjC.deepUnwrap(manager.availableMembersOfFontFamily(families[i])) || [];',
    '    var faces = [];',
    '    for (var j = 0; j < members.length; j++) {',
    '        faces.push([members[j][1], members[j][2]]);',
    '    }',
    '    result.push([families[i], faces]);',
    '}',
    'JSON.stringify(result);',
].join('\n');

// `|` rather than a tab: fontconfig's format escapes are the one part of this
// that could not be run here, and the weight after the last `|` never holds one.
const LINUX_FC_LIST_FORMAT = '--format=%{family[0]}|%{weight}\\n';

function runCommand(file: string, args: string[]) {
    return new Promise<string>((resolve, reject) => {
        execFile(
            file,
            args,
            {
                encoding: 'utf8',
                maxBuffer: COMMAND_MAX_BUFFER,
                timeout: COMMAND_TIMEOUT_MS,
                windowsHide: true,
            },
            (error, stdout) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve(stdout);
            },
        );
    });
}

// By full path: Windows looks in the working directory before PATH for a bare
// program name.
function getPowerShellPath() {
    return path.win32.join(
        process.env.SystemRoot ?? 'C:\\Windows',
        'System32',
        'WindowsPowerShell',
        'v1.0',
        'powershell.exe',
    );
}

function addFamilyWeights(
    weightMap: WeightMapType,
    family: string,
    weights: number[],
) {
    const name = family.replace(/^\uFEFF/, '').trim();
    if (name === '') {
        return;
    }
    let weightSet = weightMap.get(name);
    if (weightSet === undefined) {
        weightSet = new Set();
        weightMap.set(name, weightSet);
    }
    for (const weight of weights) {
        if (Number.isFinite(weight) && weight >= 1 && weight <= 1000) {
            weightSet.add(Math.round(weight));
        }
    }
}

function toFontListMap(weightMap: WeightMapType) {
    const families = [...weightMap.keys()].sort((a, b) => {
        return a.localeCompare(b, undefined, { sensitivity: 'base' });
    });
    const fontListMap: FontListMapType = {};
    for (const family of families) {
        const weights = [...(weightMap.get(family) ?? [])];
        fontListMap[family] = weights
            .sort((a, b) => {
                return a - b;
            })
            .map(String);
    }
    return fontListMap;
}

export function parseWin32FontList(stdout: string) {
    const weightMap: WeightMapType = new Map();
    for (const line of stdout.split(/\r?\n/)) {
        const tabIndex = line.indexOf('\t');
        if (tabIndex < 0) {
            continue;
        }
        const weights = line
            .slice(tabIndex + 1)
            .split(',')
            .filter((text) => {
                return text.trim() !== '';
            })
            .map(Number);
        addFamilyWeights(weightMap, line.slice(0, tabIndex), weights);
    }
    return toFontListMap(weightMap);
}

// Most specific first: `SemiBold` must not be read as `Bold`, nor
// `ExtraLight` as `Light`. No word boundaries, because names are CamelCase.
const STYLE_NAME_WEIGHT_LIST: [RegExp, number][] = [
    [/(extra|ultra)[\s-]*light/i, 200],
    [/(semi|demi)[\s-]*light/i, 350],
    [/(semi|demi)[\s-]*bold/i, 600],
    [/(extra|ultra)[\s-]*bold/i, 800],
    [/thin|hairline/i, 100],
    [/light/i, 300],
    [/medium/i, 500],
    [/bold/i, 700],
    [/black|heavy/i, 900],
    [/regular|normal|book|roman|plain/i, 400],
];

export function styleNameToCssWeight(styleName: string) {
    for (const [pattern, weight] of STYLE_NAME_WEIGHT_LIST) {
        if (pattern.test(styleName)) {
            return weight;
        }
    }
    return null;
}

// AppKit weighs a face from 0 to 15, 5 being regular and 9 bold.
const APP_KIT_CSS_WEIGHT_LIST = [
    100, 100, 100, 200, 300, 400, 500, 500, 600, 700, 800, 800, 900, 900, 900,
    900,
];

export function appKitWeightToCssWeight(appKitWeight: number) {
    const index = Math.min(15, Math.max(0, Math.round(appKitWeight)));
    return APP_KIT_CSS_WEIGHT_LIST[index];
}

function toDarwinFaceWeight(face: unknown) {
    if (!Array.isArray(face)) {
        return null;
    }
    const [styleName, appKitWeight] = face;
    const weight =
        typeof styleName === 'string' ? styleNameToCssWeight(styleName) : null;
    if (weight !== null) {
        return weight;
    }
    return typeof appKitWeight === 'number'
        ? appKitWeightToCssWeight(appKitWeight)
        : null;
}

export function parseDarwinFontList(stdout: string) {
    let families: unknown = JSON.parse(stdout);
    // In case osascript ever prints the returned string as a quoted literal.
    if (typeof families === 'string') {
        families = JSON.parse(families);
    }
    if (!Array.isArray(families)) {
        throw new Error('Unexpected font list from NSFontManager');
    }
    const weightMap: WeightMapType = new Map();
    for (const entry of families) {
        if (!Array.isArray(entry) || typeof entry[0] !== 'string') {
            continue;
        }
        const faces: unknown[] = Array.isArray(entry[1]) ? entry[1] : [];
        const weights = faces.map(toDarwinFaceWeight).filter((weight) => {
            return weight !== null;
        });
        addFamilyWeights(weightMap, entry[0], weights);
    }
    return toFontListMap(weightMap);
}

type SystemProfilerFontsType = {
    SPFontsDataType?: {
        typefaces?: { family?: unknown; style?: unknown }[];
    }[];
};

export function parseSystemProfilerFontList(stdout: string) {
    const data = JSON.parse(stdout) as SystemProfilerFontsType;
    const weightMap: WeightMapType = new Map();
    for (const fontFile of data.SPFontsDataType ?? []) {
        for (const typeface of fontFile.typefaces ?? []) {
            if (typeof typeface.family !== 'string') {
                continue;
            }
            const weight =
                typeof typeface.style === 'string'
                    ? styleNameToCssWeight(typeface.style)
                    : null;
            addFamilyWeights(
                weightMap,
                typeface.family,
                weight === null ? [] : [weight],
            );
        }
    }
    return toFontListMap(weightMap);
}

// fontconfig's named weights against the OpenType ones they stand for
// (`FC_WEIGHT_THIN` 0 is 100 ... `FC_WEIGHT_EXTRABLACK` 215 is 1000).
const FONTCONFIG_WEIGHT_STOP_LIST: [number, number][] = [
    [0, 100],
    [40, 200],
    [50, 300],
    [55, 350],
    [75, 380],
    [80, 400],
    [100, 500],
    [180, 600],
    [200, 700],
    [205, 800],
    [210, 900],
    [215, 1000],
];

export function fontconfigWeightToCssWeight(fontconfigWeight: number) {
    const stops = FONTCONFIG_WEIGHT_STOP_LIST;
    if (fontconfigWeight <= stops[0][0]) {
        return stops[0][1];
    }
    for (let i = 1; i < stops.length; i++) {
        const [toFontconfig, toCss] = stops[i];
        if (fontconfigWeight <= toFontconfig) {
            const [fromFontconfig, fromCss] = stops[i - 1];
            const cssWeight =
                fromCss +
                ((fontconfigWeight - fromFontconfig) * (toCss - fromCss)) /
                    (toFontconfig - fromFontconfig);
            return Math.round(cssWeight / 50) * 50;
        }
    }
    return stops[stops.length - 1][1];
}

// A variable font prints its weight axis as a range, `[0 210]`, and can be
// set to every standard weight between its ends.
function readFontconfigWeights(text: string) {
    const cssWeights = (text.match(/-?\d+(\.\d+)?/g) ?? []).map((number) => {
        return fontconfigWeightToCssWeight(Number(number));
    });
    if (!text.includes('[') || cssWeights.length < 2) {
        return cssWeights;
    }
    const low = Math.min(...cssWeights);
    const high = Math.max(...cssWeights);
    const weights = [low, high];
    for (
        let weight = Math.ceil(low / 100) * 100;
        weight <= high;
        weight += 100
    ) {
        weights.push(weight);
    }
    return weights;
}

export function parseLinuxFontList(stdout: string) {
    const weightMap: WeightMapType = new Map();
    for (const line of stdout.split(/\r?\n/)) {
        const separatorIndex = line.lastIndexOf('|');
        if (separatorIndex < 0) {
            continue;
        }
        addFamilyWeights(
            weightMap,
            line.slice(0, separatorIndex),
            readFontconfigWeights(line.slice(separatorIndex + 1)),
        );
    }
    return toFontListMap(weightMap);
}

async function getDarwinFontListMap() {
    try {
        const fontListMap = parseDarwinFontList(
            await runCommand('/usr/bin/osascript', [
                '-l',
                'JavaScript',
                '-e',
                DARWIN_FONT_SCRIPT,
            ]),
        );
        if (Object.keys(fontListMap).length > 0) {
            return fontListMap;
        }
    } catch (error) {
        console.log(error);
    }
    return parseSystemProfilerFontList(
        await runCommand('/usr/sbin/system_profiler', [
            '-json',
            'SPFontsDataType',
        ]),
    );
}

export async function getSystemFontListMap(): Promise<FontListMapType> {
    if (process.platform === 'win32') {
        const encodedScript = Buffer.from(
            WIN32_FONT_SCRIPT,
            'utf16le',
        ).toString('base64');
        return parseWin32FontList(
            await runCommand(getPowerShellPath(), [
                '-NoProfile',
                '-NonInteractive',
                '-EncodedCommand',
                encodedScript,
            ]),
        );
    }
    if (process.platform === 'darwin') {
        return await getDarwinFontListMap();
    }
    return parseLinuxFontList(
        await runCommand('fc-list', [LINUX_FC_LIST_FORMAT]),
    );
}
