import BibleItem from '../bible-list/BibleItem';
import { LookupBibleItemViewController } from '../bible-reader/BibleItemViewController';
import { BibleSearchResultType, breakItem } from './bibleSearchHelpers';

export const APP_FOUND_PAGE_CLASS = 'app-found-page';

export default function BibleSearchRenderPerPageComp({
    pageNumber,
    data,
    searchText,
    bibleKey,
}: Readonly<{
    pageNumber: string;
    data: BibleSearchResultType;
    searchText: string;
    bibleKey: string;
}>) {
    const handleClicking = (event: any, bibleItem: BibleItem) => {
        const viewController = LookupBibleItemViewController.getInstance();
        if (event.shiftKey) {
            viewController.appendBibleItem(bibleItem);
        } else {
            viewController.setLookupContentFromBibleItem(bibleItem);
        }
    };
    return (
        <>
            <div className={`d-flex ${APP_FOUND_PAGE_CLASS}-${pageNumber}`}>
                <span>{pageNumber}</span>
                <hr className="w-100" />
            </div>
            <div className="w-100">
                {data.content.map(({ text, uniqueKey }) => {
                    const { newItem, kjvTitle, bibleItem } = breakItem(
                        searchText,
                        text,
                        bibleKey,
                    );
                    return (
                        <button
                            className={
                                'btn btn-sm btn-outline-info ' +
                                'app-ellipsis w-100 overflow-hidden-x'
                            }
                            onClick={(event) => {
                                handleClicking(event, bibleItem);
                            }}
                            title="Shift + Click to append"
                            style={{ textAlign: 'left' }}
                            key={uniqueKey}
                        >
                            <span>{kjvTitle}</span> ...{' '}
                            <span
                                dangerouslySetInnerHTML={{
                                    __html: newItem,
                                }}
                            />
                        </button>
                    );
                })}
            </div>
        </>
    );
}
