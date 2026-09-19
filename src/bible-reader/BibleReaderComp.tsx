import '../bible-lookup/BibleReaderComp.scss';

import { lazy, useEffect, useMemo } from 'react';

import type {
    DataInputType,
    FlexSizeType,
} from '../resize-actor/flexSizeHelpers';
import ResizeActorComp from '../resize-actor/ResizeActorComp';
import AppSuspenseComp from '../others/AppSuspenseComp';
import { toWidgetLabel } from '../others/labelIconHelpers';
import LookupBibleItemController, {
    registerLookupBibleItemController,
} from './LookupBibleItemController';
import { BibleItemsViewControllerContext } from './BibleItemsViewController';

const LazyBibleReadingLeftCom = lazy(() => {
    return import('../bible-list/BibleReadingLeftComp');
});
const LazyRenderBibleLookupComp = lazy(() => {
    return import('../bible-lookup/RenderBibleLookupComp');
});

const flexSizeDefault: FlexSizeType = {
    h1: ['1'],
    h2: ['4'],
};
// Built per render, not once at module scope: `tran()` throws in dev when the
// locale's language data has not been loaded into the cache yet, and module
// evaluation happens well before that — which blanks the whole page in km.
//
// `bibleAndNotesLabel` is a parameter because the bible-lookup POPUP overlays
// the presenter, whose right panel already owns a "Bible and Notes" widget:
// two panes sharing that View-menu label on one page trips the widget
// registry's uniqueness guard, so the popup passes a distinct label. The three
// `readingLeft*` parameters carry the same fix one level down — the panes INSIDE
// `BibleReadingLeftComp` collide the same way, which the guard also catches.
//
// That inner component therefore has to take props, which is why it is rendered
// through `render()` rather than handed over as a bare component: `dataInput`
// children are mounted as `<Children />` with no props at all.
function genDataInput(
    bibleAndNotesLabel: string,
    readingLeftFlexSizeName: string | undefined,
    readingLeftBiblesLabel: string | undefined,
    readingLeftBibleNotesLabel: string | undefined,
): DataInputType[] {
    return [
        {
            children: {
                render: () => {
                    return (
                        <AppSuspenseComp>
                            <LazyBibleReadingLeftCom
                                flexSizeName={readingLeftFlexSizeName}
                                biblesLabel={readingLeftBiblesLabel}
                                bibleNotesLabel={readingLeftBibleNotesLabel}
                            />
                        </AppSuspenseComp>
                    );
                },
            },
            key: 'h1',
            ...toWidgetLabel(bibleAndNotesLabel),
        },
        {
            children: LazyRenderBibleLookupComp,
            key: 'h2',
            ...toWidgetLabel('Bible Lookup'),
        },
    ];
}
export default function BibleReaderComp({
    flexSizeName,
    onLookupSaveBibleItem,
    bibleAndNotesLabel = 'Bible and Notes',
    readingLeftFlexSizeName,
    readingLeftBiblesLabel,
    readingLeftBibleNotesLabel,
}: Readonly<{
    flexSizeName: string;
    onLookupSaveBibleItem?: () => void;
    bibleAndNotesLabel?: string;
    // Left undefined by every caller but the lookup popup, which is the only one
    // that can end up beside another `BibleReadingLeftComp`; the component's own
    // defaults then apply.
    readingLeftFlexSizeName?: string;
    readingLeftBiblesLabel?: string;
    readingLeftBibleNotesLabel?: string;
}>) {
    const lookupBibleItemController = useMemo(() => {
        const newLookupBibleItemController = new LookupBibleItemController();
        if (onLookupSaveBibleItem !== undefined) {
            newLookupBibleItemController.onLookupSaveBibleItem =
                onLookupSaveBibleItem;
        }
        return newLookupBibleItemController;
    }, [onLookupSaveBibleItem]);
    const dataInput = useMemo(() => {
        return genDataInput(
            bibleAndNotesLabel,
            readingLeftFlexSizeName,
            readingLeftBiblesLabel,
            readingLeftBibleNotesLabel,
        );
    }, [
        bibleAndNotesLabel,
        readingLeftFlexSizeName,
        readingLeftBiblesLabel,
        readingLeftBibleNotesLabel,
    ]);
    // Published for the window-level names & locations detail panels, which sit
    // outside this provider but still need a controller to open a verse in the
    // bible lookup.
    useEffect(() => {
        return registerLookupBibleItemController(lookupBibleItemController);
    }, [lookupBibleItemController]);
    return (
        <BibleItemsViewControllerContext value={lookupBibleItemController}>
            <ResizeActorComp
                flexSizeName={flexSizeName}
                isHorizontal
                flexSizeDefault={flexSizeDefault}
                dataInput={dataInput}
            />
        </BibleItemsViewControllerContext>
    );
}
