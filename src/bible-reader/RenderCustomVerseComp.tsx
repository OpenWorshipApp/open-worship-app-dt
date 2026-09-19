import type BibleItem from '../bible-list/BibleItem';
import { reformCustomTitle } from '../helper/bible-helpers/bibleLogicHelpers3';
import { sanitizeHtml } from '../helper/sanitizeHelpers';
import { useBibleItemsViewControllerContext } from './BibleItemsViewController';

export default function RenderCustomVerseComp({
    customHtml,
    bibleItem,
    decorateElement,
}: Readonly<{
    customHtml: string;
    bibleItem: BibleItem;
    // Runs after the injected HTML is in the DOM, for callers that need to
    // post-process its text (see `RenderCustomVerseLookupComp`). Kept as a
    // callback so this component never has to know about the lookup index.
    decorateElement?: (element: HTMLSpanElement) => void;
}>) {
    const bibleItemViewController = useBibleItemsViewControllerContext();
    return (
        <span
            ref={(element) => {
                if (element === null) {
                    return;
                }
                reformCustomTitle(bibleItemViewController, bibleItem, element);
                decorateElement?.(element);
            }}
            dangerouslySetInnerHTML={{
                __html: sanitizeHtml(customHtml),
            }}
        />
    );
}
