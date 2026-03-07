import type { ReactNode } from 'react';

import { useBibleViewFontSizeContext } from '../../helper/bibleViewHelpers';
import { useBibleFontFamily } from '../../helper/bible-helpers/bibleLogicHelpers2';

export default function BibleViewTitleWrapperComp({
    children,
    bibleKey,
}: Readonly<{
    children: ReactNode;
    bibleKey: string;
}>) {
    const fontFamily = useBibleFontFamily(bibleKey);
    const fontSize = useBibleViewFontSizeContext();
    return (
        <span
            className="title full-view-reset-font-size"
            style={{ fontSize, fontFamily }}
        >
            {children}
        </span>
    );
}
