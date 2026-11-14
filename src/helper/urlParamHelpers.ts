/**
 * Reading and writing a page address's search parameters.
 *
 * A LEAF, re-exported by `domHelpers` for its existing callers: the popup
 * openers that a locked-down window (the Markdown Preview) imports at a
 * press must not pull `domHelpers`, whose module-level IPC listeners a
 * locked-down reader must not load (memory `renderer-entry-static-closure`).
 */

function toURLObject(urlOrPathname: string) {
    return new URL(urlOrPathname, globalThis.location.href);
}
// Preserve the caller's URL shape: an absolute input serializes back to an
// absolute URL, a relative path back to a "pathname?search#hash" string.
function serializeURL(urlObject: URL, urlOrPathname: string) {
    return URL.canParse(urlOrPathname)
        ? urlObject.toString()
        : urlObject.pathname + urlObject.search + urlObject.hash;
}

export function getParamKeyValue(urlOrPathname: string, key: string) {
    return toURLObject(urlOrPathname).searchParams.get(key);
}
export function setParamKeyValue(
    urlOrPathname: string,
    key: string,
    value: string,
) {
    const urlObject = toURLObject(urlOrPathname);
    urlObject.searchParams.set(key, value);
    return serializeURL(urlObject, urlOrPathname);
}
export function getParamIdNum(urlOrPathname: string) {
    const id = getParamKeyValue(urlOrPathname, 'id');
    const idNum = Number.parseInt(id ?? '');
    if (Number.isNaN(idNum)) {
        return null;
    }
    return idNum;
}
export function setParamIdNum(urlOrPathname: string, idNum: number) {
    return setParamKeyValue(urlOrPathname, 'id', idNum.toString());
}
export function getParamFileFullName(urlOrPathname: string) {
    return getParamKeyValue(urlOrPathname, 'file');
}
export function setParamFileFullName(
    urlOrPathname: string,
    fileFullName: string,
) {
    return setParamKeyValue(urlOrPathname, 'file', fileFullName);
}
