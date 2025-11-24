import { showBibleOption } from '../bible-lookup/BibleSelectionComp';
import { ReadIdOnlyBibleItem } from './ReadIdOnlyBibleItem';

export default function ButtonAddMoreBibleComp({
    bibleItems,
    applyPresents,
}: Readonly<{
    bibleItems: ReadIdOnlyBibleItem[];
    applyPresents: (bibleItem: ReadIdOnlyBibleItem[]) => void;
}>) {
    return (
        <button
            className="btn btn-info btn-sm"
            disabled={bibleItems.length === 0}
            onClick={(event) => {
                showBibleOption(event, (bibleKey: string) => {
                    const newBibleItem = ReadIdOnlyBibleItem.fromJson(
                        bibleItems[0].toJson(),
                    );
                    newBibleItem.bibleKey = bibleKey;
                    const newBibleItems = [...bibleItems, newBibleItem];
                    applyPresents(newBibleItems);
                });
            }}
        >
            <i className="bi bi-plus" /> Add Item
        </button>
    );
}
