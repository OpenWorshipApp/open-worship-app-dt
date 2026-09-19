import { useCallback } from 'react';

import { tran } from '../lang/langHelpers';
import { useLookupVerseFontFamily } from '../location-name-lookup/bibleVerseHelpers';
import { useLookupLangPresentation } from '../location-name-lookup/lookupLangHelpers';
import { useLookupManagers } from '../location-name-lookup/lookupManagersContext';
import LoadingComp from '../others/LoadingComp';
import type { GraphViewType } from './core';
import GraphSurfaceComp from './GraphSurfaceComp';
import { lookupGraphSource } from './lookupGraphSource';

/**
 * The lookup dataset behind a graph panel.
 *
 * Acquisition lives HERE rather than in the panel shell so that a graph over
 * some other source never loads the ~34MB lookup data. `useLookupManagers` is
 * the same reference-counted accessor the detail panels use, so several graphs
 * and several panels share exactly one instance, released when the last of
 * them unmounts.
 */
export default function LookupGraphBodyComp({
    graph,
}: Readonly<{ graph: GraphViewType }>) {
    const managers = useLookupManagers();
    // Records are written in the lookup dataset's own language, which is a
    // separate setting from the interface locale — so their wording and their
    // font both come from here, not from `tran`.
    const { fontFamily, translate } = useLookupLangPresentation();
    // A verse REFERENCE is written by a bible, not by the record language,
    // and those are independent settings — the same split the detail panels
    // make between a record title and a verse title.
    const verseFontFamily = useLookupVerseFontFamily();
    const translateRecordText = useCallback(
        (key: string) => {
            return translate(key);
        },
        [translate],
    );

    if (managers === undefined) {
        return <LoadingComp />;
    }
    if (managers === null) {
        return <div className="p-3">{tran('Failed to load lookup data')}</div>;
    }
    return (
        <GraphSurfaceComp
            graph={graph}
            source={lookupGraphSource}
            context={managers}
            fontFamily={fontFamily}
            verseFontFamily={verseFontFamily}
            translate={translateRecordText}
        />
    );
}
