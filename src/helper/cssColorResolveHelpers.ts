/**
 * Any CSS colour Chromium knows -- `gold`, `rgb(255 0 0)`, `hsl(...)` -- as
 * `#rrggbb(aa)`, or null. A leaf: the foreground and screen workers both hand
 * it to the colour rules (`toForegroundHexColor`) for the words those rules'
 * own list does not hold, and neither should load the other for it.
 */
export function resolveCssColor(value: string) {
    try {
        const context = document.createElement('canvas').getContext('2d');
        if (context === null) {
            return null;
        }
        context.fillStyle = '#010203';
        context.fillStyle = value;
        const resolved = String(context.fillStyle);
        if (resolved === '#010203') {
            return null;
        }
        if (resolved.startsWith('#')) {
            return resolved;
        }
        const match =
            /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/.exec(
                resolved,
            );
        if (match === null) {
            return null;
        }
        const toHex = (part: number) => {
            return Math.round(part).toString(16).padStart(2, '0');
        };
        const alpha =
            match[4] === undefined ? '' : toHex(Number(match[4]) * 255);
        return `#${toHex(Number(match[1]))}${toHex(Number(match[2]))}${toHex(Number(match[3]))}${alpha}`;
    } catch {
        return null;
    }
}
