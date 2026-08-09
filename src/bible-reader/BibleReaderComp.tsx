import '../bible-lookup/BibleReaderComp.scss';

import { lazy, useEffect, useMemo } from 'react';

import type {
    DataInputType,
    FlexSizeType,
} from '../resize-actor/flexSizeHelpers';
import ResizeActorComp from '../resize-actor/ResizeActorComp';
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
function genDataInput(): DataInputType[] {
    return [
        {
            children: LazyBibleReadingLeftCom,
            key: 'h1',
            ...toWidgetLabel('Bible and Notes'),
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
}: Readonly<{
    flexSizeName: string;
    onLookupSaveBibleItem?: () => void;
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
        return genDataInput();
    }, []);
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
