import { lazy, useMemo } from 'react';

import { DataInputType, FlexSizeType } from './resize-actor/flexSizeHelpers';
import ResizeActorComp from './resize-actor/ResizeActorComp';
import LookupBibleItemController from './bible-reader/LookupBibleItemController';
import { BibleItemsViewControllerContext } from './bible-reader/BibleItemsViewController';

const LazyBibleListComp = lazy(() => {
    return import('./bible-list/BibleListComp');
});
const LazyRenderBibleLookupComp = lazy(() => {
    return import('./bible-lookup/RenderBibleLookupComp');
});

const flexSizeDefault: FlexSizeType = {
    h1: ['1'],
    h2: ['4'],
};
const dataInput: DataInputType[] = [
    {
        children: LazyBibleListComp,
        key: 'h1',
        widgetName: 'Bibles',
    },
    {
        children: LazyRenderBibleLookupComp,
        key: 'h2',
        widgetName: 'Bible Lookup',
    },
];
export default function BibleReaderComp({
    flexSizeName,
    onLookupSaveBibleItem,
}: Readonly<{
    flexSizeName: string;
    onLookupSaveBibleItem?: () => void;
}>) {
    const targetViewController = useMemo(() => {
        const newViewController = new LookupBibleItemController();
        if (onLookupSaveBibleItem !== undefined) {
            newViewController.onLookupSaveBibleItem = onLookupSaveBibleItem;
        }
        return newViewController;
    }, [onLookupSaveBibleItem]);
    return (
        <BibleItemsViewControllerContext value={targetViewController}>
            <ResizeActorComp
                flexSizeName={flexSizeName}
                isHorizontal
                flexSizeDefault={flexSizeDefault}
                dataInput={dataInput}
            />
        </BibleItemsViewControllerContext>
    );
}
