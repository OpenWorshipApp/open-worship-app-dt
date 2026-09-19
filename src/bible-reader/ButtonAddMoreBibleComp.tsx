import { useCallback } from 'react';

import { showBibleKeyOption } from '../bible-lookup/BibleKeySelectionComp';
import { ReadIdOnlyBibleItem } from './ReadIdOnlyBibleItem';
import { useAppCurrentRef } from '../helper/appHooks';

export default function ButtonAddMoreBibleComp({
    bibleItems,
    applyPresents,
}: Readonly<{
    bibleItems: ReadIdOnlyBibleItem[];
    applyPresents: (bibleItem: ReadIdOnlyBibleItem[]) => void;
}>) {
    const bibleItemsRef = useAppCurrentRef(bibleItems);
    const applyPresentsRef = useAppCurrentRef(applyPresents);
    const handleClick = useCallback((event: any) => {
        showBibleKeyOption(event, (bibleKey: string) => {
            const newBibleItem = ReadIdOnlyBibleItem.fromJson(
                bibleItemsRef.current[0].toJson(),
            );
            newBibleItem.bibleKey = bibleKey;
            const newBibleItems = [...bibleItemsRef.current, newBibleItem];
            applyPresentsRef.current(newBibleItems);
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
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
