// What "cannot be undone by pressing it again" looks like -- in every language
// the app can be shown in, and read off the control that is about to be
// pressed rather than off the words somebody aimed with.
//
// The destructive interlock used to be twelve English regexes in
// `firewall.mjs`, read against a call's `find` argument. Measured 2026-09-14,
// three ways past it:
//
//  - **It could not read Khmer.** Every destructive label in the app's own
//    dictionary has a Khmer translation -- 41 of them -- and not one was
//    caught. `owa_list_ui`, `owa_list_screens` and the manual all hand the
//    model the words AS DISPLAYED, so in a Khmer window the model is given
//    `ផ្លាស់ទីទៅធុងសំរាម` for Move to Trash and `លុបទាំងអស់` for Clear All, and
//    `owa_click` pressed either one by those words.
//  - **It read the words, not the control.** The matcher collapses whitespace
//    before it compares and the patterns did not, so `Clear All` or
//    `Clear  All` matched no pattern and pressed Clear All [F6].
//  - **A walkthrough step is pressed with no words read at all.**
//    `owa_guide_step {action: "do"}` performs whatever `find` or `press` the
//    step was started with, and the firewall never sees either -- `press: "F6"`
//    is Clear All with no label anywhere, which is the very capability
//    `press_key` is withheld from the model for.
//
// So the rule is written once, here, and read in two places that are not the
// same check twice -- the split `webUrlPolicy.mjs` makes between the firewall
// and the socket:
//
//  - `firewall.mjs` reads it synchronously, on the words a call carries, so a
//    refusal is logged where every other refusal is and costs the app nothing;
//  - the PAGE reads it on the element the matcher resolved, immediately before
//    it is pressed (`PRESS_GUARD_SOURCE`, this module's own functions shipped as
//    their source text). That half is the authoritative one: it does not
//    depend on how the control was named, only on what it is called.
//
// Plain ESM with no imports at all, like `botFocus.mjs`: the page runtimes in
// `domMatch.mjs` and `guide.mjs` read it, so the dictionary the rule is derived
// from is loaded by the caller (`firewall.mjs`). The functions shipped into the
// page must stay self-contained -- no import, no module variable, nothing but
// their arguments and each other -- because what the page receives is their
// text.

// Word-boundary matches only, and deliberately short. A label blocklist that
// guesses wide is worse than none: it refuses ordinary work, the model learns
// the tool is unreliable, and it stops trying. Every entry names something
// that cannot be undone by pressing the thing again.
//
// Deliberately NOT here: bare "reset" (the View menu's *Reset Widgets Size* is
// harmless) and bare "clear" (*Clear Bible* is an ordinary presenting move a
// user asks for out loud). Both would have fired on controls a volunteer
// legitimately wants pressed.
//
// The two-word ones take any run of spaces, underscores or hyphens between
// the words: they are read on text that has already been normalised, and the
// matcher that presses the control is looser still.
export const DESTRUCTIVE_LABEL_PATTERNS = [
    /\bdelete\b/i,
    /\btrash\b/i,
    /\bdiscard\b/i,
    /\berase\b/i,
    /\bremove\b/i,
    /\buninstall\b/i,
    /\boverwrite\b/i,
    /\bclear[\s_-]+all\b/i,
    /\breset[\s_-]+all\b/i,
    /\bfactory\b/i,
    /\bsign[\s_-]+out\b/i,
    /\blog[\s_-]+out\b/i,
];

// A translated label is a control's name, not a sentence: the dictionary also
// carries confirm questions and toasts, which are never pressed and would
// only bloat the rule every press carries into the page.
const PHRASE_MAX_LENGTH = 60;

/**
 * A label as it is compared: compatibility forms folded (a no-break space, a
 * full-width letter), invisible format characters dropped, the `[F6]` a title
 * carries and any leading icon glyph taken off, whitespace collapsed.
 *
 * Shipped into the page: self-contained.
 */
export function toComparableLabel(text) {
    return String(text ?? '')
        .normalize('NFKC')
        .replace(/\p{Cf}/gu, '')
        .toLowerCase()
        .replace(/\[[^\]]*\]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^[^\p{L}\p{N}]+/u, '')
        .replace(/[^\p{L}\p{N}\p{M}]+$/u, '');
}

/**
 * Whether a label names something that cannot be undone.
 *
 * `rule` is `genDestructiveLabelRule`'s answer. English is read by pattern;
 * a translation by phrase. A phrase is found INSIDE a label only where it is
 * not glued to a letter of a script written with spaces between its words --
 * Khmer is written without them, so its phrases stand wherever they fall, and
 * a Latin-script word must never be caught inside a longer one ("Undelete").
 *
 * Shipped into the page beside `toComparableLabel`: self-contained apart from
 * that one name.
 */
