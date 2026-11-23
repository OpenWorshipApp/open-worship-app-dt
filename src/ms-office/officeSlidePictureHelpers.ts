// A PICTURE put on a slide, or in the place of one there, for
// `owa_office_edit` (2026-11-20, `EC-770`, the goal _chatbot can change do
// everything on a given pptx_: "put this photo on slide 3" and "use my
// picture instead of the curtain" were the last things only PowerPoint
// did). The person's own picture, attached to the chat from a folder.
//
// Pure, strings and bytes in and out: what kind of picture the bytes are
// and how big, read off their header alone (nothing is decoded), where it
// goes, how it is cropped to its box, and the slide's XML.

import {
    type BoxPlaceType,
    type SlideSizeType,
    findFreeBoxName,
} from './officeSlideBoxHelpers';

export type OfficePictureInfoType = {
    // the media part's extension, as PowerPoint writes it
    extension: 'png' | 'jpeg' | 'gif' | 'bmp';
    contentType: string;
    width: number;
    height: number;
};

const CONTENT_TYPE_MAP: Record<OfficePictureInfoType['extension'], string> = {
    png: 'image/png',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    bmp: 'image/bmp',
};

function readUint16BigEndian(bytes: Uint8Array, at: number) {
    return (bytes[at] << 8) | bytes[at + 1];
}

function readUint16LittleEndian(bytes: Uint8Array, at: number) {
    return bytes[at] | (bytes[at + 1] << 8);
}

function readUint32BigEndian(bytes: Uint8Array, at: number) {
    return (
        ((bytes[at] << 24) >>> 0) +
        (bytes[at + 1] << 16) +
        (bytes[at + 2] << 8) +
        bytes[at + 3]
    );
}

function readInt32LittleEndian(bytes: Uint8Array, at: number) {
    return (
        bytes[at] |
        (bytes[at + 1] << 8) |
        (bytes[at + 2] << 16) |
        (bytes[at + 3] << 24)
    );
}

// A JPEG's size is in its first start-of-frame marker: every marker but the
// lone ones is a length and its bytes, stepped over.
function readJpegSize(bytes: Uint8Array) {
    let at = 2;
    while (at + 9 < bytes.length) {
        if (bytes[at] !== 0xff) {
            at++;
            continue;
        }
        const marker = bytes[at + 1];
        if (marker === 0xff) {
            at++;
            continue;
        }
        if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
            at += 2;
            continue;
        }
        const isFrame =
            marker >= 0xc0 &&
            marker <= 0xcf &&
            marker !== 0xc4 &&
            marker !== 0xc8 &&
            marker !== 0xcc;
        if (isFrame) {
            return {
                height: readUint16BigEndian(bytes, at + 5),
                width: readUint16BigEndian(bytes, at + 7),
            };
        }
        at += 2 + readUint16BigEndian(bytes, at + 2);
    }
    return null;
}

/**
 * The kind of picture these bytes are and its size in pixels, from the
 * header alone: PNG, JPEG, GIF or BMP -- what every PowerPoint draws -- or
 * null for anything else, or a picture with no size.
 */
export function readPictureInfo(
    bytes: Uint8Array,
): OfficePictureInfoType | null {
    let found: Omit<OfficePictureInfoType, 'contentType'> | null = null;
    if (
        bytes.length > 24 &&
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47
    ) {
        found = {
            extension: 'png',
            width: readUint32BigEndian(bytes, 16),
            height: readUint32BigEndian(bytes, 20),
        };
    } else if (bytes.length > 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
        const size = readJpegSize(bytes);
        found = size === null ? null : { extension: 'jpeg', ...size };
    } else if (
        bytes.length > 10 &&
        String.fromCharCode(...bytes.slice(0, 4)) === 'GIF8'
    ) {
        found = {
            extension: 'gif',
            width: readUint16LittleEndian(bytes, 6),
            height: readUint16LittleEndian(bytes, 8),
        };
    } else if (bytes.length > 26 && bytes[0] === 0x42 && bytes[1] === 0x4d) {
        found = {
            extension: 'bmp',
            width: Math.abs(readInt32LittleEndian(bytes, 18)),
            height: Math.abs(readInt32LittleEndian(bytes, 22)),
        };
    }
    if (found === null || found.width <= 0 || found.height <= 0) {
        return null;
    }
    return { ...found, contentType: CONTENT_TYPE_MAP[found.extension] };
}

