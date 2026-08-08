import { useState } from 'react';

import { useAppStateAsync } from '../helper/appHooks';
import { useFileSourceEvents } from '../helper/dirSourceHelpers';
import PresentingFlow from './PresentingFlow';

/**
 * Read a presenting flow's items and re-read them whenever the file changes.
 *
 * Lives in its own module rather than in `presentingFlowHelpers`: that one is
 * imported by `PresentingFlowItem`, so pulling `PresentingFlow` into it would close a
 * runtime cycle (`presentingFlowHelpers` → `PresentingFlow` → `PresentingFlowItem` →
 * `presentingFlowHelpers`) of exactly the shape that has already bitten this codebase
 * once with `class extends undefined`.
 */
export function usePresentingFlowItems(filePath: string) {
    const [reloadCount, setReloadCount] = useState(0);
    const [presentingFlowItems] = useAppStateAsync(() => {
        return PresentingFlow.getInstance(filePath).getItems();
    }, [filePath, reloadCount]);
    useFileSourceEvents(
        ['update'],
        () => {
            setReloadCount((prev) => {
                return prev + 1;
            });
        },
        [],
        filePath,
    );
    return presentingFlowItems;
}
