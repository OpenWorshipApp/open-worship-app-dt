import type { ReactNode } from 'react';
import { useMemo, useRef, useState } from 'react';

import { useAppEffect } from '../../helper/appHooks';
import { handleError } from '../../helper/errorHelpers';
import { genTimeoutAttempt } from '../../helper/timeoutHelpers';
import { tran } from '../../lang/langHelpers';
import LoadingComp from '../../others/LoadingComp';
import RenderPaginationComp from '../../others/RenderPaginationComp';
import type { SongSelectSearchPageType } from './songSelectApiHelpers';
import {
    searchSongs,
    toSongSelectErrorMessageKey,
} from './songSelectApiHelpers';
import SongSelectResultItemComp from './SongSelectResultItemComp';

// Longer than the location lookup's 300ms: every keystroke here would hit the
// remote API, which rate-limits at 100 calls per 10 seconds.
const SEARCH_DEBOUNCE_MILLISECOND = 500;

function RenderBodyComp({
    query,
    isLoading,
    errorMessageKey,
    result,
    downloadingSongId,
    onDownload,
    setPage,
}: Readonly<{
    query: string;
    isLoading: boolean;
    errorMessageKey: string | null;
    result: SongSelectSearchPageType | null;
    downloadingSongId: string | null;
    onDownload: (recordId: string) => void;
    setPage: (page: number) => void;
}>) {
    const genCenter = (className: string, children: ReactNode) => {
        return (
            <div
                className={
                    'flex-fill d-flex align-items-center' +
                    ` justify-content-center p-2 text-center ${className}`
                }
            >
                {children}
            </div>
        );
    };
    if (query === '') {
        return genCenter('text-secondary', tran('Type to search'));
    }
    if (isLoading) {
        return <LoadingComp message={tran('Loading')} />;
    }
    if (errorMessageKey !== null) {
        return genCenter('text-danger', tran(errorMessageKey));
    }
    if (result === null || result.totalRecords === 0) {
        return genCenter('text-secondary', tran('No matches'));
    }
    return (
        <>
            <ul
                className={
                    'list-group list-group-flush flex-fill overflow-y-auto'
                }
            >
                {result.records.map((record) => {
                    return (
                        <SongSelectResultItemComp
                            key={record.id}
                            record={record}
                            isDownloading={downloadingSongId === record.id}
                            isDownloadDisabled={downloadingSongId !== null}
                            onDownload={() => {
                                onDownload(record.id);
                            }}
                        />
                    );
                })}
            </ul>
            <RenderPaginationComp
                safePage={result.page}
                totalPages={result.totalPages}
                totalRecords={result.totalRecords}
                setPage={setPage}
            />
        </>
    );
}

export default function SongSelectSearchPanelComp({
    dirPath,
}: Readonly<{
    dirPath: string;
}>) {
    const [typedQuery, setTypedQuery] = useState('');
    const [query, setQuery] = useState('');
    const [page, setPage] = useState(1);
    const [result, setResult] = useState<SongSelectSearchPageType | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [errorMessageKey, setErrorMessageKey] = useState<string | null>(null);
    const [downloadingSongId, setDownloadingSongId] = useState<string | null>(
        null,
    );
    // Increments per fetch so a slow response for an old query or page can
    // never overwrite the newest one.
    const fetchSeqRef = useRef(0);
    // Per instance, per project convention: a module-level timer would
    // collapse several mounted panels into one.
    const attemptTimeout = useMemo(() => {
        return genTimeoutAttempt(SEARCH_DEBOUNCE_MILLISECOND);
    }, []);

    const handleQueryChange = (value: string, isImmediate = false) => {
        setTypedQuery(value);
        attemptTimeout(() => {
            setQuery(value);
            // A new query starts again at the first page.
            setPage(1);
        }, isImmediate);
    };

    useAppEffect(() => {
        if (query === '') {
            fetchSeqRef.current += 1;
            setResult(null);
            setErrorMessageKey(null);
            setIsLoading(false);
            return;
        }
        const fetchSeq = ++fetchSeqRef.current;
        setIsLoading(true);
        setErrorMessageKey(null);
        searchSongs(query, page)
            .then((newResult) => {
                if (fetchSeq !== fetchSeqRef.current) {
                    return;
                }
                setResult(newResult);
                // The API clamps out-of-range pages; mirror it back.
                if (newResult.page !== page) {
                    setPage(newResult.page);
                }
            })
            .catch((error) => {
                if (fetchSeq !== fetchSeqRef.current) {
                    return;
                }
                handleError(error);
                setResult(null);
                setErrorMessageKey(toSongSelectErrorMessageKey(error));
            })
            .finally(() => {
                if (fetchSeq === fetchSeqRef.current) {
                    setIsLoading(false);
                }
            });
    }, [query, page]);

    const handleDownloading = async (recordId: string) => {
        const record = result?.records.find((item) => {
            return item.id === recordId;
        });
        if (!record || downloadingSongId !== null) {
            return;
        }
        setDownloadingSongId(record.id);
        try {
            const { importSongSelectSongToDirectory } =
                await import('./songSelectImportHelpers');
            await importSongSelectSongToDirectory(dirPath, record);
        } finally {
            setDownloadingSongId(null);
        }
    };

    return (
        <div className="d-flex flex-column w-100 h-100">
            <div className="input-group input-group-sm p-2 pb-1">
                <span className="input-group-text">
                    <i className="bi bi-search" />
                </span>
                <input
                    className="form-control"
                    type="text"
                    value={typedQuery}
                    placeholder={`${tran('Search songs')}...`}
                    onChange={(event) => {
                        handleQueryChange(event.target.value);
                    }}
                />
                {typedQuery === '' ? null : (
                    <button
                        className="btn btn-outline-secondary"
                        type="button"
                        title={tran('Clear search')}
                        aria-label={tran('Clear search')}
                        onClick={() => {
                            handleQueryChange('', true);
                        }}
                    >
                        <i className="bi bi-x-lg" />
                    </button>
                )}
            </div>
            <RenderBodyComp
                query={query}
                isLoading={isLoading}
                errorMessageKey={errorMessageKey}
                result={result}
                downloadingSongId={downloadingSongId}
                onDownload={handleDownloading}
                setPage={setPage}
            />
        </div>
    );
}
