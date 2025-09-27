import { BibleDirectViewTitleComp } from '../bible-reader/BibleViewExtra';
import { useLookupBibleItemControllerContext } from '../bible-reader/LookupBibleItemController';
import {
    openContextMenu,
    openInBibleLookup,
} from '../bible-find/bibleFindHelpers';
import { handleDragStart } from '../helper/dragHelpers';
import { useAppPromise } from '../helper/helpers';
import { BibleRefType, breakItem } from './bibleRefsHelpers';

export default function BibleRefRenderFoundItemsComp({
    bibleKey,
    bibleVersesKey,
    itemInfo,
}: Readonly<{
    bibleKey: string;
    bibleVersesKey: string;
    itemInfo: BibleRefType;
}>) {
    const viewController = useLookupBibleItemControllerContext();
    const data = useAppPromise(breakItem(bibleKey, bibleVersesKey));
    if (data === undefined) {
        return <div>Loading...</div>;
    }
    if (data === null) {
        return (
            <div
                className="w-100 app-border-white-round my-2 p-2 app-caught-hover-pointer"
                style={{ color: 'red' }}
            >
                Fail to get data for "{bibleVersesKey}"
            </div>
        );
    }
    const { htmlText, bibleItem, bibleText } = data;
    return (
        <div
            className="w-100 app-border-white-round my-2 p-2 app-caught-hover-pointer"
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
            {/* TODO: update title */}
            <span className="badge badge-success" title="isS">
                {itemInfo.isS ? 'S ' : ''}
            </span>
            <span className="badge badge-success" title="isFN">
                {itemInfo.isFN ? 'FN ' : ''}
            </span>
            <span className="badge badge-success" title="isStar">
                {itemInfo.isStar ? '★ ' : ''}
            </span>
            <span className="badge badge-success" title="isTitle">
                {itemInfo.isTitle ? 'T ' : ''}
            </span>
            <span className="badge badge-success" title="isLXXDSS">
                {itemInfo.isLXXDSS ? 'LXXDSS ' : ''}
            </span>
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
