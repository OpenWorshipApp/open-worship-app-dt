import { useCallback, useMemo, useRef, useState } from 'react';

import { tran } from '../lang/langHelpers';
import { useAppCurrentRef, useAppEffect } from '../helper/appHooks';
import {
    getWidgetEntries,
    subscribeWidgetsChanged,
    toggleWidget,
    toWidgetId,
    type WidgetEntryType,
} from '../resize-actor/widgetRegistry';

/**
 * Collapses every side pane of the bible lookup (the Bible and Notes sidebar
 * and the Advance Lookup panel) so the passage itself takes the window, and
 * brings back exactly the panes it closed on the next press.
 */
export default function PreviewFullSizeButtonComp({
    flexSizeName,
    sideWidgetKeys,
}: Readonly<{
    flexSizeName: string;
    sideWidgetKeys: string[];
}>) {
    const sideWidgetIds = useMemo(() => {
        return sideWidgetKeys.map((key) => {
            return toWidgetId(flexSizeName, key);
        });
    }, [flexSizeName, sideWidgetKeys]);
    // Only the panes THIS button collapsed are reopened by it, so a panel the
    // operator had already closed on purpose stays closed.
    const hiddenByButtonRef = useRef<string[]>([]);
    // Closing two panes in one press fires a widget-changed notification per
    // pane. Reconciling in the middle of that loop would drop the second pane
    // from `hiddenByButtonRef` -- its sibling had not been collapsed yet when
    // the first notification was read.
    const isTogglingRef = useRef(false);
    const [isFullSize, setIsFullSize] = useState(false);
    const sideWidgetIdsRef = useAppCurrentRef(sideWidgetIds);
    const isFullSizeRef = useAppCurrentRef(isFullSize);

    const getSideEntries = useCallback(() => {
        const entries = getWidgetEntries();
        return sideWidgetIdsRef.current
            .map((id) => {
                return entries.find(({ id: entryId }) => {
                    return entryId === id;
                });
            })
            .filter((entry): entry is WidgetEntryType => {
                return entry !== undefined;
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const settleFullSizeState = useCallback((entries: WidgetEntryType[]) => {
        if (entries.length === 0) {
            // The panes register from their own effects, a frame after
            // this header first renders.
            return;
        }
        if (isTogglingRef.current) {
            return;
        }
        const hiddenIds = new Set(
            entries
                .filter(({ isHidden }) => {
                    return isHidden;
                })
                .map(({ id }) => {
                    return id;
                }),
        );
        hiddenByButtonRef.current = hiddenByButtonRef.current.filter((id) => {
            return hiddenIds.has(id);
        });
        setIsFullSize(
            entries.every(({ isHidden }) => {
                return isHidden;
            }),
        );
    }, []);

    useAppEffect(() => {
        const update = () => {
            settleFullSizeState(getSideEntries());
        };
        update();
        return subscribeWidgetsChanged(update);
    }, []);

    const handleToggle = useCallback(() => {
        const entries = getSideEntries();
        if (entries.length === 0) {
            return;
        }
        isTogglingRef.current = true;
        try {
            if (isFullSizeRef.current) {
                let idsToOpen = hiddenByButtonRef.current;
                if (idsToOpen.length === 0) {
                    // Full size was reached some other way (the View menu, a
                    // divider dragged shut), so reopen what is actually
                    // hidden.
                    idsToOpen = entries
                        .filter(({ isHidden }) => {
                            return isHidden;
                        })
                        .map(({ id }) => {
                            return id;
                        });
                }
                hiddenByButtonRef.current = [];
                for (const id of idsToOpen) {
                    toggleWidget(id);
                }
                setIsFullSize(false);
                return;
            }
            const idsToClose = entries
                .filter(({ isHidden }) => {
                    return !isHidden;
                })
                .map(({ id }) => {
                    return id;
                });
            hiddenByButtonRef.current = idsToClose;
            for (const id of idsToClose) {
                toggleWidget(id);
            }
            setIsFullSize(true);
        } finally {
            isTogglingRef.current = false;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const label = tran(
        isFullSize ? 'Exit full size preview' : 'Full size preview',
    );
    return (
        <button
            className={'btn btn-sm' + `-${isFullSize ? '' : 'outline-'}info`}
            title={label}
            aria-label={label}
            aria-pressed={isFullSize}
            onClick={handleToggle}
        >
            <i
                className={`bi bi-${
                    isFullSize ? 'fullscreen-exit' : 'arrows-fullscreen'
                }`}
            />
        </button>
    );
}
