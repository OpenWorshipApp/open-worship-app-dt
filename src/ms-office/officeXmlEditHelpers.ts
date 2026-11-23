// The words of ONE part of a PowerPoint or Word package -- a slide, a notes
// page, a Word body -- read as lines and changed in place (2026-11-20, the
// user: _open pptx or docx in chatbot then interact to edit the powerpoint_).
//
// Pure: strings in, strings out, every rule a test. No DOM parser on
// purpose: a Word body is megabytes, and re-serialising it through a DOM
// rewrites every namespace and attribute Office wrote. A tag scanner finds
// the paragraphs, and a change touches only the characters it must:
//
//   - a change of words inside a line goes into the text node(s) it covers
//     and nowhere else (`replaceParagraphRange`), so a bold word, a colour, a
//     link or a field beside it keeps its run;
//   - only when a line break or a tab is written, or one is crossed, is the
//     line rebuilt (`rebuildParagraph`) -- its paragraph properties kept, the
//     first run's look given to the new words, and every run that carries no
//     words (a picture, a field's code, a bookmark) left where it was.
//
// A paragraph holding another (the line a Word text box is anchored in) is
// not a line here, the text box's own lines are; and the copy Office keeps
// for old readers (`mc:Fallback`) is changed by a word replace only.

export type OfficeDialectType = 'pptx' | 'docx';

type DialectRuleType = {
    paragraph: string;
    text: string;
    run: string;
    props: string;
    breaks: Record<string, '\n' | '\t'>;
};

const DIALECT_MAP: Record<OfficeDialectType, DialectRuleType> = {
    pptx: {
        paragraph: 'a:p',
        text: 'a:t',
        run: 'a:r',
        props: 'a:pPr',
        breaks: { 'a:br': '\n' },
    },
    docx: {
        paragraph: 'w:p',
        text: 'w:t',
        run: 'w:r',
        props: 'w:pPr',
        breaks: { 'w:br': '\n', 'w:cr': '\n', 'w:tab': '\t' },
    },
};

// A run holding one of these is kept even when its words are taken out: it
// carries something that is not words.
const DOCX_KEEPER_PATTERN =
    /<(?:w:drawing|w:pict|w:object|w:fldChar|w:instrText|w:footnoteReference|w:endnoteReference|w:commentReference|w:sym|mc:AlternateContent)[\s/>]/;

