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
    // Electron 40.x.x crashes when the native DOMParser parses very large XML
    // text (e.g. a full bible with tens of thousands of verses). Use a
    // lightweight custom parser that builds a minimal DOM-like tree without
    // relying on the native DOMParser.
    parseFromString(
        xmlText: string,
        _contentType?: DOMParserSupportedType,
    ): Document {
        return parseXMLText(xmlText) as unknown as Document;
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

const XML_NODE_TYPE = {
    ELEMENT: 1,
    TEXT: 3,
    CDATA_SECTION: 4,
    DOCUMENT: 9,
} as const;

type AppXMLAttribute = {
    name: string;
    value: string;
    nodeValue: string;
};

class AppXMLNode {
    nodeType: number;
    nodeValue: string | null;
    parentNode: AppXMLNode | null = null;
    childNodes: AppXMLNode[] = [];

    constructor(nodeType: number, nodeValue: string | null = null) {
        this.nodeType = nodeType;
        this.nodeValue = nodeValue;
    }

    appendChild<T extends AppXMLNode>(childNode: T): T {
        childNode.parentNode = this;
        this.childNodes.push(childNode);
        return childNode;
    }

    getElementsByTagName(tagName: string): AppXMLElement[] {
        const result: AppXMLElement[] = [];
        collectElementsByTagName(this, tagName, result);
        return result;
    }

    get textContent(): string {
        if (
            this.nodeType === XML_NODE_TYPE.TEXT ||
            this.nodeType === XML_NODE_TYPE.CDATA_SECTION
        ) {
            return this.nodeValue ?? '';
        }
        let textContent = '';
        for (const childNode of this.childNodes) {
            textContent += childNode.textContent;
        }
        return textContent;
    }

    set textContent(value: string) {
        this.childNodes = [];
        if (value !== '') {
            this.appendChild(new AppXMLNode(XML_NODE_TYPE.TEXT, value));
        }
    }
}

function collectElementsByTagName(
    node: AppXMLNode,
    tagName: string,
    result: AppXMLElement[],
) {
    for (const childNode of node.childNodes) {
        if (childNode.nodeType !== XML_NODE_TYPE.ELEMENT) {
            continue;
        }
        const childElement = childNode as AppXMLElement;
        if (tagName === '*' || childElement.tagName === tagName) {
            result.push(childElement);
        }
        collectElementsByTagName(childElement, tagName, result);
    }
}

class AppXMLElement extends AppXMLNode {
    tagName: string;
    attributes: AppXMLAttribute[] = [];
    private readonly attributeMap = new Map<string, AppXMLAttribute>();

    constructor(tagName: string) {
        super(XML_NODE_TYPE.ELEMENT);
        this.tagName = tagName;
    }

    getAttribute(name: string): string | null {
        const attribute = this.attributeMap.get(name);
        return attribute === undefined ? null : attribute.value;
    }

    setAttribute(name: string, value: string): void {
        const existingAttribute = this.attributeMap.get(name);
        if (existingAttribute !== undefined) {
            existingAttribute.value = value;
            existingAttribute.nodeValue = value;
            return;
        }
        const attribute: AppXMLAttribute = { name, value, nodeValue: value };
        this.attributeMap.set(name, attribute);
        this.attributes.push(attribute);
    }
}

class AppXMLDocument extends AppXMLNode {
    constructor() {
        super(XML_NODE_TYPE.DOCUMENT);
    }

    get documentElement(): AppXMLElement | null {
        for (const childNode of this.childNodes) {
            if (childNode.nodeType === XML_NODE_TYPE.ELEMENT) {
                return childNode as AppXMLElement;
            }
        }
        return null;
    }

    createElement(tagName: string): AppXMLElement {
        return new AppXMLElement(tagName);
    }

    createCDATASection(data: string): AppXMLNode {
        return new AppXMLNode(XML_NODE_TYPE.CDATA_SECTION, data);
    }
}

function decodeNumericXMLEntity(match: string, entityBody: string) {
    const codePoint =
        entityBody[1] === 'x'
            ? Number.parseInt(entityBody.slice(2), 16)
            : Number.parseInt(entityBody.slice(1), 10);
    if (Number.isNaN(codePoint)) {
        return match;
    }
    try {
        return String.fromCodePoint(codePoint);
    } catch {
        return match;
    }
}

const NAMED_XML_ENTITIES: { [name: string]: string } = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    quot: '"',
};

