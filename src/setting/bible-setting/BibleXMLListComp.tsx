import { useCallback, useMemo } from 'react';

import LoadingComp from '../../others/LoadingComp';
import BibleXMLInfoComp from './BibleXMLInfoComp';
import { tran } from '../../lang/langHelpers';
import { bibleDataReader } from '../../helper/bible-helpers/BibleDataReader';
import { useAppCurrentRef } from '../../helper/appHooks';
import { warnIfAnyBibleEditorDirty } from './bibleEditorDirtyHelpers';
import { BIBLE_KJV_KEY } from '../../helper/bible-helpers/bibleModelHelpers';

export default function BibleXMLListComp({
    isPending,
    bibleKeysMap,
    loadBibleKeys,
}: Readonly<{
    isPending: boolean;
    bibleKeysMap: { [key: string]: string } | null;
    loadBibleKeys: () => void;
}>) {
    const bibleKeys = useMemo(() => {
        if (bibleKeysMap === null) {
            return [];
        }
        const localBibleKeys = Object.keys(bibleKeysMap).sort((a, b) =>
            a.localeCompare(b),
        );
        return localBibleKeys;
    }, [bibleKeysMap]);
    const loadBibleKeysRef = useAppCurrentRef(loadBibleKeys);
    const handleRefresh = useCallback(() => {
        // Refreshing unmounts every editor, which would silently discard any
        // unsaved changes.
        if (
            warnIfAnyBibleEditorDirty(
                'Save or discard unsaved Bible changes before refreshing.',
            )
        ) {
            return;
        }
        loadBibleKeysRef.current();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    if (isPending) {
        return <LoadingComp />;
    }
    // ONE element for both call sites: the empty state and a populated list
    // that has lost its KJV offer the very same action, and a second copy of
    // the label would be free to drift from this one.
    const createKJVBibleButton = (
        <button
            className="btn btn-success"
            onClick={async () => {
                await bibleDataReader.initKJVBible();
                handleRefresh();
            }}
        >
            <i className="bi bi-plus-lg" /> {tran('Create KJV Bible XML')}
        </button>
    );
    const buttons = (
        <>
            <button
                title={tran('Refresh')}
                className="btn btn-info"
                onClick={handleRefresh}
            >
                <i className="bi bi-arrow-clockwise" /> {tran('Refresh')}
            </button>
            <a
                className="btn btn-secondary ms-2"
                href={'https://www.google.com/search?q=holy+bible+xml+format'}
                target="_blank"
            >
                <i className="bi bi-google" />{' '}
                <i className="bi bi-filetype-xml" /> {tran('Search XML')}
            </a>
        </>
    );
    if (bibleKeysMap === null || Object.keys(bibleKeysMap ?? []).length === 0) {
        return (
            <div>
                {tran('No Bible XML files')} {buttons}
                <hr />
                <div className="d-flex align-items-center ms-2">
                    <div className="hand-pointing-right">👉</div>
                    {createKJVBibleButton}
                </div>
            </div>
        );
    }
    return (
        <>
            <h3>
                {tran('Bibles XML')} {buttons}
            </h3>
            <div className="w-100">
                <ul className="list-group d-flex flex-fill">
                    {/* The KJV is the one bible the app can rebuild from
                        itself, so a list that has lost it keeps the offer at
                        the head of the list — not only on the first run, when
                        the list is empty and the offer is all there is. */}
                    {bibleKeys.includes(BIBLE_KJV_KEY) ? null : (
                        <li className="list-group-item p-1">
                            {createKJVBibleButton}
                        </li>
                    )}
                    {bibleKeys.map((bibleKey) => {
                        return (
                            <BibleXMLInfoComp
                                key={bibleKey}
                                bibleKey={bibleKey}
                                loadBibleKeys={loadBibleKeys}
                                filePath={bibleKeysMap[bibleKey]}
                            />
                        );
                    })}
                </ul>
            </div>
        </>
    );
}
