/**
 * A Bible passage the app quoted into a study (`toStudyQuoteLines` in
 * `src/helper/agentStudyFileRules.ts`: `> **Exodus 3:1-22** (KJV)`, then a
 * verse a paragraph) folds to its reference line in the window (2026-11-14,
 * the user: _make the top bible part collapsible_, then _has to expand in
 * printing and ms-word export_).
 *
 * A fold is a class the window's sheet reads on SCREEN only, never the
 * `hidden` attribute or a `<details>`:
 *  - paper prints every verse, because the sheet hides them under
 *    `@media screen` alone (`MarkdownPreviewAppComp.scss`);
 *  - the Word document reads the page's nodes, not its styles, and leaves
 *    out a `[hidden]` element and every `<button>`
 *    (`markdownWordHelpers.ts`), so it carries every verse and no toggle;
 *  - a `<summary>` would fold the passage on a press of the reference link
 *    it holds, and go to Word as one bold line.
 *
 * The page is drawn again on every save and every pause in the typing, so
 * which passages are folded is kept by the window (`foldedKeySet`), keyed by
 * the reference line's words and which of that line it is, and put back on
 * each draw.
 */

export const MARKDOWN_PASSAGE_CLASS = 'app-markdown-passage';
export const MARKDOWN_PASSAGE_FOLDED_CLASS = 'app-markdown-passage--folded';
export const MARKDOWN_PASSAGE_TOGGLE_CLASS = 'app-markdown-passage-toggle';
const PASSAGE_KEY_ATTRIBUTE = 'data-passage-fold';

export type PassageFoldLabelsType = {
    collapse: string;
    expand: string;
};

// What follows the bold reference on its line: its Bible's key, `(KJV)`,
// as `QUOTE_HEAD_PATTERN` reads it in the study rules.
const BIBLE_KEY_TEXT_REGEX = /^\s*\([^()\n]{1,40}\)\s*$/;

/**
 * The reference line of a passage in the app's form, or null: the
 * blockquote's first paragraph, a bold reference and its Bible's key and
 * nothing else, with at least one block (a verse) under it.
 */
function findPassageHead(blockquote: Element) {
    const head = blockquote.firstElementChild;
    if (
        head === null ||
        head.tagName !== 'P' ||
        head.nextElementSibling === null ||
        head.childNodes.length !== 2
    ) {
        return null;
    }
    const [referenceNode, keyNode] = head.childNodes;
    if (
        referenceNode.nodeType !== Node.ELEMENT_NODE ||
        (referenceNode as Element).tagName !== 'STRONG' ||
        (referenceNode.textContent ?? '').trim() === '' ||
        keyNode.nodeType !== Node.TEXT_NODE ||
        !BIBLE_KEY_TEXT_REGEX.test(keyNode.nodeValue ?? '')
    ) {
        return null;
    }
    return head;
}

function applyPassageFold(
    passage: Element,
    isFolded: boolean,
    labels: PassageFoldLabelsType,
) {
    passage.classList.toggle(MARKDOWN_PASSAGE_FOLDED_CLASS, isFolded);
    const toggle = passage.querySelector(`.${MARKDOWN_PASSAGE_TOGGLE_CLASS}`);
    if (toggle === null) {
        return;
    }
    const label = isFolded ? labels.expand : labels.collapse;
    toggle.setAttribute('title', label);
    toggle.setAttribute('aria-label', label);
    toggle.setAttribute('aria-expanded', `${!isFolded}`);
    const icon = toggle.firstElementChild;
    if (icon !== null) {
        icon.className = isFolded
            ? 'bi bi-chevron-right'
            : 'bi bi-chevron-down';
    }
}

/**
 * Gives every quoted passage on a freshly drawn page its toggle, folded as
 * the person left it. Returns how many passages it found.
 */
export function addPassageFolds(
    article: HTMLElement,
    foldedKeySet: ReadonlySet<string>,
    labels: PassageFoldLabelsType,
) {
    const document = article.ownerDocument;
    const headCountMap = new Map<string, number>();
    let count = 0;
    for (const blockquote of article.querySelectorAll('blockquote')) {
        const head = findPassageHead(blockquote);
        if (head === null) {
            continue;
        }
        const headText = (head.textContent ?? '').trim();
        const headCount = headCountMap.get(headText) ?? 0;
        headCountMap.set(headText, headCount + 1);
        blockquote.classList.add(MARKDOWN_PASSAGE_CLASS);
        const key = `${headCount}:${headText}`;
        blockquote.setAttribute(PASSAGE_KEY_ATTRIBUTE, key);
        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = MARKDOWN_PASSAGE_TOGGLE_CLASS;
        toggle.append(document.createElement('i'));
        head.prepend(toggle);
        applyPassageFold(blockquote, foldedKeySet.has(key), labels);
        count += 1;
    }
    return count;
}

/** The passage's toggle `target` is on or in, or null. */
export function findPassageToggle(target: Element | null) {
    return target?.closest?.(`.${MARKDOWN_PASSAGE_TOGGLE_CLASS}`) ?? null;
}

/**
 * Folds or unfolds the passage `toggle` belongs to, keeping the choice in
 * `foldedKeySet`. Returns whether it is folded now, or null for a toggle
 * that belongs to no passage.
 */
export function togglePassageFold(
    toggle: Element,
    foldedKeySet: Set<string>,
    labels: PassageFoldLabelsType,
) {
    const passage = toggle.closest(`.${MARKDOWN_PASSAGE_CLASS}`);
    const key = passage?.getAttribute(PASSAGE_KEY_ATTRIBUTE) ?? null;
    if (passage === null || key === null) {
        return null;
    }
    const isFolded = !passage.classList.contains(MARKDOWN_PASSAGE_FOLDED_CLASS);
    if (isFolded) {
        foldedKeySet.add(key);
    } else {
        foldedKeySet.delete(key);
    }
    applyPassageFold(passage, isFolded, labels);
    return isFolded;
}
