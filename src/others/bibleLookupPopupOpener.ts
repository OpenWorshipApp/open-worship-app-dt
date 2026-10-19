/**
 * The Bible Lookup popup's opener, for a caller with no React context.
 *
 * The Presenter and the slide editor keep the lookup in a popup whose state
 * lives in `AppLayoutComp`; the assistant's **Open … in Bible Lookup**
 * (`agentBibleFindHelpers.ts`) runs from a relay, outside every provider, and
 * the popup has to come up on the verse it set. The header's Bible Lookup
 * button publishes its own press here while it is mounted -- the same shape
 * as `registerLookupBibleItemController` -- so there is exactly one way the
 * popup opens. A leaf with no imports, so the worker does not pull the
 * header's buttons into its import.
 */
let bibleLookupPopupOpener: (() => void) | null = null;

export function registerBibleLookupPopupOpener(open: () => void) {
    bibleLookupPopupOpener = open;
    return () => {
        if (bibleLookupPopupOpener === open) {
            bibleLookupPopupOpener = null;
        }
    };
}

export function getBibleLookupPopupOpener() {
    return bibleLookupPopupOpener;
}
