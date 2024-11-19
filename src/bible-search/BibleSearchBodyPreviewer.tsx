import { lazy } from 'react';

import BibleItem from '../bible-list/BibleItem';
import {
    BibleItemViewControllerContext, SearchBibleItemViewController,
} from '../read-bible/BibleItemViewController';
import BibleView from '../read-bible/BibleView';
import RenderBibleSearchBody from './RenderBibleSearchBody';
import AppSuspense from '../others/AppSuspense';
import { useSplitBibleItemRenderer } from '../read-bible/BiblePreviewerRender';

const BiblePreviewerRender = lazy(() => {
    return import('../read-bible/BiblePreviewerRender');
});

export default function BibleSearchBodyPreviewer({ inputText }: Readonly<{
    inputText: string,
}>) {
    useSplitBibleItemRenderer('s');
    useSplitBibleItemRenderer('v');
    const bibleItemViewController = SearchBibleItemViewController.getInstance();
    bibleItemViewController.finalRenderer = (
        bibleItem: BibleItem,
    ) => {
        const isSelected = bibleItemViewController.checkIsBibleItemSelected(
            bibleItem,
        );
        return (
            isSelected ?
                <RenderBibleSearchBody
                    inputText={inputText}
                /> :
                <BibleView
                    bibleItem={bibleItem}
                />
        );
    };
    return (
        <BibleItemViewControllerContext.Provider
            value={bibleItemViewController}>
            <AppSuspense>
                <BiblePreviewerRender />
            </AppSuspense>
        </BibleItemViewControllerContext.Provider>
    );
}
