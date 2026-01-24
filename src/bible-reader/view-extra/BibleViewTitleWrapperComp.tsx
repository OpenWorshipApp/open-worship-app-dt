import type { ReactNode } from 'react';

import { useBibleViewFontSizeContext } from '../../helper/bibleViewHelpers';

export default function BibleViewTitleWrapperComp({
    children,
    bibleKey,
}: Readonly<{
    children: ReactNode;
    bibleKey: string;
}>) {
    const fontSize = useBibleViewFontSizeContext();
    return (
        <span
            className="title full-view-reset-font-size"
            data-bible-key={bibleKey}
            style={{ fontSize }}
        >
            {children}
        </span>
    );
}
