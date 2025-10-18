import { APP_FOUND_PAGE_CLASS } from './BibleFindRenderPerPageComp';
import { bringDomToTopView } from '../helper/helpers';

export default function RenderPageNumberComp({
    pageNumber,
    isActive,
    handleFinding,
}: Readonly<{
    pageNumber: string;
    isActive: boolean;
    handleFinding: (page: string) => void;
}>) {
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
                onClick={() => {
                    if (isActive) {
                        const dom = document.querySelector(
                            `.${APP_FOUND_PAGE_CLASS}-${pageNumber}`,
                        );
                        if (dom !== null) {
                            bringDomToTopView(dom);
                        }
                        return;
                    }
                    handleFinding(pageNumber);
                }}
            >
                {pageNumber}
            </button>
        </li>
    );
}
