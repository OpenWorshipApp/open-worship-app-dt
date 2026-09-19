/**
 * One `update` subscription on a set of screen managers, shared by every
 * consumer that asks for it and torn down again when the last one leaves.
 *
 * Both on-screen stores in the app (a slide preview's "which screens am I on",
 * a presenting flow row's "is this element live") need the same thing: subscribe once
 * per window rather than once per row — a document expanded to ~90 rows would
 * otherwise register ~90 listener sets for the identical event — and unregister
 * as soon as nothing is mounted, so an idle window holds no screen listeners at
 * all.
 */
export function genRefCountedScreenUpdateSubscriber(
    // A THUNK, not the managers themselves. Every caller lives in the same
    // import cycle as the managers it subscribes to, so touching them while
    // this module is still evaluating throws "Cannot access
    // 'ScreenVaryAppDocumentManager' before initialization" and blanks the
    // window. Resolving them on the first `acquire` — which cannot run before
    // something is mounted — keeps that lazy.
    getHandlerList: () => any[],
    onUpdate: () => void,
) {
    let subscriberCount = 0;
    let unregisterList: (() => void)[] = [];
    const unregisterAll = () => {
        for (const unregister of unregisterList) {
            unregister();
        }
        unregisterList = [];
    };
    /** Subscribes if this is the first consumer; returns its own release. */
    const acquire = () => {
        if (subscriberCount === 0) {
            unregisterList = getHandlerList().map((Handler: any) => {
                const registered = Handler.registerEventListener(
                    ['update'],
                    onUpdate,
                );
                return () => {
                    Handler.unregisterEventListener(registered);
                };
            });
        }
        subscriberCount += 1;
        // Guarded because React may call a `useSyncExternalStore`/effect cleanup
        // more than once (StrictMode double-invokes them), and a double release
        // would drop the count below what is actually mounted — leaving the
        // listeners unregistered while rows are still on screen.
        let isReleased = false;
        return () => {
            if (isReleased) {
                return;
            }
            isReleased = true;
            subscriberCount -= 1;
            if (subscriberCount === 0) {
                unregisterAll();
            }
        };
    };
    /** Test seam: forget every consumer and unsubscribe. */
    const reset = () => {
        subscriberCount = 0;
        unregisterAll();
    };
    return { acquire, reset };
}
