import type { ReactNode } from 'react';

import type { BibleTargetType } from '../../bible-list/bibleRenderHelpers';
import BibleViewTitleEditorComp from '../BibleViewTitleEditorComp';
import type { ReadIdOnlyBibleItem } from '../ReadIdOnlyBibleItem';
import BibleViewTitleWrapperComp from './BibleViewTitleWrapperComp';

export function BibleViewTitleEditingComp({
    bibleItem,
    onTargetChange,
    children,
}: Readonly<{
    bibleItem: ReadIdOnlyBibleItem;
    onTargetChange: (bibleTarget: BibleTargetType) => void;
    children?: ReactNode;
}>) {
    return (
        <BibleViewTitleWrapperComp bibleKey={bibleItem.bibleKey}>
            <BibleViewTitleEditorComp
                bibleItem={bibleItem}
                onTargetChange={onTargetChange}
            />{' '}
            {children}
        </BibleViewTitleWrapperComp>
    );
}