// `<a:p>`, `</a:p>`, `<p:cNvPr name="Title 1"/>`: the name, the attributes
// (quoted values may hold `>`), and whether it closes itself.
const TAG_PATTERN =
    /<(\/?)([A-Za-z_][\w.-]*(?::[\w.-]+)?)((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g;

export type TagType = {
    isClose: boolean;
    name: string;
    attributes: string;
    isSelfClosing: boolean;
    start: number;
    end: number;
};

export function* scanTags(
    xml: string,
    from = 0,
    to = xml.length,
): Generator<TagType> {
    const pattern = new RegExp(TAG_PATTERN.source, 'g');
    pattern.lastIndex = from;
    let matched: RegExpExecArray | null;
    while ((matched = pattern.exec(xml)) !== null) {
        if (matched.index >= to) {
            return;
        }
        yield {
            isClose: matched[1] === '/',
            name: matched[2],
            attributes: matched[3],
            isSelfClosing: matched[4] === '/',
            start: matched.index,
            end: matched.index + matched[0].length,
        };
    }
}

function readAttribute(attributes: string, name: string) {
    const matched = new RegExp(
        `(?:^|\\s)${name.replace(/[.:]/g, '\\$&')}\\s*=\\s*("([^"]*)"|'([^']*)')`,
    ).exec(attributes);
    if (matched === null) {
        return null;
    }
    return unescapeXml(matched[2] ?? matched[3] ?? '');
}

export function unescapeXml(text: string) {
    return text.replace(
        /&(?:#x([0-9a-fA-F]+)|#(\d+)|(amp|lt|gt|quot|apos));/g,
        (whole, hex, decimal, named) => {
            if (hex !== undefined) {
                return String.fromCodePoint(Number.parseInt(hex, 16));
            }
            if (decimal !== undefined) {
                return String.fromCodePoint(Number.parseInt(decimal, 10));
            }
            return (
                (
                    {
                        amp: '&',
                        lt: '<',
                        gt: '>',
                        quot: '"',
                        apos: "'",
                    } as Record<string, string>
                )[named] ?? whole
            );
        },
    );
}

export function escapeXmlText(text: string) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// What XML 1.0 cannot hold at all: a model's stray control character would
// make Office refuse the whole file.
const XML_INVALID_PATTERN =
    // eslint-disable-next-line no-control-regex
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g;

export function toXmlSafeText(text: string) {
    return text.replace(/\r\n?/g, '\n').replace(XML_INVALID_PATTERN, '');
}

/**
 * Words a model WROTE for the file: a line break written out as `\n` is the
 * line break it meant (it copies the JSON escaping of the words it was
 * shown -- the slide tool's `toRealLineBreaks`). Measured 2026-11-20 on
 * gemma4:cloud: _Add a translation under each line_ put the backslash and
 * the n on the slide between a line and its translation. Never for a replace's
 * `from`, which must be the file's own words.
 */
export function toWrittenText(text: string) {
    return toXmlSafeText(text.replace(/\\r\\n|\\n/g, '\n'));
}

type SegmentType =
    | {
          kind: 'text';
          // the whole element, `<a:t>…</a:t>`, in the PARAGRAPH's xml
          start: number;
          end: number;
          open: string;
          close: string;
          text: string;
      }
    | {
          kind: 'break';
          start: number;
          end: number;
          text: '\n' | '\t';
      };

export type OfficeParagraphType = {
    // where the paragraph sits in the part
    start: number;
    end: number;
    xml: string;
    text: string;
    // the element it sits in, by where that element starts: lines of one
    // text box, one table cell, one body share it
    containerStart: number;
    // pptx: the box it is in -- its placeholder type ("title", "body"), else
    // its name ("TextBox 3"); docx: its style ("Heading1"), if any
    box: string | null;
    isTable: boolean;
    // the copy Office keeps for old readers, never listed
    isHidden: boolean;
};

function readSegments(
    xml: string,
    rule: DialectRuleType,
): SegmentType[] | null {
    const segments: SegmentType[] = [];
    let propsDepth = 0;
    let openText: TagType | null = null;
    for (const tag of scanTags(xml)) {
        if (tag.name === rule.props) {
            if (tag.isSelfClosing) {
                continue;
            }
            propsDepth += tag.isClose ? -1 : 1;
            continue;
        }
        if (propsDepth > 0) {
            continue;
        }
        if (tag.name === rule.text) {
            if (tag.isSelfClosing) {
                segments.push({
                    kind: 'text',
                    start: tag.start,
                    end: tag.end,
                    open: `<${tag.name}${tag.attributes}>`,
                    close: `</${tag.name}>`,
                    text: '',
                });
            } else if (!tag.isClose) {
                openText = tag;
            } else if (openText !== null) {
                segments.push({
                    kind: 'text',
                    start: openText.start,
                    end: tag.end,
                    open: xml.slice(openText.start, openText.end),
                    close: xml.slice(tag.start, tag.end),
                    text: unescapeXml(xml.slice(openText.end, tag.start)),
                });
                openText = null;
            }
            continue;
        }
        const breakText = Object.hasOwn(rule.breaks, tag.name)
            ? rule.breaks[tag.name]
            : null;
        if (breakText !== null && !tag.isClose) {
            let end = tag.end;
            if (!tag.isSelfClosing) {
                // `<a:br><a:rPr/></a:br>`: the whole element
                const closeIndex = xml.indexOf(`</${tag.name}>`, tag.end);
                if (closeIndex < 0) {
                    return null;
                }
                end = closeIndex + tag.name.length + 3;
            }
            segments.push({
                kind: 'break',
                start: tag.start,
                end,
                text: breakText,
            });
        }
    }
    return segments;
}

function toSegmentsText(segments: SegmentType[]) {
    return segments
        .map((segment) => {
            return segment.text;
        })
        .join('');
}

const SHAPE_NAME_SET = new Set(['p:sp', 'p:graphicFrame', 'p:cxnSp']);

/**
 * Every paragraph of a part, in order. A paragraph holding another is a
 * container, not a line, and is left out; the lines inside it are listed.
 */
export function listOfficeParagraphs(
    xml: string,
    dialect: OfficeDialectType,
): OfficeParagraphType[] {
    const rule = DIALECT_MAP[dialect];
    const out: OfficeParagraphType[] = [];
    // the open elements, each with where it starts
    const stack: { name: string; start: number }[] = [];
    const shapeStack: { name: string; placeholder: string | null }[] = [];
    // the paragraphs open now, each counting the paragraphs inside it
    const paragraphStack: {
        start: number;
        stackIndex: number;
        nestedCount: number;
        style: string | null;
    }[] = [];
    let fallbackDepth = 0;
    let tableDepth = 0;
    for (const tag of scanTags(xml)) {
        if (tag.isClose) {
            // pop to the matching element; a stray close is ignored
            let index = stack.length - 1;
            while (index >= 0 && stack[index].name !== tag.name) {
                index--;
            }
            if (index < 0) {
                continue;
            }
            stack.length = index;
            if (tag.name === 'mc:Fallback') {
                fallbackDepth--;
            } else if (tag.name === 'w:tc' || tag.name === 'a:tc') {
                tableDepth--;
            } else if (SHAPE_NAME_SET.has(tag.name)) {
                shapeStack.pop();
            } else if (tag.name === rule.paragraph) {
                const frame = paragraphStack.pop();
                if (frame === undefined) {
                    continue;
                }
                if (paragraphStack.length > 0) {
                    paragraphStack[paragraphStack.length - 1].nestedCount++;
                }
                if (frame.nestedCount > 0) {
                    continue;
                }
                const paragraphXml = xml.slice(frame.start, tag.end);
                const segments = readSegments(paragraphXml, rule);
                if (segments === null) {
                    continue;
                }
                const container =
                    frame.stackIndex > 0 ? stack[frame.stackIndex - 1] : null;
                const shape =
                    shapeStack.length > 0
                        ? shapeStack[shapeStack.length - 1]
                        : null;
                out.push({
                    start: frame.start,
                    end: tag.end,
                    xml: paragraphXml,
                    text: toSegmentsText(segments),
                    containerStart: container?.start ?? -1,
                    box:
                        dialect === 'pptx'
                            ? (shape?.placeholder ?? shape?.name ?? null)
                            : frame.style,
                    isTable: tableDepth > 0,
                    isHidden: fallbackDepth > 0,
                });
            }
            continue;
        }
        if (tag.name === 'p:cNvPr' && shapeStack.length > 0) {
            const top = shapeStack[shapeStack.length - 1];
            if (top.name === '') {
                top.name = readAttribute(tag.attributes, 'name') ?? '';
            }
        } else if (tag.name === 'p:ph' && shapeStack.length > 0) {
            shapeStack[shapeStack.length - 1].placeholder =
                readAttribute(tag.attributes, 'type') ?? 'body';
        } else if (tag.name === 'w:pStyle' && paragraphStack.length > 0) {
            paragraphStack[paragraphStack.length - 1].style = readAttribute(
                tag.attributes,
                'w:val',
            );
        }
        if (tag.isSelfClosing) {
            if (tag.name === rule.paragraph) {
                // `<w:p/>`: an empty line
                const container =
                    stack.length > 0 ? stack[stack.length - 1] : null;
                out.push({
                    start: tag.start,
                    end: tag.end,
                    xml: xml.slice(tag.start, tag.end),
                    text: '',
                    containerStart: container?.start ?? -1,
                    box: null,
                    isTable: tableDepth > 0,
                    isHidden: fallbackDepth > 0,
                });
                if (paragraphStack.length > 0) {
                    paragraphStack[paragraphStack.length - 1].nestedCount++;
                }
            }
            continue;
        }
        stack.push({ name: tag.name, start: tag.start });
        if (tag.name === 'mc:Fallback') {
            fallbackDepth++;
        } else if (tag.name === 'w:tc' || tag.name === 'a:tc') {
            tableDepth++;
        } else if (SHAPE_NAME_SET.has(tag.name)) {
            shapeStack.push({ name: '', placeholder: null });
        } else if (tag.name === rule.paragraph) {
            paragraphStack.push({
                start: tag.start,
                stackIndex: stack.length - 1,
                nestedCount: 0,
                style: null,
            });
        }
    }
    return out;
}

// --- the elements of ONE paragraph ---------------------------------------

export type ElementType = {
    name: string;
    start: number;
    end: number;
    openEnd: number;
    // where the closing tag starts; `end` for one that closes itself
    closeStart: number;
};

/** The elements right inside `[from, to)` of `xml`, each whole. */
export function listChildElements(xml: string, from: number, to: number) {
    const out: ElementType[] = [];
    let depth = 0;
    let open: TagType | null = null;
    for (const tag of scanTags(xml, from, to)) {
        if (tag.isSelfClosing) {
            if (depth === 0) {
                out.push({
                    name: tag.name,
                    start: tag.start,
                    end: tag.end,
                    openEnd: tag.end,
                    closeStart: tag.end,
                });
            }
            continue;
        }
        if (!tag.isClose) {
            if (depth === 0) {
                open = tag;
            }
            depth++;
            continue;
        }
        depth--;
        if (depth === 0 && open !== null) {
            out.push({
                name: open.name,
                start: open.start,
                end: tag.end,
                openEnd: open.end,
                closeStart: tag.start,
            });
            open = null;
        }
        if (depth < 0) {
            break;
        }
    }
    return out;
}

/** The paragraph's own open tag end and close tag start. */
export function readParagraphFrame(xml: string) {
    const first = scanTags(xml).next().value as TagType | undefined;
    if (first === undefined) {
        return null;
    }
    if (first.isSelfClosing) {
        return {
            openTag: `<${first.name}${first.attributes}>`,
            closeTag: `</${first.name}>`,
            innerStart: first.end,
            innerEnd: first.end,
            isSelfClosing: true,
        };
    }
    const closeTag = `</${first.name}>`;
    const closeStart = xml.lastIndexOf(closeTag);
    if (closeStart < first.end) {
        return null;
    }
    return {
        openTag: xml.slice(first.start, first.end),
        closeTag,
        innerStart: first.end,
        innerEnd: closeStart,
        isSelfClosing: false,
    };
}

function findChild(xml: string, element: ElementType, name: string) {
    return (
        listChildElements(xml, element.openEnd, element.closeStart).find(
            (child) => {
                return child.name === name;
            },
        ) ?? null
    );
}

function genRunsXml(
    text: string,
    dialect: OfficeDialectType,
    runProps: string,
) {
    const lines = text.split('\n');
    if (dialect === 'pptx') {
        const breakXml =
            runProps === '' ? '<a:br/>' : `<a:br>${runProps}</a:br>`;
        return lines
            .map((line) => {
                return `<a:r>${runProps}<a:t>${escapeXmlText(line)}</a:t></a:r>`;
            })
            .join(breakXml);
    }
    const inner = lines
        .map((line) => {
            return line
                .split('\t')
                .map((part) => {
                    return part === ''
                        ? ''
                        : `<w:t xml:space="preserve">${escapeXmlText(part)}</w:t>`;
                })
                .join('<w:tab/>');
        })
        .join('<w:br/>');
    return `<w:r>${runProps}${inner === '' ? '<w:t></w:t>' : inner}</w:r>`;
}

// What a COPY of a line must not carry twice: an id Word keys a paragraph
// by, a bookmark, a comment's anchor, a note's reference.
function stripCloneOnlyParts(xml: string) {
    return xml
        .replace(/\s(?:w14:paraId|w14:textId)="[^"]*"/g, '')
        .replace(
            /<(?:w:bookmarkStart|w:bookmarkEnd|w:commentRangeStart|w:commentRangeEnd|w:proofErr)\b[^>]*\/>/g,
            '',
        );
}

/**
 * A line written again with new words: its paragraph properties kept, the
 * first run's look given to the words, and every element that is not words
 * left where it was. `isCopy` makes a NEW line from this one.
 */
export function rebuildParagraph(
    paragraphXml: string,
    newText: string,
    dialect: OfficeDialectType,
    isCopy = false,
) {
    const rule = DIALECT_MAP[dialect];
    const source = isCopy ? stripCloneOnlyParts(paragraphXml) : paragraphXml;
    const frame = readParagraphFrame(source);
    if (frame === null) {
        return null;
    }
    const children = listChildElements(
        source,
        frame.innerStart,
        frame.innerEnd,
    );
    const removed: { start: number; end: number; replacement: string }[] = [];
    let runProps: string | null = null;
    let insertAt: number | null = null;
    const takeRunProps = (run: ElementType) => {
        if (runProps !== null) {
            return;
        }
        const props = findChild(
            source,
            run,
            dialect === 'pptx' ? 'a:rPr' : 'w:rPr',
        );
        if (props !== null) {
            runProps = source.slice(props.start, props.end);
        }
    };
    const visit = (element: ElementType, topLevel: ElementType) => {
        if (dialect === 'pptx') {
            if (
                element.name === 'a:r' ||
                element.name === 'a:fld' ||
                element.name === 'a:br'
            ) {
                if (element.name !== 'a:br') {
                    takeRunProps(element);
                }
                removed.push({
                    start: element.start,
                    end: element.end,
                    replacement: '',
                });
                insertAt ??= topLevel.start;
            }
            return;
        }
        if (element.name === rule.run) {
            const runXml = source.slice(element.start, element.end);
            const hasWords = /<w:(?:t|br|cr|tab)[\s/>]/.test(runXml);
            if (!hasWords) {
                return;
            }
            takeRunProps(element);
            insertAt ??= topLevel.start;
            if (DOCX_KEEPER_PATTERN.test(runXml)) {
                // its words out, the run kept
                const kept = runXml.replace(
                    /<w:t\b[^>]*\/>|<w:t\b[^>]*>[\s\S]*?<\/w:t>|<w:(?:br|cr|tab)\b[^>]*\/>/g,
                    '',
                );
                removed.push({
                    start: element.start,
                    end: element.end,
                    replacement: kept,
                });
                return;
            }
            removed.push({
                start: element.start,
                end: element.end,
                replacement: '',
            });
            return;
        }
        if (element.name === rule.props || element.closeStart === element.end) {
            return;
        }
        // a link, a tracked insertion, a content control: the runs inside
        for (const child of listChildElements(
            source,
            element.openEnd,
            element.closeStart,
        )) {
            visit(child, topLevel);
        }
    };
    for (const child of children) {
        visit(child, child);
    }
    if (runProps === null) {
        // the paragraph's own look for words it has none of yet
        if (dialect === 'pptx') {
            const endProps = children.find((child) => {
                return child.name === 'a:endParaRPr';
            });
            if (endProps !== undefined) {
                runProps = source
                    .slice(endProps.start, endProps.end)
                    .replace(/^<a:endParaRPr/, '<a:rPr')
                    .replace(/<\/a:endParaRPr>$/, '</a:rPr>');
            }
        } else {
            const props = children.find((child) => {
                return child.name === 'w:pPr';
            });
            const markProps =
                props === undefined ? null : findChild(source, props, 'w:rPr');
            if (markProps !== null) {
                runProps = source.slice(markProps.start, markProps.end);
            }
        }
    }
    const runsXml = genRunsXml(toWrittenText(newText), dialect, runProps ?? '');
    if (isCopy) {
        // a new line: the paragraph's own properties and the words, and no
        // picture, field, link, comment or page settings of the line copied
        const toKept = (name: string) => {
            const child = children.find((one) => {
                return one.name === name;
            });
            return child === undefined
                ? ''
                : source
                      .slice(child.start, child.end)
                      .replace(
                          /<w:sectPr\b[\s\S]*?<\/w:sectPr>|<w:sectPr\b[^>]*\/>|<w:pPrChange\b[\s\S]*?<\/w:pPrChange>/g,
                          '',
                      );
        };
        return (
            frame.openTag +
            toKept(rule.props) +
            runsXml +
            (dialect === 'pptx' ? toKept('a:endParaRPr') : '') +
            frame.closeTag
        );
    }
    if (insertAt === null) {
        const endProps =
            dialect === 'pptx'
                ? children.find((child) => {
                      return child.name === 'a:endParaRPr';
                  })
                : undefined;
        insertAt = endProps?.start ?? frame.innerEnd;
    }
    if (frame.isSelfClosing) {
        return `${frame.openTag}${runsXml}${frame.closeTag}`;
    }
    let out = '';
    let cursor = 0;
    const edits = [
        ...removed,
        { start: insertAt, end: insertAt, replacement: runsXml },
    ].sort((a, b) => {
        // the insert goes BEFORE a removal starting at the same place
        return a.start - b.start || a.end - b.end;
    });
    for (const edit of edits) {
        out += source.slice(cursor, edit.start) + edit.replacement;
        cursor = edit.end;
    }
    return out + source.slice(cursor);
}

/**
 * `[start, end)` of a line's words written as `newText`, in the text nodes
 * it covers and no others. Rebuilt whole only when a break or a tab is
 * written or crossed. Null when the paragraph cannot be read.
 */
export function replaceParagraphRange(
    paragraphXml: string,
    start: number,
    end: number,
    newText: string,
    dialect: OfficeDialectType,
) {
    const rule = DIALECT_MAP[dialect];
    const segments = readSegments(paragraphXml, rule);
    if (segments === null) {
        return null;
    }
    const text = toSegmentsText(segments);
    const safeText = toWrittenText(newText);
    const whole = text.slice(0, start) + safeText + text.slice(end);
    let offset = 0;
    const placed = segments.map((segment) => {
        const at = offset;
        offset += segment.text.length;
        return { segment, from: at, to: offset };
    });
    const textPlaced = placed.filter((one) => {
        return one.segment.kind === 'text';
    });
    const crossesBreak = placed.some((one) => {
        return one.segment.kind === 'break' && one.from < end && one.to > start;
    });
    if (/[\n\t]/.test(safeText) || crossesBreak || textPlaced.length === 0) {
        return rebuildParagraph(paragraphXml, whole, dialect);
    }
    // the node the new words go into: the one holding `start`, or for a
    // pure insertion the one it follows (it takes that run's look)
    const anchor =
        (start < end
            ? textPlaced.find((one) => {
                  return one.from <= start && start < one.to;
              })
            : undefined) ??
        textPlaced.find((one) => {
            return one.from < start && start <= one.to;
        }) ??
        textPlaced.find((one) => {
            return one.from >= start;
        }) ??
        textPlaced[textPlaced.length - 1];
    const newTextMap = new Map<SegmentType, string>();
    for (const one of textPlaced) {
        const overlapStart = Math.max(start, one.from);
        const overlapEnd = Math.min(end, one.to);
        let nodeText = one.segment.text;
        if (overlapStart < overlapEnd) {
            nodeText =
                nodeText.slice(0, overlapStart - one.from) +
                nodeText.slice(overlapEnd - one.from);
        }
        if (one === anchor) {
            const at = Math.min(Math.max(start - one.from, 0), nodeText.length);
            nodeText = nodeText.slice(0, at) + safeText + nodeText.slice(at);
        }
        if (nodeText !== one.segment.text) {
            newTextMap.set(one.segment, nodeText);
        }
    }
    let out = paragraphXml;
    for (const one of [...textPlaced].reverse()) {
        const nodeText = newTextMap.get(one.segment);
        if (nodeText === undefined || one.segment.kind !== 'text') {
            continue;
        }
        let open = one.segment.open;
        if (
            dialect === 'docx' &&
            /^\s|\s$/.test(nodeText) &&
            !/xml:space=/.test(open)
        ) {
            open = open.replace(/^<w:t\b/, '<w:t xml:space="preserve"');
        }
        out =
            out.slice(0, one.segment.start) +
            open +
            escapeXmlText(nodeText) +
            one.segment.close +
            out.slice(one.segment.end);
    }
    return out;
}

/** A line's words as `newText`, touching only the part that differs. */
export function setParagraphText(
    paragraphXml: string,
    newText: string,
    dialect: OfficeDialectType,
) {
    const segments = readSegments(paragraphXml, DIALECT_MAP[dialect]);
    if (segments === null) {
        return null;
    }
    const oldText = toSegmentsText(segments);
    const safeText = toWrittenText(newText);
    if (oldText === safeText) {
        return paragraphXml;
    }
    let prefix = 0;
    while (
        prefix < oldText.length &&
        prefix < safeText.length &&
        oldText[prefix] === safeText[prefix]
    ) {
        prefix++;
    }
    let suffix = 0;
    while (
        suffix < oldText.length - prefix &&
        suffix < safeText.length - prefix &&
        oldText[oldText.length - 1 - suffix] ===
            safeText[safeText.length - 1 - suffix]
    ) {
        suffix++;
    }
    return replaceParagraphRange(
        paragraphXml,
        prefix,
        oldText.length - suffix,
        safeText.slice(prefix, safeText.length - suffix),
        dialect,
    );
}

/** Every place `from` is in a line, written as `to`; and how many. */
export function replaceInParagraph(
    paragraphXml: string,
    from: string,
    to: string,
    dialect: OfficeDialectType,
) {
    const segments = readSegments(paragraphXml, DIALECT_MAP[dialect]);
    if (segments === null || from === '') {
        return { xml: paragraphXml, count: 0 };
    }
    const text = toSegmentsText(segments);
    const places: number[] = [];
    let at = text.indexOf(from);
    while (at >= 0) {
        places.push(at);
        at = text.indexOf(from, at + from.length);
    }
    let xml: string | null = paragraphXml;
    // from the last, so the earlier places keep their offsets
    for (const place of places.reverse()) {
        xml = replaceParagraphRange(
            xml,
            place,
            place + from.length,
            to,
            dialect,
        );
        if (xml === null) {
            return { xml: paragraphXml, count: 0 };
        }
    }
    return { xml, count: places.length };
}

/** A line's words, as `listOfficeParagraphs` reads them. */
export function readParagraphText(
    paragraphXml: string,
    dialect: OfficeDialectType,
) {
    const segments = readSegments(paragraphXml, DIALECT_MAP[dialect]);
    return segments === null ? null : toSegmentsText(segments);
}
