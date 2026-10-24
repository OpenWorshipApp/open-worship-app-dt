// A path primitive with nothing under it -- no `appProvider`, no imports --
// so the help window's handoff store and its tests can use it without the
// file layer. Everything else asks `fileHelpers`, which re-exports it.

// A home folder on any OS, whichever way its separators lean -- and as the
// `file:///C:/Users/...` a console writes it. The name under it runs to the
// next separator, spaces and all (`C:\Users\Sokha Chan\...`); with nothing
// after it, to the end of the word.
const HOME_PATH_PATTERN =
    /((?:[A-Za-z]:)?[\\/]+(?:Users|home|Documents and Settings)[\\/]+)(?:[^\\/"'<>:|\r\n]{1,40}(?=[\\/])|[^\\/\s"'<>:|)]+)/gi;

/**
 * Text without the name of the computer's account in it: a path under a
 * home folder keeps its shape and loses whose it is --
 * `C:\Users\~\AppData\...`, `/home/~/.config/...`. An error message and a
 * console line are where such a path turns up, and a problem report is a
 * document handed to a stranger.
 */
export function toPathScrubbed(text: string) {
    return text.replace(HOME_PATH_PATTERN, '$1~');
}
