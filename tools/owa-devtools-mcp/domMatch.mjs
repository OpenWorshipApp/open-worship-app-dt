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
        // A panel is a place a step can send someone -- "open the Background
        // panel" -- and an OPEN one draws its name nowhere, so until this it
        // was not on the list at all and the words landed on whatever button
        // shared them.
        '[data-widget-name]', '[role="region"]', '[role="tabpanel"]',
    ].join(', ');
    const collect = () => [...document.querySelectorAll(SELECTOR)];

    // Every way the element is named, kept APART as well as joined. An
    // element whose own text is exactly the words asked for is a better
    // answer than one that merely contains them, and joining first threw
    // that away: the collapsed "Background" panel bar lost to the
    // "Background:" transition button beside the screen preview, so a
    // walkthrough step that meant "open the background panel" opened the
    // transition menu instead.
    const labelPartsOf = (element) => {
        // A named panel is named by that name and nothing else. Its
        // textContent is every word the panel contains -- a label no needle
        // can match, and one whose cost is the whole subtree, on a window
        // where this runs for every element in it. The attribute is also the
        // pane's ENGLISH name, which is the point: the visible one is
        // translated, and a panel that only answers to its Khmer text is a
        // panel this matcher loses the moment the app is switched over.
        const widget = element.getAttribute('data-widget-name');
        const parts = [
            widget === null ? element.textContent : widget,
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
        return parts
            .filter(Boolean)
            .map((part) => { return part.replace(/\\s+/g, ' ').trim(); })
            .filter((part) => { return part.length > 0; });
    };

    const labelOf = (element) => {
        return labelPartsOf(element).join(' ');
    };

    // Is one of those names EXACTLY what was asked for? A tie-breaker,
    // not a tier: it is ranked below "is it a control" on purpose,
    // because a container is often named exactly what the control inside
    // it is named, and pressing the container is how the wrong thing
    // happens.
    const checkIsNamedExactly = (element, needle) => {
        return labelPartsOf(element).some((part) => {
            return part.toLowerCase() === needle;
        });
    };

    // A named PLACE rather than a thing to press: a resizable panel, a
    // dialog, the body of a tab. Read off the attribute first because this
    // runs for every ancestor of every candidate -- the roles below are the
    // rare case, the panes are the common one.
    const regionNameOf = (element) => {
        const named = element.getAttribute('data-widget-name');
        if (named !== null && named.trim().length > 0) {
            return named.trim();
        }
        const role = element.getAttribute('role');
        const tag = element.tagName;
        if (
            role !== 'region' && role !== 'tabpanel' && role !== 'dialog' &&
            tag !== 'DIALOG'
        ) {
            return null;
        }
        const aria = element.getAttribute('aria-label');
        return aria !== null && aria.trim().length > 0 ? aria.trim() : null;
    };

    const checkIsRegion = (element) => {
        return regionNameOf(element) !== null;
    };

    // The named panels a control sits INSIDE, nearest first -- the parent
    // path. It is what tells "the Videos tab in the Background panel" from
    // the Videos tab of some other panel, and what lets a step name a
    // container the control's own label never mentions.
    // Bounded twice over: four names is more context than any step needs, and
    // the walk stops well short of the document. It is computed for the
    // handful of elements that already MATCHED, never for every element on
    // screen -- which is why the tier below is tried on the label first.
    const containerPathOf = (element) => {
        const names = [];
        let node = element.parentElement;
        let hops = 0;
        while (node !== null && node !== document.body && hops < 24) {
            hops += 1;
            const name = regionNameOf(node);
            if (name !== null && !names.includes(name)) {
                names.push(name);
                if (names.length >= 4) {
                    break;
                }
            }
            node = node.parentElement;
        }
        return names;
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
    const checkIsBetter = (candidate, best, isRegionWanted = false) => {
        if (candidate.tier !== best.tier) {
            return candidate.tier < best.tier;
        }
        // "The Background panel" is a place, not a press. Without this the
        // rule below prefers any control that shares the word, which is
        // exactly how "open the Background panel" rang the background
        // TRANSITION button down beside the screen preview.
        if (isRegionWanted && candidate.isRegion !== best.isRegion) {
            return candidate.isRegion;
        }
        if (candidate.isControl !== best.isControl) {
            return candidate.isControl;
        }
        // Two controls that fit equally: the one inside the panel the step
        // named is the one the step meant.
        if (candidate.isInScope !== best.isInScope) {
            return candidate.isInScope;
        }
        // Named exactly beats named partly, whatever the labels weigh:
        // the collapsed panel called "Background" is what "Background"
        // means, even though "Background:" is the shorter string.
        if (candidate.isNamed !== best.isNamed) {
            return candidate.isNamed;
        }
        return candidate.length < best.length;
    };

    const checkIsWordChar = (character) => {
        return (character >= 'a' && character <= 'z') ||
            (character >= '0' && character <= '9');
    };
    // atWordStart alone is the looser test: the needle begins a word but
    // may run past its end ("Web" is how the manual writes the "Webs"
    // tab). Both ends is the tight one.
    const checkIsWordMatch = (label, needle, atWordStart = false) => {
        let at = label.indexOf(needle);
        while (at !== -1) {
            const before = at === 0 ? ' ' : label[at - 1];
            const end = at + needle.length;
            const after = end >= label.length ? ' ' : label[end];
            if (
                !checkIsWordChar(before) &&
                (atWordStart || !checkIsWordChar(after))
            ) {
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
        // A plain substring test here let a short needle hide INSIDE a
        // word: "Ok" (from a recipe's "choose Ok or Cancel") matched
        // "Bible Lookup ... lo-ok-up popup" and a walkthrough step rang
        // -- and in demo mode would have PRESSED -- the Bible Lookup
        // button. A match must at least begin a word.
        if (
            label.length <= needle.length * 8 + 60 &&
            checkIsWordMatch(label, needle, true)
        ) {
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

    // The words a step hangs on a label to say what KIND of thing it is
    // ("the Videos tab", "the Background panel"). They are never part of what
    // is written on the control, so a needle carrying one used to match
    // nothing and fall back to the bare word -- taking the qualifier's whole
    // point with it. Stripped from every needle; the region half additionally
    // says the words in front of it name a PLACE, not a thing to press.
    const KIND_NOUNS = [
        'panel', 'pane', 'section', 'area', 'widget', 'sidebar',
        'tab', 'button', 'box', 'field', 'list', 'menu',
    ];
    const REGION_NOUNS = [
        'panel', 'pane', 'section', 'area', 'widget', 'sidebar',
    ];

    const dropKindNoun = (text) => {
        const words = text.split(' ');
        const last = words[words.length - 1];
        if (words.length < 2 || !KIND_NOUNS.includes(last)) {
            return { text, isRegionWanted: false };
        }
        return {
            text: words.slice(0, -1).join(' '),
            isRegionWanted: REGION_NOUNS.includes(last),
        };
    };

    // "Background > Videos" is the Videos tab INSIDE the Background panel --
    // not the Videos tab of whichever panel answers first, which is how a
    // step that named both ended up ringing the wrong one. Everything before
    // the last arrow is the parent path to sit inside.
    const parseNeedle = (raw) => {
        const whole = String(raw ?? '').toLowerCase()
            .replace(/\\s+/g, ' ').trim();
        const cut = whole.split(/\\s*(?:>|\\u00bb)\\s*/).filter((one) => {
            return one.length > 0;
        });
        const target = dropKindNoun(cut[cut.length - 1] ?? '');
        const scope = cut.length > 1
            ? dropKindNoun(cut.slice(0, -1).join(' ')).text
            : null;
        return {
            text: target.text,
            scope: scope !== null && scope.length > 0 ? scope : null,
            isRegionWanted: target.isRegionWanted,
        };
    };

    const checkIsInScope = (path, scope) => {
        return path.some((name) => {
            return matchTier(name.toLowerCase(), scope) !== -1;
        });
    };

    // The container supplies the words the control's own label does not, so
    // the Videos tab inside the Background panel answers to "Background
    // Videos". At least one word must be on the control ITSELF -- otherwise
    // every control in that panel answers to it too, and the ring lands on
    // whichever one the scan reached first.
    const pathTier = (label, path, needle) => {
        const needleTokens = tokensOf(needle);
        if (
            needleTokens.length < 2 || path.length === 0 ||
            label.length > needle.length * 8 + 60
        ) {
            return -1;
        }
        const own = new Set(tokensOf(label));
        if (!needleTokens.some((token) => own.has(token))) {
            return -1;
        }
        const around = new Set(tokensOf(path.join(' ')));
        const isCovered = needleTokens.every((token) => {
            return own.has(token) || around.has(token);
        });
        return isCovered ? 4 : -1;
    };

    // Every candidate the caller offered, in order, until one is on screen.
    // A hidden match is kept only as a fallback: the panel it belongs to may
    // simply be closed, which is a different answer than "not there". With
    // onlyBoxes (typing) a button that merely shares the words is skipped
    // -- "Genesis 1" is a history row to click, never a box to type into.
    const findBest = (needles, { onlyBoxes = false } = {}) => {
        let hiddenFallback = null;
        for (const one of needles) {
            const { text: needle, scope, isRegionWanted } = parseNeedle(one);
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
                const lowered = label.toLowerCase();
                // The label is tried FIRST and the parent path only when it
                // comes up empty: reading the path means walking ancestors,
                // and this loop runs for every element on the window.
                let path = null;
                let tier = matchTier(lowered, needle);
                if (tier === -1) {
                    path = containerPathOf(element);
                    tier = pathTier(lowered, path, needle);
                }
                if (tier === -1) {
                    continue;
                }
                let isInScope = false;
                if (scope !== null) {
                    path = path ?? containerPathOf(element);
                    isInScope = checkIsInScope(path, scope);
                    // A scope the caller wrote down is a requirement, not a
                    // hint: "Background > Videos" must never answer with the
                    // Videos of another panel, which is the whole reason the
                    // step said which panel.
                    if (!isInScope) {
                        continue;
                    }
                }
                const rect = element.getBoundingClientRect();
                if (rect.width === 0 || rect.height === 0) {
                    hiddenFallback = hiddenFallback ?? {
                        element, tier, needle: one,
                    };
                    continue;
                }
                const candidate = {
                    element, tier, needle: one, isInScope,
                    isControl: checkIsControl(element),
                    isRegion: checkIsRegion(element),
                    isNamed: checkIsNamedExactly(element, needle),
                    length: label.length,
                };
                if (
                    best === null ||
                    checkIsBetter(candidate, best, isRegionWanted)
                ) {
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
            ...new Set(needles.flatMap((one) => {
                const parsed = parseNeedle(one);
                return tokensOf(
                    (parsed.scope === null ? '' : parsed.scope + ' ') +
                    parsed.text,
                );
            })),
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
        // Which panel it is in, said the way the user would say it. It is
        // what makes two same-named controls tellable apart in an answer --
        // and what a caller quotes back as a scope ("Background > Videos")
        // to ask for exactly the one it meant.
        const inPanel = containerPathOf(element)[0] ?? null;
        return {
            label: labelOf(element).slice(0, 80),
            inPanel,
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
        // The colour travels with the beat, red through amber and back --
        // the window is full of bordered boxes, so a ring that only grows
        // reads as one more of them, while a ring that changes hue is the
        // only thing on screen doing it. An animation outranks the inline
        // border below in the cascade, which is what lets it take the
        // colour over without the marker having to be restyled per frame.
        beatStyle.textContent = '@keyframes owa-find-beat {' +
            '0%,100%{box-shadow:0 0 0 4px rgba(255,59,48,.3);' +
            'border-color:#ff3b30}' +
            '50%{box-shadow:0 0 0 12px rgba(255,214,10,.05);' +
            'border-color:#ffd60a}}' +
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

    // A step can point at a REGION instead of a control -- "right-click an
    // empty part of the list" names nothing with words on it, and no label
    // matcher will ever find one. The region a user means is the one they
    // are looking at, so a point is taken first (the guide hands over where
    // it last acted; a panel opens exactly where the bar that opened it was)
    // and only then the biggest scroller on screen.
    const checkIsScroller = (element) => {
        if (element === null || element.getBoundingClientRect === undefined) {
            return false;
        }
        const rect = element.getBoundingClientRect();
        return rect.width >= 200 && rect.height >= 100 &&
            element.scrollHeight > element.clientHeight + 4;
    };

    const findListRegion = (point) => {
        if (point !== null && point !== undefined) {
            let node = document.elementFromPoint(point.x, point.y);
            while (node !== null && node !== document.body) {
                if (checkIsScroller(node)) {
                    return node;
                }
                node = node.parentElement;
            }
        }
        // No scroller above the point -- the tab you just pressed sits
        // beside its list, not inside it. The NEAREST list is that list;
        // the biggest one on screen is some other panel entirely.
        let best = null;
        for (const element of document.querySelectorAll('div, ul, section')) {
            if (!checkIsScroller(element)) {
                continue;
            }
            const rect = element.getBoundingClientRect();
            const score = point === null || point === undefined
                ? -rect.width * rect.height
                : Math.hypot(
                    Math.max(rect.x - point.x, point.x - (rect.x + rect.width), 0),
                    Math.max(rect.y - point.y, point.y - (rect.y + rect.height), 0),
                );
            if (best === null || score < best.score) {
                best = { element, score };
            }
        }
        return best === null ? null : best.element;
    };

    // The app opens its own menu from the event COORDINATES, so a menu fired
    // at 0,0 is drawn in the corner away from what it belongs to. The point
    // is the bottom right INSIDE the region: a list fills from the top left,
    // so that is the part of it that is empty -- and right-clicking an item
    // instead gets the item's menu, which is a different menu.
    const openContextMenu = (element) => {
        const rect = element.getBoundingClientRect();
        const x = Math.round(rect.x + rect.width - 20);
        const y = Math.round(rect.y + rect.height - 12);
        const at = document.elementFromPoint(x, y) ?? element;
        at.dispatchEvent(new MouseEvent('contextmenu', {
            bubbles: true, cancelable: true, clientX: x, clientY: y, button: 2,
        }));
        return { x, y };
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
        collect, labelOf, labelPartsOf, matchTier, checkIsControl,
        checkIsNamedExactly, checkIsTextBox, findBest, findListRegion,
        openContextMenu, waitForBest, nearMisses, describe, flash,
        listControls, parseNeedle, containerPathOf, checkIsRegion,
        checkIsInScope, pathTier, checkIsBetter,
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
        // Parsed the same way the click matcher parses it, so "Background
        // panel" and "Background > Videos" mean here what they mean there --
        // an answer that ranks controls differently from the ring is an
        // answer that points somewhere the ring will not go.
        const asked = dm.parseNeedle(${JSON.stringify(String(text))});
        const needle = asked.text;
        const found = [];
        for (const element of dm.collect()) {
            const label = dm.labelOf(element);
            if (label.length === 0) {
                continue;
            }
            const lowered = label.toLowerCase();
            let path = null;
            let tier = dm.matchTier(lowered, needle);
            if (tier === -1) {
                path = dm.containerPathOf(element);
                tier = dm.pathTier(lowered, path, needle);
            }
            if (tier === -1) {
                continue;
            }
            let isInScope = false;
            if (asked.scope !== null) {
                path = path === null ? dm.containerPathOf(element) : path;
                isInScope = dm.checkIsInScope(path, asked.scope);
                if (!isInScope) {
                    continue;
                }
            }
            found.push({
                element, tier, isInScope,
                isControl: dm.checkIsControl(element),
                isRegion: dm.checkIsRegion(element),
                isNamed: dm.checkIsNamedExactly(element, needle),
                length: label.length,
                described: Object.assign(dm.describe(element), { tier }),
            });
            if (found.length >= 40) {
                break;
            }
        }
        found.sort((one, other) => {
            if (dm.checkIsBetter(one, other, asked.isRegionWanted)) {
                return -1;
            }
            return dm.checkIsBetter(other, one, asked.isRegionWanted) ? 1 : 0;
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
            nearMisses: shown.length === 0
                ? dm.nearMisses([${JSON.stringify(String(text))}])
                : [],
        };
    })()`;
}