/**
 * Where a new picture goes, in EMU: `at` [x, y, width, height] in % of the
 * slide, a `null` worked out -- a width or a height from the other by the
 * picture's own shape, both when neither is given (it fits in three fifths
 * of the slide), x and y centring it; both given, it is fitted inside the
 * area they mark, centred in it, unless that is the whole slide -- or a
 * `reason`.
 */
export function toPicturePlace(
    at: readonly (number | null)[] | undefined,
    info: OfficePictureInfoType,
    size: SlideSizeType,
): BoxPlaceType | { reason: string } {
    const asked = at ?? [null, null, null, null];
    if (
        asked.length !== 4 ||
        asked.some((value) => {
            return value !== null && !Number.isFinite(value);
        })
    ) {
        return {
            reason:
                '`at` is [x, y, width, height] in % of the slide; null ' +
                "works one out from the picture's own shape.",
        };
    }
    const [x, y, width, height] = asked;
    const ratio = info.width / info.height;
    let cx = width === null ? null : (width / 100) * size.cx;
    let cy = height === null ? null : (height / 100) * size.cy;
    // the area a width AND a height mark out: the picture goes inside it,
    // its shape kept and nothing cut off (_on the right side_ had been a
    // tall area, and the choir photo lost a quarter off each side) --
    // unless the area is the whole slide, a background, filled
    let areaX = x === null ? null : (x / 100) * size.cx;
    let areaY = y === null ? null : (y / 100) * size.cy;
    if (cx !== null && cy !== null) {
        const area = {
            x: areaX ?? (size.cx - cx) / 2,
            y: areaY ?? (size.cy - cy) / 2,
            cx,
            cy,
        };
        if (!checkIsFillingPlace(area, size)) {
            const fitWidth = Math.min(cx, cy * ratio);
            const fitHeight = fitWidth / ratio;
            areaX = areaX === null ? null : areaX + (cx - fitWidth) / 2;
            areaY = areaY === null ? null : areaY + (cy - fitHeight) / 2;
            cx = fitWidth;
            cy = fitHeight;
        }
    } else if (cx === null && cy === null) {
        const fit = Math.min((size.cx * 0.6) / ratio, size.cy * 0.6);
        cy = fit;
        cx = fit * ratio;
    } else if (cx === null) {
        cx = (cy as number) * ratio;
    } else {
        cy = cx / ratio;
    }
    const place = {
        x: Math.round(areaX ?? (size.cx - (cx as number)) / 2),
        y: Math.round(areaY ?? (size.cy - (cy as number)) / 2),
        cx: Math.round(cx as number),
        cy: Math.round(cy as number),
    };
    if (
        place.cx <= 0 ||
        place.cy <= 0 ||
        place.cx > size.cx * 5 ||
        place.cy > size.cy * 5
    ) {
        return {
            reason:
                "A picture's width and height are more than 0 and at most " +
                '500 (% of the slide).',
        };
    }
    return place;
}

/**
 * Whether a place covers the whole slide (within half a percent): such a
 * picture goes BEHIND the words, as a deck's own curtain does.
 */
export function checkIsFillingPlace(place: BoxPlaceType, size: SlideSizeType) {
    const slackX = size.cx * 0.005;
    const slackY = size.cy * 0.005;
    return (
        place.x <= slackX &&
        place.y <= slackY &&
        place.x + place.cx >= size.cx - slackX &&
        place.y + place.cy >= size.cy - slackY
    );
}

/**
 * The crop that fills a box of `place`'s shape with the picture without
 * squeezing it -- the middle kept, as PowerPoint's Fill does -- or '' when
 * the shapes already match.
 */
export function genPictureCropXml(
    info: OfficePictureInfoType,
    place: BoxPlaceType,
) {
    const pictureRatio = info.width / info.height;
    const boxRatio = place.cx / place.cy;
    if (Math.abs(pictureRatio - boxRatio) / boxRatio < 0.005) {
        return '';
    }
    if (pictureRatio > boxRatio) {
        const side = Math.round(((1 - boxRatio / pictureRatio) / 2) * 100000);
        return `<a:srcRect l="${side}" r="${side}"/>`;
    }
    const side = Math.round(((1 - pictureRatio / boxRatio) / 2) * 100000);
    return `<a:srcRect t="${side}" b="${side}"/>`;
}

/**
 * The names of the boxes holding words that a picture put IN FRONT at `at`
 * ([x, y, width, height] in % of the slide) lies over by a twentieth of
 * their area or more -- said with the change, as the live run found: _put
 * this photo on slide 2, on the right side_ covered half the verse and the
 * answer never said so.
 */
