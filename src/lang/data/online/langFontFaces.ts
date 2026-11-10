// A language's own fonts as `@font-face` rules, from its `fonts.json` -- the
// one generator every language shares: each online language through the
// factory (`./onlineLangPackage.ts`) and English, the built-in one, from
// `../en/index.ts` (its Google Sans is the app's default face, 2026-11-06).
// Lying directly in `online/`, which every plugin build may bundle; it
// imports nothing.

// `fonts.json` + `fonts/`: the fonts the language ships.
export type LangFontsFileType = {
    // The family the app's own UI uses.
    uiFamily: string;
    // The font's real name: a slide, a song or a PowerPoint asking for it is
    // answered by the shipped file.
    family: string;
    // `style` absent means upright.
    faces: { file: string; weight: string; style?: 'italic' }[];
    // How text waits for one of these faces while it loads (`font-display`).
    // Absent is the browser's own `block`: every label in the face is drawn
    // INVISIBLE until its file arrives, for up to 3 s, in every new window --
    // each window is a renderer of its own and loads its own copy.
    display?: 'auto' | 'block' | 'swap' | 'fallback' | 'optional';
    // Other designs a document may ask for: one installed on the computer
    // wins, else the shipped regular face draws it.
    lookAlikes?: string[];
    stickyNote?: { family: string; file: string };
    // Where its faces sit in the song editor's font list.
    songOrder?: number;
};

/** Every font file a `fonts.json` names, each once, in the order it names them. */
export function listLangFontFileNames(fonts: LangFontsFileType) {
    const fileNames = [
        ...fonts.faces.map((face) => {
            return face.file;
        }),
        ...(fonts.stickyNote === undefined ? [] : [fonts.stickyNote.file]),
    ];
    return [...new Set(fileNames)];
}

type OpenLyricFontSectionType = {
    title: string;
    fontFaces: string[];
    indexRange: number;
};

/**
 * A language's own section of a song's font list (a song previewer's, the
 * Lyric Editor's and its Markdown manager's): its `app-…` face, at its
 * `songOrder`. The one place both the plugin's factory and the app's
 * fonts-only reading (`src/lang/langFontDataHelpers.ts`) say it, so a song
 * lists the same faces whichever of them registered the language.
 */
export function applyLangOpenLyricFontFaces(
    fonts: LangFontsFileType,
    title: string,
    {
        openLyric,
        openLyricMarkdownManager,
        genOpenLyricFontFaces,
    }: {
        openLyric?: { fontFaces: any };
        openLyricMarkdownManager?: { fontFaces: any };
        genOpenLyricFontFaces: (
            fontFacesList: any,
            fontFaceData: OpenLyricFontSectionType,
        ) => OpenLyricFontSectionType[];
    },
) {
    const option: OpenLyricFontSectionType = {
        title,
        fontFaces: [fonts.uiFamily],
        indexRange: fonts.songOrder ?? 0,
    };
    if (openLyric !== undefined) {
        openLyric.fontFaces = genOpenLyricFontFaces(openLyric.fontFaces ?? [], {
            ...option,
        });
    }
    if (openLyricMarkdownManager !== undefined) {
        openLyricMarkdownManager.fontFaces = genOpenLyricFontFaces(
            openLyricMarkdownManager.fontFaces ?? [],
            { ...option },
        );
    }
}

function genFontFaceCss(
    family: string,
    src: string,
    weight: string,
    style: string | undefined,
    display: string | undefined,
) {
    // Each written only when set, so a sheet without them reads as it always
    // has (every installed plugin was built before they existed).
    const styleLine = style === undefined ? '' : `\n    font-style: ${style};`;
    const displayLine =
        display === undefined ? '' : `\n    font-display: ${display};`;
    return `@font-face {
    font-family: ${family};
    src: ${src};
    font-weight: ${weight};${styleLine}${displayLine}
}`;
}

export function genFontsData(
    fonts: LangFontsFileType,
    fontUrls: Record<string, string>,
) {
    const toUrl = (file: string) => {
        const url = fontUrls[file];
        if (url === undefined) {
            throw new Error(`fonts.json names ${file}, which was not found.`);
        }
        return url;
    };
    const toSrc = (file: string) => {
        return `url(${toUrl(file)}) format("truetype")`;
    };
    const regularFace = fonts.faces[0];
    const { stickyNote, display } = fonts;
    // A face is fetched only when text uses it.
    const css = [
        ...fonts.faces.map((face) => {
            return genFontFaceCss(
                fonts.uiFamily,
                toSrc(face.file),
                face.weight,
                face.style,
                display,
            );
        }),
        ...(stickyNote === undefined
            ? []
            : [
                  genFontFaceCss(
                      stickyNote.family,
                      toSrc(stickyNote.file),
                      'normal',
                      undefined,
                      display,
                  ),
              ]),
        // A font installed on the presenting computer never reaches a phone
        // or TV watching a virtual display, nor a Screen Mirror guest: the
        // real name is answered by the shipped file at once.
        ...fonts.faces.map((face) => {
            return genFontFaceCss(
                `"${fonts.family}"`,
                toSrc(face.file),
                face.weight,
                face.style,
                display,
            );
        }),
        ...(fonts.lookAlikes ?? []).map((family) => {
            return genFontFaceCss(
                `"${family}"`,
                `local("${family}"), ${toSrc(regularFace.file)}`,
                'normal',
                undefined,
                display,
            );
        }),
    ].join('\n');
    const files = [
        ...fonts.faces.map((face) => {
            return face.file;
        }),
        ...(stickyNote === undefined ? [] : [stickyNote.file]),
    ];
    return {
        css,
        fileUrls: files.map(toUrl),
    };
}
