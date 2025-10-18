import { useState } from 'react';
import BibleCrossRefRendererComp from '../bible-cross-refs/BibleCrossRefRendererComp';
import BibleItem from '../bible-list/BibleItem';
import { useAppEffect } from '../helper/debuggerHelpers';
import { bibleRenderHelper } from '../bible-list/bibleRenderHelpers';
import { useLookupBibleItemControllerContext } from '../bible-reader/LookupBibleItemController';

export default function BibleCrossReferencePreviewerComp() {
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
        viewController.setBibleVerseKey(
            viewController.bibleCrossReferenceVerseKey,
        );
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
    return (
        <BibleCrossRefRendererComp
            bibleItem={bileItem}
            setBibleItem={setBileItem}
        />
    );
}
