import { useCallback } from 'react';

import { APP_FOUND_PAGE_CLASS } from './BibleFindRenderPerPageComp';
import { bringDomToTopView } from '../helper/helpers';
import { useAppCurrentRef } from '../helper/appHooks';

export default function RenderPageNumberComp({
    pageNumber,
    isActive,
    handleFinding,
}: Readonly<{
    pageNumber: string;
    isActive: boolean;
    handleFinding: (page: string) => void;
}>) {
    const isActiveRef = useAppCurrentRef(isActive);
    const pageNumberRef = useAppCurrentRef(pageNumber);
    const handleFindingRef = useAppCurrentRef(handleFinding);
    const handlePageClick = useCallback(() => {
        if (isActiveRef.current) {
            const dom = document.querySelector(
                `.${APP_FOUND_PAGE_CLASS}-${pageNumberRef.current}`,
            );
            if (dom !== null) {
                bringDomToTopView(dom);
            }
            return;
        }
        handleFindingRef.current(pageNumberRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <li
            key={pageNumber}
            className={`page-item ${isActive ? 'active' : ''}`}
        >
            <button
                className="page-link"
                style={{
                    border: isActive ? '1px solid var(--bs-info)' : undefined,
                }}
                onClick={handlePageClick}
            >
                {pageNumber}
            </button>
        </li>
    );
}
