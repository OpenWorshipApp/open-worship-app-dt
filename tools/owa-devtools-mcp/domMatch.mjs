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

import { PRESS_GUARD_SOURCE } from './destructiveLabel.mjs';

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
        const tag = element.tagName;
        // A picker reads as the option it is ON, never as every option it
        // holds. textContent on a <select> is all of them glued together --
        // "AssistantClaudeChatGPTKimiFree", "LightDarkSystem Theme", the
        // Reader's "FindCross ReferenceLocation-Name (KJV)Resources" -- which
        // is a label no needle can match and one no control on screen shows.
        // So every picker in the app was unfindable, unclickable, and listed
        // to the model as words the user cannot see.
        const ownText =
            tag === 'SELECT'
                ? (element.selectedOptions[0] ?? {}).text
                : element.textContent;
        const parts = [
            widget === null ? ownText : widget,
            element.getAttribute('title'),
            element.getAttribute('aria-label'),
            element.getAttribute('placeholder'),
        ];
        // A box that already holds text is named by it as much as by any
        // label beside it ("(KJV) John 3:16" IS how the reference box reads).
        if (tag === 'INPUT' || tag === 'TEXTAREA') {
            parts.push(element.value);
        }
        // Said once. A control that carries the same words as its title
        // AND its aria-label -- the show/hide toggle does, so does every
        // button built that way -- used to be listed as "Toggle showing
        // screen [F5] Toggle showing screen [F5]", and a model that reads a
        // label back as a click target passes the doubled thing on.
        const seen = new Set();
        return parts
            .filter(Boolean)
            .map((part) => { return part.replace(/\\s+/g, ' ').trim(); })
            .filter((part) => {
                if (part.length === 0 || seen.has(part)) {
                    return false;
                }
                // A tooltip that is the file's PATH is not a name anybody
                // presses by, and it is the one thing on a label the model
                // must never repeat: the previewer's footer carries the
                // document's full path in its title, so a list of the
                // Presenter read "Amazing Grace C:\\Users\\...\\documents\\Amazing
                // Gra" (EC-130). Dropped from the parts, so neither a list
                // nor a match ever carries it; the words beside it stay.
                if (checkIsFilePath(part)) {
                    return false;
                }
                seen.add(part);
                return true;
            });
    };
    // A Windows drive, a UNC share, or the usual roots of a Unix home. Written
    // for the runtime's template literal, so every backslash is doubled here.
    const FILE_PATH_PATTERN =
        /^(?:[A-Za-z]:[\\\\/]|\\\\\\\\|\\/(?:Users|home|Volumes|mnt|tmp|var)\\/)/;
    const checkIsFilePath = (part) => {
        return FILE_PATH_PATTERN.test(part);
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

    // Is one of those names what was asked for once the decoration comes
    // off -- the shortcut a title carries in brackets ("Toggle showing
    // screen [F5]"), an icon glyph in front of the words? This is the bar
    // for PRESSING. The tiers below it are right for pointing and for a
    // near miss, and wrong for a click: measured 2026-09-08 over every
    // recipe step, the demo pressed "Clear All [F6]" on the projector for a
    // step about the drawing panel's Clear, "Break lines following model
    // formatting" for "Follow", "Add Bible Item" for "Add", and opened the
    // help window for "ASSISTANT" -- every one a tier-1 or looser match
    // taken as the thing itself.
    const normaliseLabelPart = (part) => {
        return String(part)
            .toLowerCase()
            .replace(/\\[[^\\]]*\\]/g, ' ')
            .replace(/^[^\\p{L}\\p{N}]+/u, '')
            .replace(/\\s+/g, ' ')
            .trim();
    };
    // The NEEDLE loses the same decoration: the words a tool hands back
    // carry the shortcut -- owa_list_screens says "Clear Bible [F9]", the
    // title of that button -- and a press by those exact words was refused
    // because the part had lost its bracket and the needle had not
    // (EC-135: "Close [Ctrl+Q]" on the Bible Lookup, "Clear Bible [F9]" on
    // the Mini Screen, both the control's own title). A needle that is
    // nothing but decoration matches nothing.
    const checkIsNamedNearly = (element, needle) => {
        const bare = normaliseLabelPart(needle);
        if (bare.length === 0) {
            return false;
        }
        return labelPartsOf(element).some((part) => {
            return normaliseLabelPart(part) === bare;
        });
    };

    // What a caller is SHOWN, as against what is matched on. A title that
    // carries its shortcut beside an aria-label that does not -- "Clear All
    // [F6]" and "Clear All" -- is one name said twice, and the exact-repeat
    // rule in labelPartsOf cannot see it: both matchers listed that button
    // as "Clear All [F6] Clear All" while owa_list_screens called it "Clear
    // All [F6]", and a model reads a label back as the words to press. The
    // bare part stays in labelPartsOf, where the exact-name tie-breaker
    // above reads it; only the words handed OUT drop the shorter twin.
    const shownLabelOf = (element) => {
        const parts = labelPartsOf(element);
        return parts.filter((part) => {
            const bare = normaliseLabelPart(part);
            return !parts.some((other) => {
                return other.length > part.length &&
                    normaliseLabelPart(other) === bare;
            });
        }).join(' ');
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
        // Of two controls that fit equally, the one already on show.
        // Ranked BELOW isControl on purpose: a hover-revealed button
        // is a real thing to press and a visible container is not, so
        // reaching for whatever is visible first is exactly the
        // wrong-ring bug this ordering was built to stop.
        if (candidate.isShown !== best.isShown) {
            return candidate.isShown;
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

    // Words a question is built out of rather than the thing it names. Only
    // the near-miss ranking reads it: an exact match is still an exact
    // match, "the" and all.
    const FILLER_WORD_SET = new Set([
        'a', 'an', 'the', 'to', 'of', 'for', 'in', 'on', 'at', 'or', 'and',
        'is', 'it', 'its', 'my', 'me', 'i', 'this', 'that', 'with', 'from',
        'do', 'does', 'can', 'how', 'where', 'what', 'which',
    ]);

    // A control a value goes INTO. A button carries a value accessor too,
    // so it is the tag and type that say, not the property. A <select> is
    // here because choosing an option is the same errand as typing a value
    // and owa_type is the only tool for it -- left out, a picker could be
    // neither found nor changed, and the one way to answer "put it on Khmer"
    // was a uid out of a snapshot.
    const checkIsTextBox = (element) => {
        if (element.isContentEditable === true) {
            return true;
        }
        const tag = element.tagName;
        if (tag === 'TEXTAREA' || tag === 'SELECT') {
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
        const asked = cut[cut.length - 1] ?? '';
        const target = dropKindNoun(asked);
        const scope = cut.length > 1
            ? dropKindNoun(cut.slice(0, -1).join(' ')).text
            : null;
        return {
            text: target.text,
            asked,
            scope: scope !== null && scope.length > 0 ? scope : null,
            isRegionWanted: target.isRegionWanted,
        };
    };

    // The tier of a label against a parsed needle. "Document List" and
    // "Presenting Flow List" are panes NAMED with a kind noun, and the
    // divider between them carries both; with the noun dropped they were a
    // loose fit on their own label and never an exact one, which is the
    // one tier a press is allowed on. The whole words are tried for the
    // exact tier first -- against the joined label and against each of
    // its parts, because the collapsed strip of that pane is named
    // "Presenting Flow List" AND "Enable Presenting Flow List" and the
    // demo refused to press it -- the trimmed ones for everything else.
    const tierOf = (element, lowered, parsed) => {
        if (
            parsed.asked !== parsed.text &&
            (lowered === parsed.asked ||
                checkIsNamedNearly(element, parsed.asked))
        ) {
            return 0;
        }
        return matchTier(lowered, parsed.text);
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

    // ------------------------------------------------------------------
    // Controls this app only paints while the mouse is over them.
    //
    // A row of icons that appears on hover is NOT missing from the page:
    // it is laid out, sized and clickable, and hidden by visibility (or a
    // zero opacity) rather than by display. So "does it have a box?"
    // -- the only question this matcher used to ask -- answered yes, and
    // the ring landed on blank space above a bible view while the answer
    // named a button the user could not see. The six icons over every
    // bible view (Copy, Split, Save, Export...) are exactly that, and so
    // are two dozen more controls on the presenter as it stands.
    const VISIBILITY_OPTIONS = {
        checkVisibilityCSS: true,
        opacityProperty: true,
    };

    // Three states, because they want three different answers.
    // 'shown'  -- a person can see it.
    // 'hidden' -- laid out but painted away. Reachable, and revealHidden
    //             below brings it back.
    // 'gone'   -- no box at all: display:none, or a panel that is closed.
    //             Nothing to reveal and nothing to ring.
    // Measured on the presenter: checkVisibility answers for all 659
    // controls in 0.4ms against 11ms for the ancestor walk it replaces --
    // this runs for every element on the window, on machines that count.
    const visibilityOf = (element) => {
        if (element.checkVisibility(VISIBILITY_OPTIONS)) {
            return 'shown';
        }
        // Has it a box at all? That is what checkVisibility answers with
        // no options: display:none and anything not being rendered say no,
        // while a control merely painted away still says yes. Reading the
        // rect instead would answer the same and force a layout to do it.
        return element.checkVisibility() ? 'hidden' : 'gone';
    };

    const HOVER_ATTR = 'data-owa-hover';
    // Far past any real nesting; a guard against a cycle, not a budget.
    const MAX_HOVER_CHAIN = 40;

    // The page own :hover rules, re-aimed at an attribute we can put on
    // an element ourselves. :hover and [attr] weigh the SAME in the
    // cascade, so a rewritten rule beats its twin only by coming later in
    // the sheet -- which is the whole trick, and why none of this needs
    // an !important that would then have to be undone.
    //
    // Read fresh on every reveal rather than cached: 162 of the
    // presenter's 5639 rules carry :hover and finding them costs ~7ms,
    // against a table that would then sit in the page for the rest of the
    // session on a machine that cannot spare it. A reveal happens once
    // per acting call, never per frame.
    const collectHoverRules = () => {
        const rules = [];
        const walk = (list) => {
            for (const rule of list) {
                const selector = rule.selectorText;
                if (
                    typeof selector === 'string' &&
                    selector.includes(':hover') && rule.style !== undefined
                ) {
                    rules.push({
                        forced: selector.split(':hover')
                            .join('[' + HOVER_ATTR + ']'),
                        body: rule.style.cssText,
                    });
                }
                // A style rule carries cssRules of its own now that CSS
                // nesting exists -- empty for most of them, and the
                // nested half of the sheet for the rest. Skipping them
                // read the app's stylesheets as having no hover rules.
                if (rule.cssRules !== undefined && rule.cssRules.length) {
                    walk(rule.cssRules);
                }
            }
        };
        for (const sheet of document.styleSheets) {
            try {
                walk(sheet.cssRules);
            } catch (error) {
                // A sheet from another origin will not open its rules.
                // The app's own are all same-origin; skipping is right.
            }
        }
        return rules;
    };

    // One reveal at a time, so the page can never be left wearing more
    // than one of ours -- and it always lapses by itself. A caller that
    // never gets to release (a click that navigates, a card that is
    // closed) still hands the window back the way it found it.
    let held = null;

    const releaseHidden = () => {
        if (held === null) {
            return;
        }
        clearTimeout(held.timeoutId);
        for (const node of held.chain) {
            node.removeAttribute(HOVER_ATTR);
        }
        held.style.remove();
        held = null;
    };

    // Hold a hover-revealed control visible, without touching the mouse.
    //
    // The mouse is the user. Moving it -- even synthetically -- fights
    // them for it and lands wherever the window has scrolled to since.
    // Forcing the state the mouse WOULD have produced is the same result
    // and none of that, and it stays put while they read the card, where
    // a real hover would end the moment they reached for the button.
    //
    // Answers whether the control is BEING HELD visible -- true for a
    // reveal this call made and true for one already up (the hold is
    // re-armed), false when it never needed one. Callers say "hold this
    // if it needs holding" and read the answer; asking them to test
    // first made the guide card drop its own explanation on the second
    // render of a step, when the control it was describing was visible
    // precisely BECAUSE the card was holding it.
    //
    // Every ancestor is stamped, not just the one that does the hiding:
    // the browser marks the whole chain :hover when a mouse is over a
    // control, and the rule that reveals a toolbar is written several
    // levels up (the icons over a bible view are revealed by the bible
    // view itself). Only rules that match something on that chain are
    // injected, so a reveal is five rules, not the page's 162.
    const revealHidden = (element, holdMs = 4000) => {
        if (held !== null && held.element === element) {
            clearTimeout(held.timeoutId);
            held.timeoutId = setTimeout(releaseHidden, holdMs);
            return true;
        }
        releaseHidden();
        if (visibilityOf(element) !== 'hidden') {
            return false;
        }
        const chain = [];
        let node = element;
        while (
            node !== null && node.nodeType === 1 &&
            chain.length < MAX_HOVER_CHAIN
        ) {
            chain.push(node);
            node = node.parentElement;
        }
        const unstamp = () => {
            for (const one of chain) {
                one.removeAttribute(HOVER_ATTR);
            }
        };
        for (const one of chain) {
            one.setAttribute(HOVER_ATTR, '');
        }
        const wanted = [];
        for (const rule of collectHoverRules()) {
            let isWanted = false;
            try {
                isWanted = chain.some((one) => {
                    return one.matches(rule.forced);
                });
            } catch (error) {
                // A selector this engine will not parse is not ours.
                isWanted = false;
            }
            if (isWanted) {
                wanted.push(rule.forced + '{' + rule.body + '}');
            }
        }
        if (wanted.length === 0) {
            unstamp();
            return false;
        }
        const style = document.createElement('style');
        style.setAttribute('data-owa-hover-style', '');
        style.textContent = wanted.join(' ');
        document.head.append(style);
        // Judged WITHOUT the opacity test that classified it. A reveal
        // the app fades in over half a second is still at opacity 0 the
        // instant the rule lands -- a running transition keeps the old
        // computed value until its first frame -- so measuring the end of
        // a fade before it starts fails every one of them. Visibility and
        // display flip at once, and they are what hides these controls.
        if (!element.checkVisibility({ checkVisibilityCSS: true })) {
            unstamp();
            style.remove();
            return false;
        }
        held = {
            element, chain, style,
            timeoutId: setTimeout(releaseHidden, holdMs),
        };
        return true;
    };

    // Every candidate the caller offered, in order, until one is on screen.
    // A hidden match is kept only as a fallback: the panel it belongs to may
    // simply be closed, which is a different answer than "not there". With
    // onlyBoxes (typing) a button that merely shares the words is skipped
    // -- "Genesis 1" is a history row to click, never a box to type into.
    // preferPressSafe: keep scanning the candidates for one whose match is
    // exact before settling for a loose fit on an earlier one. A step offers
    // its candidates in order and the first with ANY match used to win: a
    // step naming "Show" and "Toggle showing screen" answered with a
    // word-start match on "Add Stage" (…are shown) and never tried the
    // second, which is the control's exact title (measured 2026-09-08).
    const findBest = (
        needles,
        { onlyBoxes = false, preferPressSafe = false } = {},
    ) => {
        let hiddenFallback = null;
        let looseFallback = null;
        for (const one of needles) {
            const parsed = parseNeedle(one);
            const { text: needle, scope, isRegionWanted } = parsed;
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
                let tier = tierOf(element, lowered, parsed);
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
                const seen = visibilityOf(element);
                // Only a control with no box at all is set aside.
                // One that is merely painted away is a real answer --
                // the caller reveals it -- and dropping it here is
                // how a step ended up ringing whatever visible thing
                // shared its words instead.
                if (seen === 'gone') {
                    hiddenFallback = hiddenFallback ?? {
                        element, tier, needle: one,
                        isPressSafe:
                            tier === 0 || checkIsNamedNearly(element, needle),
                    };
                    continue;
                }
                const isRegion = checkIsRegion(element);
                const candidate = {
                    element, tier, needle: one, isInScope,
                    isShown: seen === 'shown',
                    isControl: checkIsControl(element),
                    isRegion,
                    isNamed: checkIsNamedExactly(element, needle),
                    // Safe to PRESS: the control is called what the step
                    // says, not merely containing or beginning with it --
                    // or it is the very panel the step asked for.
                    isPressSafe:
                        tier === 0 ||
                        checkIsNamedNearly(element, needle) ||
                        (isRegion && isRegionWanted),
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
                if (!preferPressSafe || best.isPressSafe === true) {
                    return best;
                }
                looseFallback = looseFallback ?? best;
            }
        }
        return looseFallback ?? hiddenFallback;
    };

    // When nothing matches, the labels that came closest. "reference box"
    // earns the real "Bible Reference" box as a near miss, and the caller
    // retries with the words actually on screen instead of declaring the
    // step impossible.
    //
    // Scored on the words that CARRY meaning. "button to change the
    // background" used to score every label holding "to" and "the" two
    // points and the Background panel one, so the offline where-is answer
    // offered a volunteer "pass after Click to open the verse" -- a line of
    // Genesis -- as the control they meant, with the real panel on screen.
    const nearMisses = (needles, limit = 5) => {
        const wantedTokens = [
            ...new Set(needles.flatMap((one) => {
                const parsed = parseNeedle(one);
                return tokensOf(
                    (parsed.scope === null ? '' : parsed.scope + ' ') +
                    parsed.text,
                );
            })),
        ].filter((token) => {
            return !FILLER_WORD_SET.has(token);
        });
        if (wantedTokens.length === 0) {
            return [];
        }
        const scored = new Map();
        for (const element of collect()) {
            const label = shownLabelOf(element);
            if (label.length === 0 || label.length > 120) {
                continue;
            }
            if (visibilityOf(element) === 'gone') {
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

    // A selector that finds THIS element again and nothing else.
    //
    // Asked for by the element picker: "the button I mean" is a thing a person
    // can point at and cannot describe, and every other field here describes.
    // It is built shortest-first and each candidate is TESTED against the
    // document before it is returned -- a selector that matches two elements is
    // worse than none, because it looks like an answer.
    //
    // Words the app chose beat position: 'data-widget-name', an aria-label or a
    // placeholder survive a re-render and a sibling being inserted, where
    // ':nth-child(7)' is right until the list above it grows by one. The tag
    // always leads so a bare attribute cannot match something unrelated.
    const cssEscape = (value) => {
        const text = String(value);
        return window.CSS !== undefined && CSS.escape !== undefined
            ? CSS.escape(text)
            : text.replace(/[^a-zA-Z0-9_-]/g, '\\\\$&');
    };
    const NAMING_ATTRIBUTES = [
        'data-widget-name', 'data-tab-key', 'name', 'aria-label',
        'placeholder', 'title',
    ];
    const selectorPartOf = (element) => {
        const tag = element.tagName.toLowerCase();
        const parent = element.parentElement;
        // Where it sits among its siblings -- the one thing that can always
        // tell two of them apart, held ready rather than used only as a last
        // resort. See the twin check below for why.
        const indexPart = parent === null
            ? ''
            : ':nth-child(' + ([...parent.children].indexOf(element) + 1) + ')';
        // An id is only worth using when it is one the app wrote. React and
        // Bootstrap both mint ids that change on the next render, and a
        // selector built on one is a selector that stops working while the
        // user is still looking at the same screen.
        const id = element.getAttribute('id');
        if (id !== null && /^[A-Za-z][\\w-]*$/.test(id) && !/[0-9]{4}/.test(id)) {
            return tag + '#' + cssEscape(id);
        }
        for (const name of NAMING_ATTRIBUTES) {
            const value = element.getAttribute(name);
            if (value !== null && value.length > 0 && value.length < 60) {
                const named = tag + '[' + name + '="' + value.replace(
                    /["\\\\]/g, '\\\\$&',
                ) + '"]';
                if (parent === null) {
                    return named;
                }
                // A name is preferred over a position because it survives a
                // re-render -- but only if it NAMES one thing. The reader
                // routinely has two panes called "Bible View" side by side,
                // and a part standing for both of them can never be rescued
                // by walking up: every ancestor they share is the same node,
                // so every longer candidate still matches two. That returned
                // null, which is what makes a chip the user pointed at
                // unpressable, and it took every control INSIDE the pane down
                // with it -- 156 of 949 elements in a two-Bible reader had no
                // selector at all. So a name that has a twin among its own
                // siblings keeps the name AND says which one.
                let twinCount = 0;
                for (const sibling of parent.children) {
                    try {
                        if (sibling.matches(named)) {
                            twinCount++;
                        }
                    } catch (_error) {
                        // A name this engine will not parse as a selector
                        // cannot be counted; fall through to the index, which
                        // is always safe.
                        return tag + indexPart;
                    }
                }
                return twinCount > 1 ? named + indexPart : named;
            }
        }
        return parent === null ? tag : tag + indexPart;
    };
    const MAX_SELECTOR_DEPTH = 8;
    const selectorOf = (element) => {
        if (element === null || element === undefined || element === document.body) {
            return null;
        }
        const parts = [];
        let current = element;
        for (let step = 0; step < MAX_SELECTOR_DEPTH; step++) {
            if (current === null || current === document.body) {
                break;
            }
            parts.unshift(selectorPartOf(current));
            const candidate = parts.join(' > ');
            try {
                const found = document.querySelectorAll(candidate);
                if (found.length === 1 && found[0] === element) {
                    return candidate;
                }
            } catch (_error) {
                // A selector this engine will not parse is not an answer.
                return null;
            }
            current = current.parentElement;
        }
        return null;
    };

    const describe = (element) => {
        const rect = element.getBoundingClientRect();
        const seen = visibilityOf(element);
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
            label: shownLabelOf(element).slice(0, 80),
            inPanel,
            where: vertical === 'middle' && horizontal === 'center'
                ? 'in the middle of the window'
                : 'at the ' + vertical + ' ' + horizontal + ' of the window',
            tag: element.tagName.toLowerCase(),
            // Having a box is not being visible. A control the app
            // paints only under the mouse used to report
            // isVisible: true, so an answer sent someone looking for
            // a button that was not on their screen.
            isVisible: seen === 'shown',
            // Said only when it is true, so an ordinary control costs
            // the reader nothing: this one appears when the mouse is
            // over the part of the window it lives in.
            showsOnHover: seen === 'hidden' ? true : undefined,
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
    // A DIVIDER between two panes is a few pixels across, so "20 in from
    // the edge" of one is a point in the pane beside it -- and a right-click
    // there gets that pane's menu, or none. Anything thinner than the inset
    // is aimed at its own centre.
    const openContextMenu = (element) => {
        const rect = element.getBoundingClientRect();
        const isThin = rect.width < 40 || rect.height < 24;
        const x = Math.round(
            isThin ? rect.x + rect.width / 2 : rect.x + rect.width - 20,
        );
        const y = Math.round(
            isThin ? rect.y + rect.height / 2 : rect.y + rect.height - 12,
        );
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
            // Hover-revealed controls stay on the list, marked:
            // leaving them off is what stopped the assistant ever
            // mentioning the row of icons above a bible view. Only
            // what has no box at all is skipped.
            if (visibilityOf(element) === 'gone') {
                continue;
            }
            const rect = element.getBoundingClientRect();
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
            rows.push(describeRow(element));
            if (rows.length >= limit) {
                break;
            }
        }
        return rows;
    };

    // A LIST row is not a match. "describe" answers "which control is this?"
    // for one control -- its box, its tag, and in dev the component that
    // renders it, which is what a developer driving QA follows into the
    // source. A list is two hundred of them read for their WORDS, and every
    // field beyond the words is paid two hundred times: measured 2026-09-09
    // (EC-130), one "owa_list_ui limit: 200" answer was 34 574 tokens,
    // ~180 a row, written into the model's cache and read back on every
    // round after it -- and "component" / "sourceFile" on every row are the
    // two names the prompt forbids the model to repeat, handed to it two
    // hundred times over. So a row is the label, the panel, where it sits
    // and only what is UNUSUAL about it: "showsOnHover" when the app paints
    // it under the mouse alone, "isDisabled" when it is greyed out. A key
    // that is absent means the ordinary thing, and the tool's description
    // says so. Same shape for both callers -- a developer who wants the
    // component of a row asks "owa_find_ui" for that one control.
    const describeRow = (element) => {
        const full = describe(element);
        const row = {
            label: full.label,
            inPanel: full.inPanel,
            where: full.where,
        };
        if (full.showsOnHover === true) {
            row.showsOnHover = true;
        }
        if (full.isEnabled === false) {
            row.isDisabled = true;
        }
        return row;
    };

    window.__owaDomMatch = {
        collect, labelOf, labelPartsOf, shownLabelOf, matchTier, tierOf,
        checkIsControl,
        visibilityOf, revealHidden, releaseHidden,
        checkIsNamedExactly, checkIsTextBox, findBest, findListRegion,
        openContextMenu, waitForBest, nearMisses, describe, flash,
        listControls, parseNeedle, containerPathOf, checkIsRegion,
        checkIsInScope, pathTier, checkIsBetter, selectorOf,
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
 *
 * It answers with what the press DID as well as what it hit. Pressing is not
 * an outcome, and a tool that reports only the press invites the answer this
 * was built after: asked to turn the projector on, the assistant matched a
 * toolbar-reveal decoration titled "Show", was told it had clicked "Show",
 * and said "Done -- the screen is now showing" to a room with nothing on the
 * wall. So the control is read back AFTER the press: a toggle that flipped is
 * proof, and no readable state is `unverified`, which is a worse answer than
 * proof and a far better one than silence.
 */
export function genClickExpression(
    finds,
    timeoutMs = 1500,
    settleMs = 250,
    { guard = null } = {},
) {
    return `(async () => {
        const dm = ${DOM_MATCH_RUNTIME};
        const guard = ${JSON.stringify(guard)};
        const pressGuard = ${guard === null ? 'null' : PRESS_GUARD_SOURCE};
        // The on/off a control carries about ITSELF, or null when it carries
        // none. Read off the accessibility tree first because that is what
        // the app already maintains for these -- the show/hide screen control
        // is a styled div whose aria-pressed IS its state -- and off
        // .checked only for a real input.
        const stateOf = (element) => {
            for (const name of ['aria-pressed', 'aria-checked', 'aria-expanded', 'aria-selected']) {
                const value = element.getAttribute(name);
                if (value === 'true' || value === 'false') {
                    return value === 'true';
                }
            }
            // This app's panel tabs (Documents / Bibles / Foreground, the
            // Background tabs) are Bootstrap nav-links whose state is the
            // 'active' class and nothing in the accessibility tree, and a
            // press on one TOGGLES its panel. Read as no state, a press that
            // closed the panel reported 'nothing changed' -- 2026-09-11,
            // asked to start a countdown, the model pressed Foreground (open
            // already), was told the press proved nothing, and spent its
            // remaining rounds looking for controls it had just hidden.
            if (element.matches('.nav-link, [role="tab"]')) {
                return element.classList.contains('active');
            }
            return typeof element.checked === 'boolean'
                ? element.checked
                : null;
        };
        const found = await dm.waitForBest(
            ${JSON.stringify(finds)}, ${timeoutMs}, { preferPressSafe: true },
        );
        if (found.element === null) {
            return {
                clicked: null,
                reason: 'nothing on screen to act on',
                nearMisses: found.nearMisses,
            };
        }
        // The same bar the guide card's Do it holds (isPressSafe): a press
        // lands only on a control CALLED what was asked for. The looser tiers
        // are right for pointing and wrong for a click -- 2026-09-08, asked
        // to show the projector, the model's "show screen" matched the Bible
        // Lookup's "Save bible item and show on screen" (every word, out of
        // order), and a click there would have PRESENTED a verse to the
        // congregation. Refused with the control it found, so the retry is
        // its exact words rather than a new guess.
        if (found.isPressSafe !== true) {
            return {
                clicked: null,
                reason:
                    'the closest control on screen is not called that -- a ' +
                    'press needs the exact words written on the control. ' +
                    'Retry with the label under nearest, or one of nearMisses.',
                nearest: dm.describe(found.element),
                nearMisses: dm.nearMisses(${JSON.stringify(finds)}),
            };
        }
        const target = found.element;
        // The interlock, read off the control itself (destructiveLabel.mjs).
        // The firewall already read the words this press was aimed with; this
        // is the half that does not care how the control was named -- a
        // translation, a title saying Delete on a button whose own text does
        // not -- and the half that never answers a question the app is asking
        // the user. Before the hover is forced, so a refusal leaves the window
        // exactly as it was.
        if (pressGuard !== null) {
            const refusal = pressGuard.findPressRefusal(target, guard.rule);
            if (refusal !== null) {
                return Object.assign(
                    { clicked: null, match: dm.describe(target) },
                    refusal,
                );
            }
        }
        // Controls this app only paints under the mouse are
        // pressed with the mouse nowhere near them, so the hover
        // is forced first -- and held a moment AFTER the press,
        // because a button that is invisible before and after it
        // is pressed leaves the user with no idea what happened.
        const isRevealed = dm.revealHidden(target, 1500);
        if (dm.visibilityOf(target) === 'gone') {
            return {
                clicked: null,
                reason: 'the matching control is not visible right now',
                match: dm.describe(target),
            };
        }
        target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        const describedBefore = dm.describe(target);
        const stateBefore = stateOf(target);
        target.click();
        // This app re-renders on an event, not on the press, so reading the
        // control straight back reports what it looked like BEFORE it was
        // pressed -- which would have made every toggle report 'no change'.
        await new Promise((resolve) => { setTimeout(resolve, ${settleMs}); });
        // Three kinds of evidence, weakest last. A control that is GONE did
        // something (a menu item, a row that closed its own panel); a toggle
        // that flipped is the state itself; a label that turned Show into
        // Hide is the same fact written in words. Anything else is a press
        // with nothing to show for it.
        const isStillHere = target.isConnected;
        const stateAfter = isStillHere ? stateOf(target) : null;
        // Read the way describedBefore was, or a label merely re-joined
        // would read as a change.
        const labelAfter = isStillHere ? dm.describe(target).label : null;
        const didChange = !isStillHere
            ? true
            : (stateBefore !== null || stateAfter !== null
                ? stateAfter !== stateBefore
                : labelAfter !== describedBefore.label);
        return {
            clicked: describedBefore,
            matched: found.needle,
            // Only when it happened, and said in the words the
            // answer needs: this control is not on their screen
            // until they put the mouse over that part of it.
            revealedForHover: isRevealed ? true : undefined,
            // What the control says about itself now. Present only when it
            // says anything at all -- a plain button says nothing, and
            // inventing an 'on' for it would be the same lie in a new place.
            isOnNow: stateAfter === null ? undefined : stateAfter,
            // Whether anything about the control itself changed. false is
            // the interesting one: a press that did nothing at all.
            didChange,
            // The one field written for the model rather than about the DOM.
            // Absent evidence must not read as success, so it is spelled out
            // rather than left to be inferred from a missing key.
            unverified: didChange
                ? undefined
                : 'The press left this control exactly as it was, so nothing ' +
                    'is proven. Check the thing you were asked to change -- ' +
                    'owa_list_screens for the projector, owa_app_state for ' +
                    'the window, owa_find_ui for the control -- or tell the ' +
                    'user what you pressed rather than what happened.',
        };
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
    { submit = false, timeoutMs = 1500, guard = null } = {},
) {
    return `(async () => {
        const dm = ${DOM_MATCH_RUNTIME};
        const guard = ${JSON.stringify(guard)};
        const pressGuard = ${guard === null ? 'null' : PRESS_GUARD_SOURCE};
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
        // A box inside a question the app is asking is the user's to fill,
        // and one NAMED for something that cannot be undone is not filled in
        // on their behalf. The words typed are content and are not read: a
        // song may well be called "Remove My Sin".
        if (pressGuard !== null) {
            const refusal = pressGuard.findPressRefusal(target, guard.rule);
            if (refusal !== null) {
                return Object.assign(
                    { typed: null, match: dm.describe(target) },
                    refusal,
                );
            }
        }
        // A box inside a bar the app hides until the mouse is over
        // it types perfectly well -- but typing into something the
        // user cannot see is how they end up not believing us.
        const isRevealed = dm.revealHidden(target, 4000);
        if (dm.visibilityOf(target) === 'gone') {
            return {
                typed: null,
                reason: 'the matching box is not visible right now',
                match: dm.describe(target),
            };
        }
        target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        target.focus();
        // A picker is not typed into: the words asked for NAME one of its
        // options, and what goes in is that option's own value. Resolved
        // here so the write below is the one a text box gets -- through the
        // element's own value setter, which is what defeats React's value
        // tracker and makes the choice stick instead of snapping back.
        let valueToSet = ${JSON.stringify(value)};
        let chosenOptionText = null;
        if (target.tagName === 'SELECT') {
            const textOf = (one) => { return (one.text ?? '').trim(); };
            const options = [...target.options];
            const wanted = valueToSet.trim();
            const lowered = wanted.toLowerCase();
            const chosen =
                options.find((one) => { return textOf(one) === wanted; }) ??
                options.find((one) => {
                    return textOf(one).toLowerCase() === lowered;
                }) ??
                options.find((one) => { return one.value === wanted; });
            if (chosen === undefined) {
                // Answered with the options there ARE, the same way a missed
                // label answers with the labels that are on screen.
                return {
                    typed: null,
                    reason: 'that is not one of the choices in this picker',
                    choices: options.map(textOf),
                    match: dm.describe(target),
                };
            }
            if (chosen.disabled === true) {
                return {
                    typed: null,
                    reason: 'that choice is listed but cannot be picked',
                    choices: options.map(textOf),
                    match: dm.describe(target),
                };
            }
            valueToSet = chosen.value;
            chosenOptionText = textOf(chosen);
            // Choosing IS the press on a picker, so the choice is what is
            // read: a picker merely offering "Delete" is not refused, one being
            // set to it is.
            if (pressGuard !== null &&
                pressGuard.checkIsDestructiveLabelText(
                    chosenOptionText, guard.rule,
                )) {
                return {
                    typed: null,
                    refused: 'destructive',
                    label: chosenOptionText,
                    match: dm.describe(target),
                };
            }
        }
        if (target.isContentEditable === true) {
            target.textContent = valueToSet;
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
            setter.call(target, valueToSet);
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
        return {
            typed: chosenOptionText ?? ${JSON.stringify(value)},
            chose: chosenOptionText ?? undefined,
            into: dm.describe(target),
            revealedForHover: isRevealed ? true : undefined,
        };
    })()`;
}

/**
 * `owa_find_ui`'s search: every control whose label fits the text at any
 * tier, best tier first, with a four-second beating outline when asked. A
 * zero answer comes back with the closest labels on screen, so "where is the
 * reference box" can still point at the "Bible Reference" box that is there.
 */
/**
 * Ring exactly the element a selector names, skipping the matcher entirely.
 *
 * For the one case where the caller already KNOWS which element it means: the
 * user pointed at it, and pressing its chip should show them where it went.
 * Going back through the label matcher there would be a guess dressed as a
 * lookup -- "Copy" is on six controls, and the one they picked is the one they
 * expect to light up.
 */
export function genHighlightSelectorExpression(selector, isHighlighting) {
    return `(() => {
        const dm = ${DOM_MATCH_RUNTIME};
        let element = null;
        try {
            element = document.querySelector(${JSON.stringify(String(selector))});
        } catch (_error) {
            return { found: false, reason: 'That is not a selector this page can read.' };
        }
        if (element === null) {
            // The honest answer, and a common one: panels come and go, and a
            // control picked ten minutes ago may simply not be on screen.
            return { found: false, reason: 'That control is not on the screen any more.' };
        }
        let isRevealed = false;
        if (${isHighlighting ? 'true' : 'false'}) {
            isRevealed = dm.revealHidden(element, 4000);
            dm.flash(element);
        }
        return {
            found: true,
            match: dm.describe(element),
            revealedForHover: isRevealed ? true : undefined,
        };
    })()`;
}

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
            let tier = dm.tierOf(element, lowered, asked);
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
        // Ringing a control the app has not painted points at
        // blank space. The best answer is held visible for as long
        // as its ring lasts -- one at a time, because a window
        // wearing several forced hovers at once is not a window
        // anybody could recognise.
        let isRevealed = false;
        if (${isHighlighting ? 'true' : 'false'} && shown.length > 0) {
            isRevealed = dm.revealHidden(shown[0].element, 4000);
        }
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
            revealedForHover: isRevealed ? true : undefined,
            nearMisses: shown.length === 0
                ? dm.nearMisses([${JSON.stringify(String(text))}])
                : [],
        };
    })()`;
}
