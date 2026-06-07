import { useCallback } from 'react';

import { showBibleKeyOption } from '../bible-lookup/BibleKeySelectionComp';
import { ReadIdOnlyBibleItem } from './ReadIdOnlyBibleItem';

export default function ButtonAddMoreBibleComp({
    bibleItems,
    applyPresents,
}: Readonly<{
    bibleItems: ReadIdOnlyBibleItem[];
    applyPresents: (bibleItem: ReadIdOnlyBibleItem[]) => void;
}>) {
    const handleClick = useCallback(
        (event: any) => {
            showBibleKeyOption(event, (bibleKey: string) => {
                const newBibleItem = ReadIdOnlyBibleItem.fromJson(
                    bibleItems[0].toJson(),
                );
                newBibleItem.bibleKey = bibleKey;
                const newBibleItems = [...bibleItems, newBibleItem];
                applyPresents(newBibleItems);
            });
        },
        [bibleItems, applyPresents],
    );
    return (
        <button
            className="btn btn-info btn-sm"
            disabled={bibleItems.length === 0}
            onClick={handleClick}
        >
            <i className="bi bi-plus" /> Add Item
        </button>
    );
}
