import BibleItem from '../bible-list/BibleItem';
import { reformCustomTitle } from '../helper/bible-helpers/serverBibleHelpers2';
import { useBibleItemsViewControllerContext } from './BibleItemsViewController';

export default function RenderCustomVerseComp({
    customHtml,
    bibleItem,
}: Readonly<{ customHtml: string; bibleItem: BibleItem }>) {
    const bibleItemViewController = useBibleItemsViewControllerContext();
    return (
        <span
            ref={(element) => {
                if (element === null) {
                    return;
                }
                reformCustomTitle(bibleItemViewController, bibleItem, element);
            }}
            dangerouslySetInnerHTML={{
                __html: customHtml,
            }}
        />
    );
}
