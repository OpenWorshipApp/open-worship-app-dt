export type OptimizeXMLTextOptions = {
    childTags?: string[];
    emptyChildTagContents?: boolean;
    keys?: string[] | 'all';
};

type XMLTagInfo = {
    endIndex: number;
    isClosing: boolean;
    isSelfClosing: boolean;
    isSpecial: boolean;
    name: string;
    nameEndIndex: number;
    startIndex: number;
};

class AppXMLParser {
    domParser: DOMParser;
    constructor() {
        this.domParser = new DOMParser();
    }

    parseFromString(xmlText: string, contentType: DOMParserSupportedType) {
        // FIXME: from electron 40.x.x parsed Dom cause app crashes
        // TODO: figure out difference approach to parse XML to Json
        const doc = this.domParser.parseFromString(xmlText, contentType);
        return doc;
    }
}

class AppXMLSerializer {
    serializeToString(node: Node) {
        const doxText = serializeXMLNode(node);
        return `<?xml version="1.0" encoding="UTF-8"?>${doxText}`;
    }
}

export const appXMLParser = new AppXMLParser();
export const appXMLSerializer = new AppXMLSerializer();

function escapeXMLText(value: string) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;');
}

function escapeXMLAttribute(value: string) {
    return escapeXMLText(value).replaceAll('"', '&quot;');
}

function serializeXMLNodeList(nodes: NodeListOf<ChildNode>) {
    return Array.from(nodes, (childNode) => serializeXMLNode(childNode)).join(
        '',
    );
}

function serializeXMLElement(element: Element) {
    const attributes = Array.from(element.attributes, (attribute) => {
        return ` ${attribute.name}="${escapeXMLAttribute(attribute.value)}"`;
    }).join('');
    if (element.childNodes.length === 0) {
        return `<${element.tagName}${attributes}/>`;
    }
    return `<${element.tagName}${attributes}>${serializeXMLNodeList(element.childNodes)}</${element.tagName}>`;
}

function serializeXMLDoctype(documentType: DocumentType) {
    if (documentType.publicId) {
        return `<!DOCTYPE ${documentType.name} PUBLIC "${documentType.publicId}" "${documentType.systemId}">`;
    }
    if (documentType.systemId) {
        return `<!DOCTYPE ${documentType.name} SYSTEM "${documentType.systemId}">`;
    }
    return `<!DOCTYPE ${documentType.name}>`;
}

function serializeXMLProcessingInstruction(
    processingInstruction: ProcessingInstruction,
) {
    const data = processingInstruction.data
        ? ` ${processingInstruction.data}`
        : '';
    return `<?${processingInstruction.target}${data}?>`;
}

function serializeXMLNode(node: Node): string {
    switch (node.nodeType) {
        case Node.ATTRIBUTE_NODE:
            return escapeXMLAttribute(node.nodeValue ?? '');
        case Node.CDATA_SECTION_NODE:
            return `<![CDATA[${node.nodeValue ?? ''}]]>`;
        case Node.COMMENT_NODE:
            return `<!--${node.nodeValue ?? ''}-->`;
        case Node.DOCUMENT_FRAGMENT_NODE:
        case Node.DOCUMENT_NODE:
            return serializeXMLNodeList(node.childNodes);
        case Node.DOCUMENT_TYPE_NODE:
            return serializeXMLDoctype(node as DocumentType);
        case Node.ELEMENT_NODE:
            return serializeXMLElement(node as Element);
        case Node.PROCESSING_INSTRUCTION_NODE:
            return serializeXMLProcessingInstruction(
                node as ProcessingInstruction,
            );
        case Node.TEXT_NODE:
            return escapeXMLText(node.nodeValue ?? '');
        default:
            return '';
    }
}

function isXMLWhitespace(value: string | undefined) {
    return value !== undefined && /\s/.test(value);
}

function isXMLNameEnd(value: string | undefined) {
    return (
        value === undefined ||
        isXMLWhitespace(value) ||
        value === '/' ||
        value === '>' ||
        value === '='
    );
}

