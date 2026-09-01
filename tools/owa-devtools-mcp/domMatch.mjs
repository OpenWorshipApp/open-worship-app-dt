// Every way an app-level tool finds a control by the words written on it.
//
// `owa_find_ui`, `owa_click`, `owa_type` and the guide (guide.mjs) all answer
// the same question -- "which element IS 'Bible Lookup'?" -- and used to
// answer it their own way: a bare substring here, a strict word boundary
// there, a selector list that stopped at buttons. A reference box is not a
// button, and "reference box" is not the words on it, so a step pointing at
// one found nothing to ring. This is the one matcher they share: widened to
// every interactive element, tolerant in steps (exact, then word boundary,
// then substring, then every word present in any order), able to WAIT a
// moment for a panel that is still rendering, and able to say which labels
// it DID see when nothing matches -- so the caller retries with words that
// are actually on screen instead of giving up.
//
// Like guide.mjs the runtime is a string evaluated in the page: dependency
// free, never importing an app module (that re-runs `document.onkeydown` and
// kills every shortcut), and touching nothing but what it is asked about.
// The generators below package one call to it as an expression for
// `evaluateInApp`; keep them free of backticks and `${` so they embed clean.

// How many matches `owa_find_ui` answers with -- and, when asked to
// highlight, how many rings are drawn. They are the same number on purpose:
// the user must be able to count what the answer says on their screen.
const MAX_FIND_UI_MATCHES = 20;

