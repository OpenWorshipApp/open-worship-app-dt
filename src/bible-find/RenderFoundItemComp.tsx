import { useLookupBibleItemControllerContext } from '../bible-reader/LookupBibleItemController';
import { BibleDirectViewTitleComp } from '../bible-reader/view-extra/BibleDirectViewTitleComp';
import { useBibleFontFamily } from '../helper/bible-helpers/bibleLogicHelpers2';
import { useAppStateAsync } from '../helper/debuggerHelpers';
import { handleDragStart } from '../helper/dragHelpers';
import { tran } from '../lang/langHelpers';
import { useBibleFindController } from './BibleFindController';
import {
    breakItem,
    openContextMenu,
    openInBibleLookup,
} from './bibleFindHelpers';

export default function RenderFoundItemComp({
    findText,
    text,
    bibleKey,
}: Readonly<{
    findText: string;
    text: string;
    bibleKey: string;
}>) {
    const fontFamily = useBibleFontFamily(bibleKey);
    const viewController = useLookupBibleItemControllerContext();
    const bibleFindController = useBibleFindController();
    const [data] = useAppStateAsync(() => {
        return breakItem(bibleFindController.locale, findText, text, bibleKey);
    }, [bibleFindController.locale, findText, text, bibleKey]);
    if (data === undefined) {
        return <div>{tran('Loading')}...</div>;
    }
    if (data === null) {
        return <div>{tran('Fail to get data')}</div>;
    }
    const { newItem, bibleItem } = data;
    return (
        <div
            className="w-100 app-border-white-round my-2 p-2 app-caught-hover-pointer"
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
                openInBibleLookup(event, viewController, bibleItem);
            }}
        >
            <BibleDirectViewTitleComp bibleItem={bibleItem} />
            <span
                style={{ fontFamily }}
                dangerouslySetInnerHTML={{
                    __html: newItem,
                }}
            />
        </div>
    );
}
