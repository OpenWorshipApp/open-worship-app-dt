import { BibleDirectViewTitleComp } from '../bible-reader/BibleViewExtra';
import { useLookupBibleItemControllerContext } from '../bible-reader/LookupBibleItemController';
import { handleDragStart } from '../helper/dragHelpers';
import { useAppPromise } from '../helper/helpers';
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
                data-bible-key={bibleItem.bibleKey}
                dangerouslySetInnerHTML={{
                    __html: newItem,
                }}
            />
        </div>
    );
}
