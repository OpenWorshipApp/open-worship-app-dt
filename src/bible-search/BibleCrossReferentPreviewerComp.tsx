import { useState } from 'react';
import RefRendererComp from '../bible-refs/RefRendererComp';
import BibleItem from '../bible-list/BibleItem';
import { useAppEffect } from '../helper/debuggerHelpers';
import { bibleRenderHelper } from '../bible-list/bibleRenderHelpers';
import { useLookupBibleItemControllerContext } from '../bible-reader/LookupBibleItemController';

export default function BibleCrossReferentPreviewerComp() {
    const viewController = useLookupBibleItemControllerContext();
    const [bileItem, setBileItem] = useState<BibleItem | null>(null);
    useAppEffect(() => {
        viewController.setBibleVerseKey = (bibleVerseKey: string) => {
            if (!bibleVerseKey) {
                return;
            }
            const extracted =
                bibleRenderHelper.fromBibleVerseKey(bibleVerseKey);
            const newBibleItem = BibleItem.fromJson({
                id: -1,
                bibleKey: extracted.bibleKey,
                target: {
                    bookKey: extracted.bookKey,
                    chapter: extracted.chapter,
                    verseStart: extracted.verseStart,
                    verseEnd: extracted.verseEnd,
                },
                metadata: {},
            });
            setBileItem(newBibleItem);
        };
        viewController.setBibleVerseKey(viewController.bibleVerseKey);
        return () => {
            viewController.setBibleVerseKey = (_: string) => {};
        };
    }, []);
    if (bileItem === null) {
        return (
            <div>
                <h4>Wait...</h4>
                <p>Please select any bible verse.</p>
            </div>
        );
    }
    return <RefRendererComp bibleItem={bileItem} />;
}
