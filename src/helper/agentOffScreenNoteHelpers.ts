/**
 * What the assistant is told when what it put up is held by a screen that is
 * OFF (EC-586). The note had said "offer that, do not press it unasked", and
 * the free service's model read it as a ban: 5 of 24 such answers told the
 * person it could not or would not press the show button -- "I can't press
 * its show button for you; you'd need to turn screen 0 on yourself" -- while
 * the options under the same answer offered to. It can, on a yes.
 *
 * Said in plain words since 2026-11-14 (EC-620): "is OFF … its show button"
 * came back as the English "(OFF)" after the Arabic, Hindi and Thai words for
 * "turned off" in 4 of 24 answers on Auto, and as "show button" in an
 * English one on the free service. The control's label stays in the call.
 */
export function genOffScreenNote(offIds: number[], what: string) {
    return (
        `Screen ${offIds.join(' and ')} holds ${what} but is turned off, ` +
        'so the projector shows nothing until that screen is turned on. ' +
        'Offer to turn it on for them -- you can: on a yes, owa_click the ' +
        'label owa_list_screens gives under controls.showHide. Never turn ' +
        'it on unasked, and never tell them you cannot.'
    );
}
