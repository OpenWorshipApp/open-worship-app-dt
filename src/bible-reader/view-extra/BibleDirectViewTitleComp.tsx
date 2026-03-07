import { useBibleFontFamily } from '../../helper/bible-helpers/bibleLogicHelpers2';
import { useAppStateAsync } from '../../helper/debuggerHelpers';
import type { ReadIdOnlyBibleItem } from '../ReadIdOnlyBibleItem';

export function BibleDirectViewTitleComp({
    bibleItem,
}: Readonly<{ bibleItem: ReadIdOnlyBibleItem }>) {
    const fontFamily = useBibleFontFamily(bibleItem.bibleKey);
    const [title] = useAppStateAsync(() => {
        return bibleItem.toTitle();
    }, [bibleItem.bibleKey, bibleItem.target]);
    return (
        <span
            className="title app-border-white-round m-1 px-1 app-found-highlight"
            style={{ fontFamily }}
        >
            {title}
        </span>
    );
}
