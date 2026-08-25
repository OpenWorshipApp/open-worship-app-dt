import type { ReactNode } from 'react';

import type DirSource from '../helper/DirSource';
import { PathPreviewerComp } from './PathPreviewerComp';

export default function RenderPathTitleComp({
    dirSource,
    extraElements,
}: Readonly<{
    dirSource: DirSource;
    extraElements?: ReactNode;
}>) {
    if (!dirSource.dirPath) {
        return null;
    }
    return (
        <>
            {/* Reload and the adding entries are list context menu items
                (`genDroppingFileOnContextMenu`, reachable from the header ⋮ or
                a right-click on the empty body), not icons — this cramped row
                keeps only the path and the filter/sort affordances. */}
            <PathPreviewerComp dirOrFilePath={dirSource.dirPath} />
            {extraElements}
        </>
    );
}
