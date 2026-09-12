import { useState } from 'react';

import BibleCrossRefRendererComp from '../bible-cross-refs/BibleCrossRefRendererComp';
import BibleItem from '../bible-list/BibleItem';
import { useAppEffect } from '../helper/appHooks';
import { bibleRenderHelper } from '../bible-list/bibleRenderHelpers';
import { useLookupBibleItemControllerContext } from '../bible-reader/LookupBibleItemController';
import { tran } from '../lang/langHelpers';

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
    }, [viewController]);
    if (bileItem === null) {
        // An empty panel is an invitation to act, so it names the one thing
        // that fills it. It used to read "Wait..." -- which describes nothing
        // the app is doing and nothing the user can do about it.
        return (
            <div className="app-xref-placeholder">
                <h4 className="app-xref-placeholder-title">
                    {tran('No verse selected')}
                </h4>
                <p className="app-xref-placeholder-body">
                    {tran(
                        'Choose a verse in the reader to see what else in ' +
                            'scripture speaks to it.',
                    )}
                </p>
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
