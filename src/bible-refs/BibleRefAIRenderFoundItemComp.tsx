import { BibleDirectViewTitleComp } from '../bible-reader/BibleViewExtra';
import { useLookupBibleItemControllerContext } from '../bible-reader/LookupBibleItemController';
import {
    openContextMenu,
    openInBibleLookup,
} from '../bible-search/bibleFindHelpers';
import { handleDragStart } from '../helper/dragHelpers';
import { useAppPromise } from '../helper/helpers';
import { breakItem } from './bibleRefsHelpers';

export default function BibleRefAIRenderFoundItemComp({
    bibleKey,
    bibleVersesKey,
}: Readonly<{
    bibleKey: string;
    bibleVersesKey: string;
}>) {
    const viewController = useLookupBibleItemControllerContext();
    const data = useAppPromise(breakItem(bibleKey, bibleVersesKey));
    if (data === undefined) {
        return <div>Loading...</div>;
    }
    if (data === null) {
        return (
            <div
                className="w-100 app-border-white-round my-1 p-1 app-caught-hover-pointer"
                style={{ color: 'red' }}
            >
                Fail to get data for "{bibleVersesKey}"
            </div>
        );
    }
    const { htmlText, bibleItem, bibleText } = data;
    return (
        <div
            className="w-100 app-border-white-round my-1 p-1 app-caught-hover-pointer"
            title="`shift + click to append"
            draggable
            onDragStart={(event) => {
                handleDragStart(event, bibleItem);
            }}
            onContextMenu={(event) => {
                openContextMenu(event, {
                    viewController,
                    bibleItem,
                });
            }}
            onClick={(event) => {
                openInBibleLookup(event, viewController, bibleItem, true);
            }}
        >
            <BibleDirectViewTitleComp bibleItem={bibleItem} />
            <span
                title={bibleText}
                data-bible-key={bibleItem.bibleKey}
                dangerouslySetInnerHTML={{
                    __html: htmlText,
                }}
            />
        </div>
    );
}