export function checkIsDestructiveLabelText(text, rule) {
    if (rule === null || typeof rule !== 'object') {
        return false;
    }
    const comparable = toComparableLabel(text);
    if (comparable === '') {
        return false;
    }
    for (const pattern of rule.patterns ?? []) {
        if (new RegExp(pattern.source, pattern.flags).test(comparable)) {
            return true;
        }
    }
    if ((rule.exactPhrases ?? []).includes(comparable)) {
        return true;
    }
    const spacedWordPattern =
        /[\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}\p{Script=Hangul}\p{N}]/u;
    for (const phrase of rule.containPhrases ?? []) {
        let at = comparable.indexOf(phrase);
        while (at !== -1) {
            const before = at === 0 ? ' ' : comparable[at - 1];
            const end = at + phrase.length;
            const after = end >= comparable.length ? ' ' : comparable[end];
            if (!spacedWordPattern.test(before) && !spacedWordPattern.test(after)) {
                return true;
            }
            at = comparable.indexOf(phrase, at + 1);
        }
    }
    return false;
}

/**
 * Why pressing this element for the user is refused, or null.
 *
 * Two answers, and both are about the element itself:
 *
 *  - `question`: it is part of a question the app is asking the USER -- the
 *    confirm, alert and input popups, the only three things drawn in the
 *    blocking modal. Answering one is theirs to do, the same rule the
 *    walkthrough card has always kept ("click Delete, then Yes" would
 *    otherwise confirm its own dialog) and the reason `handle_dialog` is
 *    withheld from the model. It needs no language at all, which is what
 *    stands behind a translated label the dictionary uses for an allowed
 *    control too (see `genDestructiveLabelRule`): the app confirms the
 *    destructive reading, and nothing here confirms for anybody.
 *  - `destructive`: the element is CALLED something that cannot be undone.
 *    Its title and aria-label are read always; its own text only when it is a
 *    control, because a slide card or a list row carries content -- a hymn
 *    that says "erase my sin" -- and content must not make itself unpressable.
 *    That is the same line the uid interlock draws with its role filter.
 *
 * Shipped into the page: self-contained apart from
 * `checkIsDestructiveLabelText`.
 */
export function findPressRefusal(element, rule) {
    if (element === null || typeof element !== 'object' ||
        typeof element.closest !== 'function') {
        return null;
    }
    const questionSelector = '#app-confirm-popup, #app-alert-popup, ' +
        '#app-input-popup, .modal-container--blocking';
    if (element.closest(questionSelector) !== null) {
        return { refused: 'question' };
    }
    // A box and a picker are named by their attributes, never by their text:
    // an input has none, and a <select>'s is every option it holds glued
    // together -- a picker that merely OFFERS "Delete" is not one.
    const controlSelector = 'button, a, summary, option, ' +
        'label, .nav-link, .app-context-menu-item, [role="button"], ' +
        '[role="menuitem"], [role="menuitemcheckbox"], ' +
        '[role="menuitemradio"], [role="tab"], [role="option"], ' +
        '[role="link"], [role="switch"], [role="checkbox"], [role="radio"]';
    const parts = [
        element.getAttribute('title'),
        element.getAttribute('aria-label'),
    ];
    if (element.matches(controlSelector)) {
        parts.push(element.textContent);
    }
    for (const part of parts) {
        // A real control is named in a few words; a part longer than this is
        // content that happens to sit on a control.
        if (typeof part === 'string' && part.length <= 120 &&
            checkIsDestructiveLabelText(part, rule)) {
            return {
                refused: 'destructive',
                label: part.replace(/\s+/g, ' ').trim().slice(0, 80),
            };
        }
    }
    return null;
}

/**
 * Why pressing this keystroke for the user is refused, or null.
 *
 * A key carries no label, so it is judged by the control that NAMES it: this
 * app writes a control's shortcut into its title (`Clear All [F6]`), which
 * makes F6 exactly as destructive as Clear All and F9 exactly as ordinary as
 * Clear Bible -- in whatever language the title is in -- with no list of keys
 * to keep in step with the app. A key whose own name is destructive (`Delete`)
 * is refused on its name.
 *
 * Shipped into the page: self-contained apart from
 * `checkIsDestructiveLabelText`.
 */
