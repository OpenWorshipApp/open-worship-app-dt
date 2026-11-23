// `owa_inspect`: what the elements a CSS selector names ARE, read and never
// acted on (`AD-40`, 2026-11-19).
//
// The firewall refuses `evaluate_script`, because every renderer here has
// Node. A developer's question a snapshot cannot answer -- a pane's height,
// whether a fold set its class, which component drew a box -- then went to a
// hand-written `Runtime.evaluate` over raw CDP: 10 of 40 sessions by
// 2026-11-19, ~27 calls, three of them stopped by Claude Code's own
// classifier as going around a safety control. This answers those reads
// with no expression of the caller's: the selector is DATA, the page
// expression is fixed, nothing is pressed, and no field's value is read.
// A dependency-free string, as every page expression is (no `import()` of an
// app module: it re-runs that module's top level).

export const INSPECT_LIMIT_DEFAULT = 5;
export const INSPECT_LIMIT_MAX = 20;
export const INSPECT_STYLE_MAX = 12;
// A property name and nothing else: `color`, `max-height`, `--app-gap`.
export const INSPECT_STYLE_PATTERN = /^(--)?[a-zA-Z][a-zA-Z0-9-]{0,63}$/;
// Open shadow roots are searched too -- slide previews draw in one -- but a
// page is never walked for more of them than this.
const SHADOW_ROOT_MAX = 200;
const TEXT_MAX = 200;

/**
 * The page expression. `styles` must already be names that match
 * `INSPECT_STYLE_PATTERN` (the schema holds that); `limit` is clamped here.
 */
export function genInspectExpression(
  selector,
  { styles = [], limit = INSPECT_LIMIT_DEFAULT } = {},
) {
  const styleList = styles.filter((name) => {
    return INSPECT_STYLE_PATTERN.test(name);
  });
  const shown = Math.min(
    Math.max(1, Math.trunc(Number(limit) || INSPECT_LIMIT_DEFAULT)),
    INSPECT_LIMIT_MAX,
  );
  return `(() => {
        const selector = ${JSON.stringify(String(selector))};
        const styleList = ${JSON.stringify(styleList.slice(0, INSPECT_STYLE_MAX))};
        const limit = ${shown};
        const rootList = [document];
        for (let i = 0; i < rootList.length && rootList.length < ${SHADOW_ROOT_MAX}; i++) {
            for (const element of rootList[i].querySelectorAll('*')) {
                if (element.shadowRoot && rootList.length < ${SHADOW_ROOT_MAX}) {
                    rootList.push(element.shadowRoot);
                }
            }
        }
        const found = [];
        try {
            for (const root of rootList) {
                for (const element of root.querySelectorAll(selector)) {
                    found.push([element, root !== document]);
                }
            }
        } catch (_error) {
            return { error: 'That is not a selector this page can read.' };
        }
        const OPTIONS = { checkVisibilityCSS: true, opacityProperty: true };
        const seenOf = (element) => {
            if (typeof element.checkVisibility !== 'function') {
                return undefined;
            }
            if (element.checkVisibility(OPTIONS)) {
                return 'shown';
            }
            return element.checkVisibility() ? 'hidden' : 'gone';
        };
        const cut = (text) => {
            return text.length > ${TEXT_MAX} ? text.slice(0, ${TEXT_MAX}) + '…' : text;
        };
        const ATTRIBUTE_LIST = [
            'id', 'role', 'title', 'aria-label', 'aria-selected',
            'aria-expanded', 'aria-pressed', 'aria-checked', 'disabled',
            'data-widget-name', 'data-react-comp-name', 'data-react-comp-fp',
        ];
        const FIELD_SELECTOR =
            'input, textarea, select, [contenteditable=""], [contenteditable="true"]';
        const matches = found.slice(0, limit).map(([element, isInShadow]) => {
            const rect = element.getBoundingClientRect();
            const out = {
                tag: element.tagName.toLowerCase(),
                visibility: seenOf(element),
                box: {
                    x: Math.round(rect.x),
                    y: Math.round(rect.y),
                    width: Math.round(rect.width),
                    height: Math.round(rect.height),
                },
            };
            const className = (element.getAttribute('class') || '').trim();
            if (className !== '') {
                out.className = cut(className);
            }
            const attributes = {};
            for (const name of ATTRIBUTE_LIST) {
                const value = element.getAttribute(name);
                if (value !== null) {
                    attributes[name] = cut(value);
                }
            }
            if (Object.keys(attributes).length > 0) {
                out.attributes = attributes;
            }
            // A field's words are what somebody typed: never read.
            const isField =
                element.matches(FIELD_SELECTOR) ||
                element.closest('[contenteditable=""], [contenteditable="true"]') !== null;
            if (!isField) {
                const text = String(element.innerText ?? element.textContent ?? '')
                    .replace(/\\s+/g, ' ')
                    .trim();
                if (text !== '') {
                    out.text = cut(text);
                }
            }
            out.childCount = element.childElementCount;
            if (isInShadow) {
                out.isInShadow = true;
            }
            if (styleList.length > 0) {
                const computed = getComputedStyle(element);
                out.styles = {};
                for (const name of styleList) {
                    out.styles[name] = computed.getPropertyValue(name).trim();
                }
            }
            return out;
        });
        return {
            count: found.length,
            matches,
            more: found.length > limit ? found.length - limit : undefined,
        };
    })()`;
}
