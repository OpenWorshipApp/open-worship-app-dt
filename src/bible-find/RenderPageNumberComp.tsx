import { useCallback } from 'react';

import { APP_FOUND_PAGE_CLASS } from './BibleFindRenderPerPageComp';
import { bringDomToTopView } from '../helper/helpers';
import { useAppCurrentRef } from '../helper/appHooks';
import { tran } from '../lang/langHelpers';

export default function RenderPageNumberComp({
    pageNumber,
    isLoaded,
    handleFinding,
}: Readonly<{
    pageNumber: string;
    isLoaded: boolean;
    handleFinding: (page: string) => void;
}>) {
    const isLoadedRef = useAppCurrentRef(isLoaded);
    const pageNumberRef = useAppCurrentRef(pageNumber);
    const handleFindingRef = useAppCurrentRef(handleFinding);
    const handlePageClick = useCallback(() => {
        if (isLoadedRef.current) {
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
        <button
            className={'app-find-page' + (isLoaded ? ' is-loaded' : '')}
            type="button"
            // The two things a number can do are not the same thing, and the
            // strip's only state says which: a loaded chunk is already on
            // screen above, so clicking scrolls to it; any other click fetches.
            title={tran(isLoaded ? 'Go to results' : 'Load more results')}
            onClick={handlePageClick}
        >
            {pageNumber}
        </button>
    );
}
