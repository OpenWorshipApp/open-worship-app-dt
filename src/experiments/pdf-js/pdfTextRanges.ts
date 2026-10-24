export type PdfTextContentType = {
    items: ({ str: string; hasEOL?: boolean } | { type: string })[];
};

// Extract only the requested page. Reuse content as TextLayer's
// textContentSource rather than asking PDF.js to decode it a second time.
export async function getPdfPageText<T extends PdfTextContentType>(page: {
    getTextContent: () => Promise<T>;
}) {
    const content = await page.getTextContent();
    const text = content.items
        .map((item) =>
            'str' in item ? item.str + (item.hasEOL ? '\n' : ' ') : '',
        )
        .join('');
    return { content, text };
}

export type PdfTextMapType = {
    source: string;
    runs: { element: HTMLElement; text: string; start: number }[];
};
export type PdfTextRangeType = { start: number; end: number; text: string };
export type PdfTextRangeOptionsType = {
    title: string;
    onClick?: (event: MouseEvent, range: PdfTextRangeType) => void;
    onContextMenu?: (event: MouseEvent, range: PdfTextRangeType) => void;
};

const activeRanges = new WeakMap<PdfTextMapType, Set<PdfTextRangeType>>();

// Offsets are UTF-16 [start, end) in map.source, NOT in independently joined
// PDF strings. One logical range can wrap pieces of several PDF.js spans.
export function setPdfTextRange(
    map: PdfTextMapType,
    start: number,
    end: number,
    options: PdfTextRangeOptionsType,
) {
    if (
        !Number.isInteger(start) ||
        !Number.isInteger(end) ||
        start < 0 ||
        end <= start ||
        end > map.source.length ||
        map.source.slice(start, end).includes('\0')
    ) {
        throw new RangeError(
            'Invalid PDF text range or range across distant blocks',
        );
    }
    const ranges = activeRanges.get(map) ?? new Set<PdfTextRangeType>();
    if ([...ranges].some((range) => start < range.end && end > range.start)) {
        throw new RangeError('PDF text ranges must not overlap');
    }
    const range = { start, end, text: map.source.slice(start, end) };
    const elements: HTMLElement[] = [];
    const click = (event: MouseEvent) => options.onClick?.(event, range);
    const contextmenu = (event: MouseEvent) =>
        options.onContextMenu?.(event, range);
    const keydown = (event: KeyboardEvent) => {
        if (options.onClick && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            event.stopPropagation();
            (event.currentTarget as HTMLElement).click();
        }
    };
    for (const run of map.runs) {
        const from = Math.max(0, start - run.start);
        const to = Math.min(run.text.length, end - run.start);
        if (from >= to) continue;
        // Collect nodes before splitting; never use innerHTML for PDF text.
        const walker = document.createTreeWalker(
            run.element,
            NodeFilter.SHOW_TEXT,
        );
        const nodes: { node: Text; offset: number }[] = [];
        let offset = 0;
        while (walker.nextNode()) {
            const node = walker.currentNode as Text;
            nodes.push({ node, offset });
            offset += node.length;
        }
        for (const { node, offset: nodeStart } of nodes) {
            const localFrom = Math.max(0, from - nodeStart);
            const localTo = Math.min(node.length, to - nodeStart);
            if (localFrom >= localTo) continue;
            if (localTo < node.length) node.splitText(localTo);
            const selected = localFrom ? node.splitText(localFrom) : node;
            const element = document.createElement('span');
            element.dataset.pdfTextRange = `${start}:${end}`;
            element.title = options.title;
            if (options.onClick || options.onContextMenu) {
                element.tabIndex = 0;
                element.setAttribute('role', 'button');
                element.setAttribute('aria-label', options.title);
            }
            selected.replaceWith(element);
            element.append(selected);
            if (options.onClick) element.addEventListener('click', click);
            if (options.onContextMenu)
                element.addEventListener('contextmenu', contextmenu);
            element.addEventListener('keydown', keydown);
            elements.push(element);
        }
    }
    if (!elements.length)
        throw new RangeError('Range contains no rendered PDF text');
    ranges.add(range);
    activeRanges.set(map, ranges);
    let disposed = false;
    return {
        ...range,
        elements,
        setTitle(title: string) {
            if (disposed) return;
            elements.forEach((element) => {
                element.title = title;
                if (element.hasAttribute('aria-label'))
                    element.setAttribute('aria-label', title);
            });
        },
        dispose() {
            if (disposed) return;
            disposed = true;
            elements.forEach((element) => {
                element.removeEventListener('click', click);
                element.removeEventListener('contextmenu', contextmenu);
                element.removeEventListener('keydown', keydown);
                const parent = element.parentNode;
                element.replaceWith(...element.childNodes);
                parent?.normalize();
            });
            ranges.delete(range);
        },
    };
}
