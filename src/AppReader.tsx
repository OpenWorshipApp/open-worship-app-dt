import { lazy } from 'react';

import {
    DataInputType,
    FlexSizeType,
    resizeSettingNames,
} from './resize-actor/flexSizeHelpers';
import ResizeActor from './resize-actor/ResizeActor';
import BibleItemViewController, {
    BibleItemViewControllerContext,
} from './bible-reader/BibleItemViewController';

const LazyBibleList = lazy(() => {
    return import('./bible-list/BibleList');
});
const LazyRenderBibleSearch = lazy(() => {
    return import('./bible-search/RenderBibleSearch');
});

const flexSizeDefault: FlexSizeType = {
    h1: ['1'],
    h2: ['4'],
};
const dataInput: DataInputType[] = [
    {
        children: LazyBibleList,
        key: 'h1',
        widgetName: 'Bible List',
    },
    {
        children: LazyRenderBibleSearch,
        key: 'h2',
        widgetName: 'Bible Previewer',
    },
];
const viewController = new BibleItemViewController('reader');
export default function AppReader() {
    return (
        <BibleItemViewControllerContext value={viewController}>
            <ResizeActor
                flexSizeName={resizeSettingNames.read}
                isHorizontal
                flexSizeDefault={flexSizeDefault}
                dataInput={dataInput}
            />
        </BibleItemViewControllerContext>
    );
}