export function findKeyRefusal(keys, rule, root) {
    const label = String((keys && keys.label) ?? '').trim();
    if (label === '') {
        return null;
    }
    if (checkIsDestructiveLabelText(label, rule)) {
        return { refused: 'destructive', label };
    }
    if (root === null || typeof root !== 'object' ||
        typeof root.querySelectorAll !== 'function') {
        return null;
    }
    const wanted = '[' + label.toLowerCase() + ']';
    for (const element of root.querySelectorAll('[title], [aria-label]')) {
        for (const name of ['title', 'aria-label']) {
            const part = element.getAttribute(name);
            if (typeof part === 'string' &&
                part.toLowerCase().includes(wanted) &&
                checkIsDestructiveLabelText(part, rule)) {
                return {
                    refused: 'destructive',
                    label: part.replace(/\s+/g, ' ').trim().slice(0, 80),
                };
            }
        }
    }
    return null;
}

/**
 * The guard as a page expression: an object carrying `findPressRefusal` and
 * `findKeyRefusal`, closed over the one helper each shares. What the page gets
 * is this module's own functions as text -- no second copy to drift, and no
 * template-literal escaping, because interpolating a function's source keeps
 * every backslash it was written with (the trap that once turned `\s` into
 * the letter s in a page expression).
 */
export const PRESS_GUARD_SOURCE = `(() => {
    const toComparableLabel = ${toComparableLabel.toString()};
    const checkIsDestructiveLabelText = ${checkIsDestructiveLabelText.toString()};
    const findPressRefusal = ${findPressRefusal.toString()};
    const findKeyRefusal = ${findKeyRefusal.toString()};
    return { checkIsDestructiveLabelText, findPressRefusal, findKeyRefusal };
})()`;

function checkIsEnglishDestructive(text) {
    const comparable = toComparableLabel(text);
    return DESTRUCTIVE_LABEL_PATTERNS.some((pattern) => {
        return pattern.test(comparable);
    });
}

/**
 * The rule, derived from the app's own `tran()` dictionary rather than
 * written by hand: every translation of a key the English patterns call
 * destructive becomes a phrase, so a label added to the app in English is
 * refused in Khmer the day its translation lands, with nothing here to edit.
 *
 * Two things keep it from refusing ordinary work, both read off the same
 * dictionary:
 *
 *  - **A translation the dictionary ALSO uses for an allowed control is not a
 *    phrase at all.** The window cannot tell the two apart, so neither can
 *    this. On the Khmer dictionary (2026-09-14) there are three: `លុប` is both
 *    Delete and Clear, `លុបព្រះគម្ពីរ` both Delete Bible and Clear Bible,
 *    `លុបផ្ទៃខាងក្រោយ` both Remove Background and Clear Background. The
 *    allowed reading wins -- Clear Bible is an ordinary presenting move, the
 *    same call that keeps bare "clear" off the English list -- and what stands
 *    behind the destructive reading is the app's own confirm, which
 *    `findPressRefusal` never lets anyone answer.
 *  - **A phrase found inside any allowed translation is matched whole, never
 *    inside a longer label**: Sign Out's Khmer sits inside the toast that says
 *    SongSelect signed you out, and that sentence must not become unpressable.
 *
 * English is left to the patterns: its words are separated by spaces, and a
 * phrase matched inside a label would catch "delete" in "Undelete".
 */
export function genDestructiveLabelRule(bundle) {
    const containSet = new Set();
    const exactSet = new Set();
    for (const [langCode, dictionary] of Object.entries(
        bundle?.dictionaries ?? {},
    )) {
        if (langCode === 'en' || dictionary === null ||
            typeof dictionary !== 'object') {
            continue;
        }
        const allowedList = [];
        const destructiveList = [];
        for (const [key, value] of Object.entries(dictionary)) {
            if (typeof value !== 'string') {
                continue;
            }
            const comparable = toComparableLabel(value);
            if (comparable === '') {
                continue;
            }
            if (checkIsEnglishDestructive(key)) {
                destructiveList.push(comparable);
            } else {
                allowedList.push(comparable);
            }
        }
        const allowedSet = new Set(allowedList);
        for (const phrase of destructiveList) {
            if (phrase.length > PHRASE_MAX_LENGTH || allowedSet.has(phrase)) {
                continue;
            }
            const isInsideAllowed = allowedList.some((one) => {
                return one.includes(phrase);
            });
            (isInsideAllowed ? exactSet : containSet).add(phrase);
        }
    }
    return {
        patterns: DESTRUCTIVE_LABEL_PATTERNS.map((pattern) => {
            return { source: pattern.source, flags: pattern.flags };
        }),
        containPhrases: [...containSet].sort(),
        exactPhrases: [...exactSet].sort(),
    };
}