function decodeXMLEntities(text: string): string {
    if (!text.includes('&')) {
        return text;
    }
    return text.replace(
        /&(#x[\da-fA-F]+|#\d+|[a-zA-Z][a-zA-Z\d]*);/g,
        (match, entityBody: string) => {
            if (entityBody.startsWith('#')) {
                return decodeNumericXMLEntity(match, entityBody);
            }
            return NAMED_XML_ENTITIES[entityBody] ?? match;
        },
    );
}

function appendXMLTextNode(parentNode: AppXMLNode, rawText: string) {
    if (rawText === '') {
        return;
    }
    // native DOMParser does not expose text outside the root element (such as
    // prolog/epilog whitespace) as document child nodes
    if (parentNode.nodeType === XML_NODE_TYPE.DOCUMENT) {
        return;
    }
    parentNode.appendChild(
        new AppXMLNode(XML_NODE_TYPE.TEXT, decodeXMLEntities(rawText)),
    );
}

function findMatchingOpenTagIndex(
    openElementStack: AppXMLElement[],
    tagName: string,
) {
    for (let index = openElementStack.length - 1; index >= 0; index--) {
        if (openElementStack[index].tagName === tagName) {
            return index;
        }
    }
    return -1;
}

function skipXMLWhitespace(xmlText: string, index: number, endIndex: number) {
    while (index < endIndex && isXMLWhitespace(xmlText[index])) {
        index++;
    }
    return index;
}

function readXMLAttributeName(
    xmlText: string,
    index: number,
    endIndex: number,
) {
    const nameStartIndex = index;
    while (index < endIndex && !isXMLNameEnd(xmlText[index])) {
        index++;
    }
    return { name: xmlText.slice(nameStartIndex, index), nextIndex: index };
}

function readXMLAttributeValue(
    xmlText: string,
    index: number,
    endIndex: number,
) {
    const quote = xmlText[index];
    if (quote === '"' || quote === "'") {
        const valueStartIndex = index + 1;
        let valueEndIndex = valueStartIndex;
        while (valueEndIndex < endIndex && xmlText[valueEndIndex] !== quote) {
            valueEndIndex++;
        }
        return {
            value: xmlText.slice(valueStartIndex, valueEndIndex),
            nextIndex: valueEndIndex + 1,
        };
    }
    let valueEndIndex = index;
    while (
        valueEndIndex < endIndex &&
        !isXMLWhitespace(xmlText[valueEndIndex]) &&
        xmlText[valueEndIndex] !== '/'
    ) {
        valueEndIndex++;
    }
    return {
        value: xmlText.slice(index, valueEndIndex),
        nextIndex: valueEndIndex,
    };
}

function parseXMLAttributes(
    xmlText: string,
    tag: XMLTagInfo,
    element: AppXMLElement,
) {
    let index = tag.nameEndIndex;
    const endIndex = tag.endIndex;
    while (index < endIndex) {
        index = skipXMLWhitespace(xmlText, index, endIndex);
        if (index >= endIndex || xmlText[index] === '/') {
            index++;
            continue;
        }
        const { name, nextIndex } = readXMLAttributeName(
            xmlText,
            index,
            endIndex,
        );
        index = skipXMLWhitespace(xmlText, nextIndex, endIndex);
        if (xmlText[index] !== '=') {
            if (name) {
                element.setAttribute(name, '');
            }
            continue;
        }
        index = skipXMLWhitespace(xmlText, index + 1, endIndex);
        const valueResult = readXMLAttributeValue(xmlText, index, endIndex);
        index = valueResult.nextIndex;
        if (name) {
            element.setAttribute(name, decodeXMLEntities(valueResult.value));
        }
    }
}

function appendXMLCDATA(
    parentNode: AppXMLNode,
    xmlText: string,
    tagStartIndex: number,
    tag: XMLTagInfo,
) {
    if (!xmlText.startsWith('<![CDATA[', tagStartIndex)) {
        return;
    }
    const contentStartIndex = tagStartIndex + '<![CDATA['.length;
    // a terminated CDATA section ends with "]]>"; an unterminated one runs to
    // the end of the input, so keep all remaining content in that case
    const hasTerminator = xmlText.startsWith(']]>', tag.endIndex - 2);
    const contentEndIndex = hasTerminator ? tag.endIndex - 2 : tag.endIndex + 1;
    const data = xmlText.slice(contentStartIndex, contentEndIndex);
    parentNode.appendChild(new AppXMLNode(XML_NODE_TYPE.CDATA_SECTION, data));
}

function appendXMLElement(
    parentNode: AppXMLNode,
    openElementStack: AppXMLElement[],
    xmlText: string,
    tag: XMLTagInfo,
): AppXMLNode {
    const element = new AppXMLElement(tag.name);
    parseXMLAttributes(xmlText, tag, element);
    parentNode.appendChild(element);
    if (tag.isSelfClosing) {
        return parentNode;
    }
    openElementStack.push(element);
    return element;
}

function parseXMLText(xmlText: string): AppXMLDocument {
    const xmlDocument = new AppXMLDocument();
    const openElementStack: AppXMLElement[] = [];
    let parentNode: AppXMLNode = xmlDocument;
    let index = 0;
    const length = xmlText.length;
    while (index < length) {
        const tagStartIndex = xmlText.indexOf('<', index);
        if (tagStartIndex === -1) {
            appendXMLTextNode(parentNode, xmlText.slice(index));
            break;
        }
        if (tagStartIndex > index) {
            appendXMLTextNode(parentNode, xmlText.slice(index, tagStartIndex));
        }
        const tag = readXMLTag(xmlText, tagStartIndex);
        if (tag === null) {
            appendXMLTextNode(parentNode, xmlText.slice(tagStartIndex));
            break;
        }
        // only CDATA sections carry content; comments, processing instructions
        // and doctypes are ignored
        if (tag.isSpecial) {
            appendXMLCDATA(parentNode, xmlText, tagStartIndex, tag);
        } else if (tag.isClosing) {
            const matchingIndex = findMatchingOpenTagIndex(
                openElementStack,
                tag.name,
            );
            if (matchingIndex !== -1) {
                openElementStack.length = matchingIndex;
            }
            parentNode = openElementStack.at(-1) ?? xmlDocument;
        } else {
            parentNode = appendXMLElement(
                parentNode,
                openElementStack,
                xmlText,
                tag,
            );
        }
        index = tag.endIndex + 1;
    }
    return xmlDocument;
}