function findTagEndIndex(xmlText: string, startIndex: number) {
    let quote: string | null = null;
    for (let index = startIndex + 1; index < xmlText.length; index++) {
        const char = xmlText[index];
        if (quote !== null) {
            if (char === quote) {
                quote = null;
            }
            continue;
        }
        if (char === '"' || char === "'") {
            quote = char;
            continue;
        }
        if (char === '>') {
            return index;
        }
    }
    return -1;
}

function toSpecialXMLTag(
    xmlText: string,
    startIndex: number,
    endText: string,
): XMLTagInfo {
    const foundEndIndex = xmlText.indexOf(endText, startIndex + endText.length);
    const endIndex =
        foundEndIndex === -1
            ? xmlText.length - 1
            : foundEndIndex + endText.length - 1;
    return {
        endIndex,
        isClosing: false,
        isSelfClosing: true,
        isSpecial: true,
        name: '',
        nameEndIndex: startIndex,
        startIndex,
    };
}

function readXMLTag(xmlText: string, startIndex: number): XMLTagInfo | null {
    if (xmlText[startIndex] !== '<') {
        return null;
    }
    if (xmlText.startsWith('<!--', startIndex)) {
        return toSpecialXMLTag(xmlText, startIndex, '-->');
    }
    if (xmlText.startsWith('<![CDATA[', startIndex)) {
        return toSpecialXMLTag(xmlText, startIndex, ']]>');
    }
    const endIndex = findTagEndIndex(xmlText, startIndex);
    if (endIndex === -1) {
        return null;
    }
    if (xmlText[startIndex + 1] === '?' || xmlText[startIndex + 1] === '!') {
        return {
            endIndex,
            isClosing: false,
            isSelfClosing: true,
            isSpecial: true,
            name: '',
            nameEndIndex: startIndex,
            startIndex,
        };
    }
    const isClosing = xmlText[startIndex + 1] === '/';
    let nameStartIndex = startIndex + (isClosing ? 2 : 1);
    while (isXMLWhitespace(xmlText[nameStartIndex])) {
        nameStartIndex++;
    }
    let nameEndIndex = nameStartIndex;
    while (!isXMLNameEnd(xmlText[nameEndIndex])) {
        nameEndIndex++;
    }
    const name = xmlText.slice(nameStartIndex, nameEndIndex);
    if (!name) {
        return null;
    }
    let lastContentIndex = endIndex - 1;
    while (isXMLWhitespace(xmlText[lastContentIndex])) {
        lastContentIndex--;
    }
    return {
        endIndex,
        isClosing,
        isSelfClosing: !isClosing && xmlText[lastContentIndex] === '/',
        isSpecial: false,
        name,
        nameEndIndex,
        startIndex,
    };
}

function getNextMatchingElementDepth(
    tag: XMLTagInfo,
    tagName: string,
    depth: number,
) {
    if (tag.isSpecial || tag.name !== tagName) {
        return depth;
    }
    if (tag.isClosing) {
        return depth - 1;
    }
    if (tag.isSelfClosing) {
        return depth;
    }
    return depth + 1;
}

function findElementEndIndex(xmlText: string, openTag: XMLTagInfo) {
    if (openTag.isSelfClosing) {
        return openTag.endIndex + 1;
    }
    let depth = 1;
    let index = openTag.endIndex + 1;
    while (index < xmlText.length) {
        const tagStartIndex = xmlText.indexOf('<', index);
        if (tagStartIndex === -1) {
            return xmlText.length;
        }
        const tag = readXMLTag(xmlText, tagStartIndex);
        if (tag === null) {
            return xmlText.length;
        }
        depth = getNextMatchingElementDepth(tag, openTag.name, depth);
        if (depth === 0) {
            return tag.endIndex + 1;
        }
        index = tag.endIndex + 1;
    }
    return xmlText.length;
}

function toEmptyElementText(xmlText: string, openTag: XMLTagInfo) {
    const openingText = xmlText.slice(openTag.startIndex, openTag.endIndex + 1);
    if (openTag.isSelfClosing) {
        return openingText;
    }
    return `${openingText}</${openTag.name}>`;
}

