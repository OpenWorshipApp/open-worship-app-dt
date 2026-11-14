// Text and attribute values made safe for an Office package's XML. A leaf:
// imported by the `.docx` writers without the file helpers behind them.

// XML 1.0 cannot represent these at all, not even as entities. Verse text, a
// page's words and font names come from files the person brought in, and
// letting one through yields a `document.xml` that Word refuses to open.
// eslint-disable-next-line no-control-regex -- matching them is the point
const INVALID_XML_CHAR_REGEX = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g;

export function escapeXMLText(value: string) {
    return value
        .replaceAll(INVALID_XML_CHAR_REGEX, '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
}

export function escapeXMLAttribute(value: string) {
    return escapeXMLText(value).replaceAll('"', '&quot;');
}
