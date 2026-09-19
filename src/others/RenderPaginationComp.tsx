import { useRef, useState } from 'react';

import { useAppEffect } from '../helper/appHooks';
import { tran } from '../lang/langHelpers';

export default function RenderPaginationComp({
    safePage,
    totalPages,
    totalRecords,
    setPage,
}: Readonly<{
    safePage: number;
    totalPages: number;
    totalRecords: number;
    setPage: (page: number) => void;
}>) {
    const [pageInput, setPageInput] = useState(`${safePage}`);
    const totalPagesDigitCount = `${totalPages}`.length;
    // Set when Enter/Escape already handled the value, so the programmatic blur
    // they trigger does not commit the draft a second time.
    const shouldSkipBlurCommitRef = useRef(false);
    // Mirror the committed page back into the editable field (arrows, clamping).
    useAppEffect(() => {
        setPageInput(`${safePage}`);
    }, [safePage]);
    const commitPageInput = () => {
        const parsed = Number.parseInt(pageInput, 10);
        if (Number.isNaN(parsed)) {
            setPageInput(`${safePage}`);
            return;
        }
        setPage(Math.min(totalPages, Math.max(1, parsed)));
    };
    return (
        <div
            className={
                'd-flex align-items-center justify-content-between gap-2' +
                ' p-0 px-1 border-top'
            }
        >
            <button
                className="btn btn-sm btn-outline-secondary"
                type="button"
                title={tran('Previous')}
                aria-label={tran('Previous')}
                disabled={safePage <= 1}
                onClick={() => {
                    setPage(Math.max(1, safePage - 1));
                }}
            >
                <i className="bi bi-chevron-left" />
            </button>
            <span
                className={
                    'small text-secondary text-nowrap d-inline-flex' +
                    ' align-items-center gap-1'
                }
            >
                <input
                    className="form-control form-control-sm text-center"
                    type="text"
                    inputMode="numeric"
                    aria-label={tran('Jump to page')}
                    title={tran('Type a page number and press Enter')}
                    value={pageInput}
                    style={{ width: `${totalPagesDigitCount + 3}ch` }}
                    onChange={(event) => {
                        setPageInput(event.target.value.replace(/\D/g, ''));
                    }}
                    onFocus={(event) => {
                        event.target.select();
                    }}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                            event.preventDefault();
                            shouldSkipBlurCommitRef.current = true;
                            commitPageInput();
                            event.currentTarget.blur();
                        } else if (event.key === 'Escape') {
                            shouldSkipBlurCommitRef.current = true;
                            setPageInput(`${safePage}`);
                            event.currentTarget.blur();
                        }
                    }}
                    onBlur={() => {
                        if (shouldSkipBlurCommitRef.current) {
                            shouldSkipBlurCommitRef.current = false;
                            return;
                        }
                        commitPageInput();
                    }}
                />
                {`/ ${totalPages} · ${totalRecords}`}
            </span>
            <button
                className="btn btn-sm btn-outline-secondary"
                type="button"
                title={tran('Next')}
                aria-label={tran('Next')}
                disabled={safePage >= totalPages}
                onClick={() => {
                    setPage(Math.min(totalPages, safePage + 1));
                }}
            >
                <i className="bi bi-chevron-right" />
            </button>
        </div>
    );
}