function removeFirstLevelElementContents(xmlText: string) {
    let depth = 0;
    let copyIndex = 0;
    let index = 0;
    let newXMLText = '';
    while (index < xmlText.length) {
        const tagStartIndex = xmlText.indexOf('<', index);
        if (tagStartIndex === -1) {
            break;
        }
        const tag = readXMLTag(xmlText, tagStartIndex);
        if (tag === null) {
            break;
        }
        if (tag.isSpecial) {
            index = tag.endIndex + 1;
            continue;
        }
        if (tag.isClosing) {
            depth = Math.max(0, depth - 1);
            index = tag.endIndex + 1;
            continue;
        }
        if (depth === 0) {
            const elementEndIndex = findElementEndIndex(xmlText, tag);
            newXMLText += xmlText.slice(copyIndex, tagStartIndex);
            newXMLText += toEmptyElementText(xmlText, tag);
            copyIndex = elementEndIndex;
            index = elementEndIndex;
            continue;
        }
        if (!tag.isSelfClosing) {
            depth++;
        }
        index = tag.endIndex + 1;
    }
    newXMLText += xmlText.slice(copyIndex);
    return newXMLText;
}

function getSecondLevelElementReplacement(
    xmlText: string,
    tag: XMLTagInfo,
    depth: number,
    targetTags: Set<string>,
    emptyTargetTagContents: boolean,
) {
    if (depth !== 1) {
        return null;
    }
    if (!targetTags.has(tag.name)) {
        return {
            endIndex: findElementEndIndex(xmlText, tag),
            text: '',
        };
    }
    if (emptyTargetTagContents && !tag.isSelfClosing) {
        return {
            endIndex: findElementEndIndex(xmlText, tag),
            text: toEmptyElementText(xmlText, tag),
        };
    }
    return null;
}

function removeUnmatchedSecondLevelElements(
    xmlText: string,
    targetTags: Set<string>,
    emptyTargetTagContents: boolean,
) {
    let depth = 0;
    let copyIndex = 0;
    let index = 0;
    let newXMLText = '';
    while (index < xmlText.length) {
        const tagStartIndex = xmlText.indexOf('<', index);
        if (tagStartIndex === -1) {
            break;
        }
        const tag = readXMLTag(xmlText, tagStartIndex);
        if (tag === null) {
            break;
        }
        if (tag.isSpecial) {
            index = tag.endIndex + 1;
            continue;
        }
        if (tag.isClosing) {
            depth = Math.max(0, depth - 1);
            index = tag.endIndex + 1;
            continue;
        }
        const replacement = getSecondLevelElementReplacement(
            xmlText,
            tag,
            depth,
            targetTags,
            emptyTargetTagContents,
        );
        if (replacement !== null) {
            newXMLText += xmlText.slice(copyIndex, tagStartIndex);
            newXMLText += replacement.text;
            copyIndex = replacement.endIndex;
            index = replacement.endIndex;
            continue;
        }
        if (!tag.isSelfClosing) {
            depth++;
        }
        index = tag.endIndex + 1;
    }
    newXMLText += xmlText.slice(copyIndex);
    return newXMLText;
}

export function optimizeXMLText(
    xmlText: string,
    { childTags, emptyChildTagContents, keys }: OptimizeXMLTextOptions,
): string {
    const targetTags = new Set(childTags ?? []);
    const hasTargetKeys = keys === 'all' || (keys?.length ?? 0) > 0;
    if (targetTags.size === 0 && !hasTargetKeys) {
        return xmlText;
    }
    let newXMLText = xmlText;
    // parsing large XML text causes electron crashes
    // if keys are specified then only first level element attributes are needed
    // so remove their content; keys='all' keeps the element with all attributes
    if (hasTargetKeys) {
        newXMLText = removeFirstLevelElementContents(newXMLText);
    }
    // if childTags are specified then check all second level elements and
    // remove the other sibling elements
    if (targetTags.size > 0) {
        newXMLText = removeUnmatchedSecondLevelElements(
            newXMLText,
            targetTags,
            Boolean(emptyChildTagContents),
        );
    }
    return newXMLText;
}
