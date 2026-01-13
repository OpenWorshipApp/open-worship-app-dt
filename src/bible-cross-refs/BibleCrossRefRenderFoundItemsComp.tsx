import { tran } from '../lang/langHelpers';
import { useLookupBibleItemControllerContext } from '../bible-reader/LookupBibleItemController';
import {
    openContextMenu,
    openInBibleLookup,
} from '../bible-find/bibleFindHelpers';
import { handleDragStart } from '../helper/dragHelpers';
import { BibleCrossRefType, breakItem } from './bibleCrossRefsHelpers';
import { useBibleKeyContext } from '../helper/ai/bibleCrossRefHelpers';
import { useAppStateAsync } from '../helper/debuggerHelpers';
import { BibleDirectViewTitleComp } from '../bible-reader/view-extra/BibleDirectViewTitleComp';

export default function BibleCrossRefRenderFoundItemsComp({
    bibleVersesKey,
    itemInfo,
}: Readonly<{
    bibleVersesKey: string;
    itemInfo: BibleCrossRefType;
}>) {
    const viewController = useLookupBibleItemControllerContext();
    const bibleKey = useBibleKeyContext();
    const [data] = useAppStateAsync(() => {
        return breakItem(bibleKey, bibleVersesKey);
    }, [bibleKey, bibleVersesKey]);
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
            title={tran('shift + click to append')}
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