export const DOM_MATCH_RUNTIME = `
(() => {
    if (window.__owaDomMatch !== undefined) {
        return window.__owaDomMatch;
    }
    // Everything a volunteer can press or type into. The old list stopped
    // at buttons, links and labelled things, so a step pointing at a
    // reference box or a contenteditable had nothing to find.
    const SELECTOR = [
        'button', 'a', '[role="button"]', 'input', 'textarea', 'select',
        'label', 'summary', '.nav-link', '[contenteditable="true"]',
        '[title]', '[aria-label]', '[placeholder]',
    ].join(', ');
    const collect = () => [...document.querySelectorAll(SELECTOR)];

    const labelOf = (element) => {
        const parts = [
            element.textContent,
            element.getAttribute('title'),
            element.getAttribute('aria-label'),
            element.getAttribute('placeholder'),
        ];
        const tag = element.tagName;
        // A box that already holds text is named by it as much as by any
        // label beside it ("(KJV) John 3:16" IS how the reference box reads).
        if (tag === 'INPUT' || tag === 'TEXTAREA') {
            parts.push(element.value);
        }
        return parts.filter(Boolean).join(' ')
            .replace(/\\s+/g, ' ').trim();
    };

    const checkIsControl = (element) => {
        if (element.isContentEditable === true) {
            return true;
        }
        const tag = element.tagName.toLowerCase();
        return ['button', 'a', 'input', 'textarea', 'select', 'summary']
            .includes(tag) || element.getAttribute('role') === 'button';
    };

    // The most specific match wins, NOT the first one: document order sees a
    // container before the control inside it, and its textContent is the
    // text of everything it wraps -- "KJV" used to resolve to a whole Bible
    // history row instead of the version button beside it.
    const checkIsBetter = (candidate, best) => {
        if (candidate.tier !== best.tier) {
            return candidate.tier < best.tier;
        }
        if (candidate.isControl !== best.isControl) {
            return candidate.isControl;
        }
        return candidate.length < best.length;
    };

    const checkIsWordChar = (character) => {
        return (character >= 'a' && character <= 'z') ||
            (character >= '0' && character <= '9');
    };
    const checkIsWordMatch = (label, needle) => {
        let at = label.indexOf(needle);
        while (at !== -1) {
            const before = at === 0 ? ' ' : label[at - 1];
            const end = at + needle.length;
            const after = end >= label.length ? ' ' : label[end];
            if (!checkIsWordChar(before) && !checkIsWordChar(after)) {
                return true;
            }
            at = label.indexOf(needle, at + 1);
        }
        return false;
    };

    const tokensOf = (text) => {
        return text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    };

    // A box text can be typed into. A button carries a value accessor too,
    // so it is the tag and type that say, not the property.
    const checkIsTextBox = (element) => {
        if (element.isContentEditable === true) {
            return true;
        }
        const tag = element.tagName;
        if (tag === 'TEXTAREA') {
            return true;
        }
        if (tag !== 'INPUT') {
            return false;
        }
        const inputType = (element.getAttribute('type') ?? 'text')
            .toLowerCase();
        return ['text', 'search', 'url', 'tel', 'password', 'email', 'number']
            .includes(inputType);
    };

    // How well a label fits the words asked for: 0 exact, 1 on a word
    // boundary, 2 a plain substring, 3 every word of it present in any
    // order ("Bible Lookup" still lands on a "Lookup Bible" button).
    // -1: no match. The wider the net the tighter the length guard -- a
    // container that merely mentions the words must not be rung instead of
    // the control, because the user (or the demo) will press it.
    const matchTier = (label, needle) => {
        if (label === needle) {
            return 0;
        }
        if (
            label.length <= needle.length * 6 + 30 &&
            checkIsWordMatch(label, needle)
        ) {
            return 1;
        }
        if (label.length <= needle.length * 8 + 60 && label.includes(needle)) {
            return 2;
        }
        const needleTokens = tokensOf(needle);
        if (
            needleTokens.length > 1 &&
            label.length <= needle.length * 8 + 60
        ) {
            const labelTokens = new Set(tokensOf(label));
            if (needleTokens.every((token) => labelTokens.has(token))) {
                return 3;
            }
        }
        return -1;
    };

    // Every candidate the caller offered, in order, until one is on screen.
    // A hidden match is kept only as a fallback: the panel it belongs to may
    // simply be closed, which is a different answer than "not there". With
    // onlyBoxes (typing) a button that merely shares the words is skipped
    // -- "Genesis 1" is a history row to click, never a box to type into.
    const findBest = (needles, { onlyBoxes = false } = {}) => {
        let hiddenFallback = null;
        for (const one of needles) {
            const needle = String(one ?? '').toLowerCase().trim();
            if (needle.length === 0) {
                continue;
            }
            let best = null;
            for (const element of collect()) {
                if (onlyBoxes && !checkIsTextBox(element)) {
                    continue;
                }
                const label = labelOf(element);
                if (label.length === 0) {
                    continue;
                }
                const tier = matchTier(label.toLowerCase(), needle);
                if (tier === -1) {
                    continue;
                }
                const rect = element.getBoundingClientRect();
                if (rect.width === 0 || rect.height === 0) {
                    hiddenFallback = hiddenFallback ?? {
                        element, tier, needle: one,
                    };
                    continue;
                }
                const candidate = {
                    element, tier, needle: one,
                    isControl: checkIsControl(element),
                    length: label.length,
                };
                if (best === null || checkIsBetter(candidate, best)) {
                    best = candidate;
                }
            }
            if (best !== null) {
                return best;
            }
        }
        return hiddenFallback;
    };

    // When nothing matches, the labels that came closest. "reference box"
    // earns the real "Bible Reference" box as a near miss, and the caller
    // retries with the words actually on screen instead of declaring the
    // step impossible.
    const nearMisses = (needles, limit = 5) => {
        const wantedTokens = [
            ...new Set(needles.flatMap((one) => tokensOf(String(one ?? '')))),
        ];
        if (wantedTokens.length === 0) {
            return [];
        }
        const scored = new Map();
        for (const element of collect()) {
            const label = labelOf(element);
            if (label.length === 0 || label.length > 120) {
                continue;
            }
            const rect = element.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) {
                continue;
            }
            const labelTokens = new Set(tokensOf(label));
            const score = wantedTokens.filter((token) => {
                return labelTokens.has(token);
            }).length;
            if (score === 0) {
                continue;
            }
            const key = label.slice(0, 60);
            const current = scored.get(key);
            if (current === undefined || score > current) {
                scored.set(key, score);
            }
        }
        return [...scored.entries()]
            .sort((one, other) => {
                return other[1] - one[1] || one[0].length - other[0].length;
            })
            .slice(0, limit)
            .map(([label]) => label);
    };

    // A step can land before its panel has finished rendering; asking again
    // for a moment turns "nothing on screen" into the control that was about
    // to appear. Polls rather than watching the DOM: cheaper, and a second
    // and a half of patience is all a render ever needs.
    const waitForBest = (needles, timeoutMs = 1500, options = {}) => {
        return new Promise((resolve) => {
            const startedAt = Date.now();
            const poll = () => {
                const found = findBest(needles, options);
                if (found !== null || Date.now() - startedAt >= timeoutMs) {
                    resolve(found === null
                        ? { element: null, nearMisses: nearMisses(needles) }
                        : found);
                    return;
                }
                setTimeout(poll, 150);
            };
            poll();
        });
    };

    const describe = (element) => {
        const rect = element.getBoundingClientRect();
        const owner = element.closest('[data-react-comp-fp]');
        // Said in words, because the person being pointed at the control is
        // looking at a window, not at a coordinate system.
        const vertical = rect.y < innerHeight / 3
            ? 'top'
            : (rect.y > (innerHeight * 2) / 3 ? 'bottom' : 'middle');
        const horizontal = rect.x < innerWidth / 3
            ? 'left'
            : (rect.x > (innerWidth * 2) / 3 ? 'right' : 'center');
        return {
            label: labelOf(element).slice(0, 80),
            where: vertical === 'middle' && horizontal === 'center'
                ? 'in the middle of the window'
                : 'at the ' + vertical + ' ' + horizontal + ' of the window',
            tag: element.tagName.toLowerCase(),
            isVisible: rect.width > 0 && rect.height > 0,
            isEnabled: element.disabled !== true &&
                element.getAttribute('aria-disabled') !== 'true',
            position: {
                x: Math.round(rect.x),
                y: Math.round(rect.y),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
            },
            component: owner === null
                ? null
                : owner.getAttribute('data-react-comp-name'),
            sourceFile: owner === null
                ? null
                : owner.getAttribute('data-react-comp-fp'),
        };
    };

    // Outlining a control is only ever said in answer to "where is it?", so
    // the answer is a thing to press: it beats, which finds the eye on a
    // crowded window in a way a still box does not. The keyframes ride with
    // the marker -- this draws into the app page, which has no rule of ours,
    // and must leave nothing behind when it goes.
    // The keyframes are written ONCE per page, not once per ring: a highlight
    // can point at twenty controls at a time, and twenty identical <style>
    // elements is twenty style recalculations for one rule.
    let beatStyle = null;
    const ensureBeatStyle = () => {
        if (beatStyle !== null && beatStyle.isConnected) {
            return;
        }
        beatStyle = document.createElement('style');
        beatStyle.textContent = '@keyframes owa-find-beat {' +
            '0%,100%{box-shadow:0 0 0 4px rgba(255,59,48,.25)}' +
            '50%{box-shadow:0 0 0 11px rgba(255,59,48,.04)}}' +
            '@media (prefers-reduced-motion:reduce){' +
            '[data-owa-find-marker]{animation:none!important}}';
        document.head.append(beatStyle);
    };

    const flash = (element, durationMs = 4000) => {
        const rect = element.getBoundingClientRect();
        if (rect.width === 0) {
            return;
        }
        ensureBeatStyle();
        const marker = document.createElement('div');
        marker.style.cssText = [
            'position:fixed',
            'left:' + rect.x + 'px',
            'top:' + rect.y + 'px',
            'width:' + rect.width + 'px',
            'height:' + rect.height + 'px',
            'border:3px solid #ff3b30',
            'border-radius:4px',
            'pointer-events:none',
            'z-index:2147483647',
            'animation:owa-find-beat 1.4s ease-in-out infinite',
        ].join(';');
        marker.setAttribute('data-owa-find-marker', '');
        document.body.append(marker);
        setTimeout(() => {
            marker.remove();
        }, durationMs);
    };

    // What is actually on screen, one row per control a volunteer could
    // press. Dedupes on label+position (a label and its button are often the
    // same words twice) and skips anything hidden or wordy enough to be a
    // container.
    const listControls = (filter, limit) => {
        const needle = String(filter ?? '').toLowerCase().trim();
        const seen = new Set();
        const rows = [];
        for (const element of collect()) {
            const rect = element.getBoundingClientRect();
            if (rect.width === 0 || rect.height === 0) {
                continue;
            }
            const label = labelOf(element);
            if (label.length === 0 || label.length > 120) {
                continue;
            }
            if (needle.length > 0 && !label.toLowerCase().includes(needle)) {
                continue;
            }
            const key = label.slice(0, 60) + '|' + Math.round(rect.x) + '|' +
                Math.round(rect.y);
            if (seen.has(key)) {
                continue;
            }
            seen.add(key);
            rows.push(describe(element));
            if (rows.length >= limit) {
                break;
            }
        }
        return rows;
    };

    window.__owaDomMatch = {
        collect, labelOf, matchTier, checkIsControl, checkIsTextBox, findBest,
        waitForBest, nearMisses, describe, flash, listControls,
    };
    return window.__owaDomMatch;
})()`;

