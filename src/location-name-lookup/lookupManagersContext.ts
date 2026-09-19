import { createContext, use, useState } from 'react';

import { useAppEffect } from '../helper/appHooks';
import { handleError } from '../helper/errorHelpers';
import { acquireLookupData, releaseLookupData } from './lookupDataHelpers';
import type { LookupManagersType } from './lookupDataHelpers';
import { useSelectedLookupLangCode } from './lookupLangHelpers';

// The detail bodies nest several levels deep (a person row -> a reference list
// -> a referenced record button), and every level needs the managers to resolve
// ids into names. A context keeps that out of every intermediate signature.
export const LookupManagersContext = createContext<LookupManagersType | null>(
    null,
);

export function useLookupManagersContext() {
    const managers = use(LookupManagersContext);
    if (managers === null) {
        throw new Error('LookupManagersContext is not provided');
    }
    return managers;
}

/**
 * The managers for a whole React tree: `undefined` while loading, `null` when
 * the load failed.
 *
 * Every component must take its reference through here rather than calling
 * `getLookupDataCached` itself. The lookup panel and the detail widgets are
 * separate trees with separate lifetimes, and this is what makes them share ONE
 * instance of a ~34MB dataset while either is mounted — and release it as soon
 * as neither is.
 *
 * (The reference counting itself lives in `lookupDataHelpers`, which stays free
 * of React so it can be imported — and tested — outside a renderer.)
 */
export function useLookupManagers() {
    const [managers, setManagers] = useState<
        LookupManagersType | null | undefined
    >(undefined);
    const langCode = useSelectedLookupLangCode();
    useAppEffect(() => {
        let isMounted = true;
        // Back to the loading state first: the resident managers hold the
        // PREVIOUS language's records, and leaving them on screen while the new
        // ones load would show rows the user just asked to stop seeing. A no-op
        // on the first run, where this is already the value.
        setManagers(undefined);
        acquireLookupData()
            .then((data) => {
                if (isMounted) {
                    setManagers(data);
                }
            })
            .catch((error) => {
                handleError(error);
                if (isMounted) {
                    setManagers(null);
                }
            });
        return () => {
            isMounted = false;
            releaseLookupData();
        };
    }, [langCode]);
    return managers;
}