export function listCoveredWordBoxes(
    at: readonly number[],
    boxes: readonly {
        name: string;
        at: readonly number[] | null;
        lineIds: readonly string[];
    }[],
) {
    const [x, y, width, height] = at;
    return boxes
        .filter((box) => {
            if (box.at === null || box.lineIds.length === 0) {
                return false;
            }
            const [boxX, boxY, boxWidth, boxHeight] = box.at;
            const across =
                Math.min(x + width, boxX + boxWidth) - Math.max(x, boxX);
            const down =
                Math.min(y + height, boxY + boxHeight) - Math.max(y, boxY);
            return (
                across > 0 &&
                down > 0 &&
                across * down >= boxWidth * boxHeight * 0.05
            );
        })
        .map((box) => {
            return box.name;
        });
}

const RELATIONSHIP_NAMESPACE =
    'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

// The slide's root declares the `r:` prefix a picture's `r:embed` needs;
// one that does not is given it.
export function withRelationshipNamespace(slideXml: string) {
    return slideXml.replace(/<p:sld\b[^>]*>/, (tag) => {
        return /\sxmlns:r=/.test(tag)
            ? tag
            : tag.replace(
                  /^<p:sld\b/,
                  `<p:sld xmlns:r="${RELATIONSHIP_NAMESPACE}"`,
              );
    });
}

function escapeAttribute(value: string) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * The slide with a new picture: `relId` its image's relationship, `place`
 * where it goes, `cropXml` its crop. In front of everything, or -- `isBehind`,
 * a picture filling the slide -- behind everything, the first box. Null
 * when the slide has no box tree.
 */
export function addSlidePictureXml(
    slideXml: string,
    relId: string,
    place: BoxPlaceType,
    cropXml: string,
    isBehind: boolean,
    description: string,
) {
    const xml = withRelationshipNamespace(slideXml);
    const { id, name } = findFreeBoxName(xml, 'Picture');
    const boxXml =
        `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="${name}" ` +
        `descr="${escapeAttribute(description)}"/><p:cNvPicPr>` +
        '<a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>' +
        `<p:blipFill><a:blip r:embed="${relId}"/>${cropXml}<a:stretch>` +
        '<a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm>' +
        `<a:off x="${place.x}" y="${place.y}"/>` +
        `<a:ext cx="${place.cx}" cy="${place.cy}"/></a:xfrm>` +
        '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>';
    let at: number;
    if (isBehind) {
        // after the tree's own two properties, before its first box
        const treeStart = /<p:spTree\b[^>]*>/.exec(xml);
        if (treeStart === null) {
            return null;
        }
        const rest = xml.slice(treeStart.index + treeStart[0].length);
        const own =
            /^\s*<p:nvGrpSpPr\b[\s\S]*?<\/p:nvGrpSpPr>\s*(?:<p:grpSpPr\b[^>]*\/>|<p:grpSpPr\b[\s\S]*?<\/p:grpSpPr>)?/.exec(
                rest,
            );
        at = treeStart.index + treeStart[0].length + (own?.[0].length ?? 0);
    } else {
        at = xml.lastIndexOf('</p:spTree>');
        if (at < 0) {
            return null;
        }
    }
    return { xml: xml.slice(0, at) + boxXml + xml.slice(at), name };
}

/** The relationship id a box draws its picture from, or null. */
export function readBoxPictureRelId(boxXml: string) {
    return /<a:blip\b[^>]*?\sr:embed="([^"]*)"/.exec(boxXml)?.[1] ?? null;
}

/**
 * A box that draws a picture, given another: its `a:blip` pointed at
 * `relId`, and its crop made `cropXml` (an old crop taken away). Null when
 * the box draws no picture.
 */
export function setBoxPictureXml(
    boxXml: string,
    relId: string,
    cropXml: string,
) {
    const blip =
        /<a:blip\b(?:[^>"']|"[^"]*"|'[^']*')*?(\/>|>[\s\S]*?<\/a:blip>)/.exec(
            boxXml,
        );
    if (blip === null || !/\sr:embed="/.test(blip[0])) {
        return null;
    }
    const pointed = blip[0].replace(/\sr:embed="[^"]*"/, ` r:embed="${relId}"`);
    const before = boxXml.slice(0, blip.index);
    const after = boxXml
        .slice(blip.index + blip[0].length)
        .replace(/^\s*<a:srcRect\b[^>]*\/>/, '');
    return before + pointed + cropXml + after;
}
