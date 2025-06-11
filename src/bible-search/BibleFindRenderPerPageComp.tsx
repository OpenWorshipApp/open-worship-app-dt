import { BibleDirectViewTitleComp } from '../bible-reader/BibleViewExtra';
import { useLookupBibleItemControllerContext } from '../bible-reader/LookupBibleItemController';
import { handleDragStart } from '../helper/dragHelpers';
import { useAppPromise } from '../helper/helpers';
import { useBibleFindController } from './BibleFindController';
import { breakItem, handleClicking } from './bibleFindHelpers';

export const APP_FOUND_PAGE_CLASS = 'app-found-page';

function RenderFoundItemComp({
    findText,
    text,
    bibleKey,
}: Readonly<{
    findText: string;
    text: string;
    bibleKey: string;
}>) {
    const viewController = useLookupBibleItemControllerContext();
    const bibleFindController = useBibleFindController();
    const data = useAppPromise(
        breakItem(bibleFindController.locale, findText, text, bibleKey),
    );
    if (data === undefined) {
        return <div>Loading...</div>;
    }
    if (data === null) {
        return <div>Fail to get data</div>;
    }
    const { newItem, bibleItem } = data;
    return (
        <div
            className="w-100 app-border-white-round my-2 p-2 app-caught-hover-pointer"
            draggable
            onDragStart={(event) => {
                handleDragStart(event, bibleItem);
            }}
            title="shift + click to append"
            onClick={(event) => {
                handleClicking(event, viewController, bibleItem);
            }}
        >
            <BibleDirectViewTitleComp bibleItem={bibleItem} />
            <span
                data-bible-key={bibleItem.bibleKey}
                dangerouslySetInnerHTML={{
                    __html: newItem,
                }}
            />
        </div>
    );
}

export default function BibleFindRenderPerPageComp({
    pageNumber,
    items,
    findText,
    bibleKey,
}: Readonly<{
    pageNumber: string;
    items: {
        text: string;
        uniqueKey: string;
    }[];
    findText: string;
    bibleKey: string;
}>) {
    return (
        <>
            <div className={`d-flex ${APP_FOUND_PAGE_CLASS}-${pageNumber}`}>
                <span>{pageNumber}</span>
                <hr className="w-100" />
            </div>
            <div className="w-100">
                {items.map(({ text, uniqueKey }) => {
                    return (
                        <RenderFoundItemComp
                            key={uniqueKey}
                            findText={findText}
                            text={text}
                            bibleKey={bibleKey}
                        />
                    );
                })}
            </div>
        </>
    );
}