/** `listControls`, packaged as an expression for `evaluateInApp`. */
export function genListUiExpression({ filter = '', limit = 100 } = {}) {
    const cappedLimit = Math.min(Math.max(Math.trunc(limit) || 100, 1), 200);
    return `(() => {
        const dm = ${DOM_MATCH_RUNTIME};
        const controls = dm.listControls(
            ${JSON.stringify(String(filter))}, ${cappedLimit},
        );
        return { count: controls.length, controls };
    })()`;
}

/**
 * Click the control a label names, waiting a moment for it to render. On a
 * miss the expression answers with the closest labels it did see, so the
 * caller retries with real words instead of a new guess.
 */
export function genClickExpression(finds, timeoutMs = 1500) {
    return `(async () => {
        const dm = ${DOM_MATCH_RUNTIME};
        const found = await dm.waitForBest(${JSON.stringify(finds)}, ${timeoutMs});
        if (found.element === null) {
            return {
                clicked: null,
                reason: 'nothing on screen to act on',
                nearMisses: found.nearMisses,
            };
        }
        const target = found.element;
        const rect = target.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
            return {
                clicked: null,
                reason: 'the matching control is not visible right now',
                match: dm.describe(target),
            };
        }
        target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        target.click();
        return { clicked: dm.describe(target), matched: found.needle };
    })()`;
}

