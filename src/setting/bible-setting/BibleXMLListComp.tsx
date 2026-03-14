import { useMemo } from 'react';

import LoadingComp from '../../others/LoadingComp';
import BibleXMLInfoComp from './BibleXMLInfoComp';
import { tran } from '../../lang/langHelpers';

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
    if (isPending) {
        return <LoadingComp />;
    }
    const buttons = (
        <>
            <button
                title="Refresh"
                className="btn btn-info"
                onClick={() => {
                    loadBibleKeys();
                }}
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
