import { useAppStateAsync } from '../../helper/debuggerHelpers';
import { ReadIdOnlyBibleItem } from '../ReadIdOnlyBibleItem';

export function BibleDirectViewTitleComp({
    bibleItem,
}: Readonly<{ bibleItem: ReadIdOnlyBibleItem }>) {
    const [title] = useAppStateAsync(() => {
        return bibleItem.toTitle();
    }, [bibleItem.bibleKey, bibleItem.target]);
    return (
        <span
            data-bible-key={bibleItem.bibleKey}
            className="title app-border-white-round m-1 px-1 app-found-highlight"
        >
            {title}
        </span>
    );
}