/**
 * Type into the box a label names, the React-compatible way: the native
 * value setter plus input/change events, or a textContent write for a
 * contenteditable. `submit` follows it with an Enter keydown/keyup pair.
 */
export function genTypeExpression(
    finds,
    value,
    { submit = false, timeoutMs = 1500 } = {},
) {
    return `(async () => {
        const dm = ${DOM_MATCH_RUNTIME};
        const found = await dm.waitForBest(
            ${JSON.stringify(finds)}, ${timeoutMs}, { onlyBoxes: true },
        );
        if (found.element === null) {
            return {
                typed: null,
                reason: 'nothing on screen to act on',
                nearMisses: found.nearMisses,
            };
        }
        const target = found.element;
        const rect = target.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
            return {
                typed: null,
                reason: 'the matching box is not visible right now',
                match: dm.describe(target),
            };
        }
        target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        target.focus();
        if (target.isContentEditable === true) {
            target.textContent = ${JSON.stringify(value)};
            target.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
            // Off the element's own prototype, not the global classes: an
            // evaluated string can run in a realm whose HTMLInputElement is
            // not the one this element was made from.
            const setter = Object.getOwnPropertyDescriptor(
                Object.getPrototypeOf(target),
                'value',
            )?.set;
            if (setter === undefined) {
                return {
                    typed: null,
                    reason: 'the matching control is not a text box',
                    match: dm.describe(target),
                };
            }
            setter.call(target, ${JSON.stringify(value)});
            target.dispatchEvent(new Event('input', { bubbles: true }));
            target.dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (${submit ? 'true' : 'false'}) {
            for (const type of ['keydown', 'keyup']) {
                target.dispatchEvent(new KeyboardEvent(type, {
                    key: 'Enter', bubbles: true,
                }));
            }
        }
        return { typed: ${JSON.stringify(value)}, into: dm.describe(target) };
    })()`;
}

/**
 * `owa_find_ui`'s search: every control whose label fits the text at any
 * tier, best tier first, with a four-second beating outline when asked. A
 * zero answer comes back with the closest labels on screen, so "where is the
 * reference box" can still point at the "Bible Reference" box that is there.
 */
export function genFindUiExpression(text, isHighlighting) {
    return `(() => {
        const dm = ${DOM_MATCH_RUNTIME};
        const needle = String(${JSON.stringify(String(text))})
            .toLowerCase().trim();
        const found = [];
        for (const element of dm.collect()) {
            const label = dm.labelOf(element);
            if (label.length === 0) {
                continue;
            }
            const tier = dm.matchTier(label.toLowerCase(), needle);
            if (tier === -1) {
                continue;
            }
            found.push({ element, described: Object.assign(
                dm.describe(element), { tier },
            ) });
            if (found.length >= 40) {
                break;
            }
        }
        found.sort((one, other) => {
            return one.described.tier - other.described.tier ||
                one.described.label.length - other.described.label.length;
        });
        // Ring what is ANSWERED, after the sort -- not everything the scan
        // touched, in document order, before it. A loose word used to light up
        // forty controls while the answer named twenty of them, most of which
        // were not the twenty that were ringed.
        const shown = found.slice(0, ${MAX_FIND_UI_MATCHES});
        if (${isHighlighting ? 'true' : 'false'}) {
            for (const one of shown) {
                dm.flash(one.element);
            }
        }
        return {
            // The real total, so a caller told "3 matches" can trust it and
            // one told "40" knows to ask a narrower question.
            count: found.length,
            shownCount: shown.length,
            matches: shown.map((one) => one.described),
            nearMisses: shown.length === 0 ? dm.nearMisses([needle]) : [],
        };
    })()`;
}
