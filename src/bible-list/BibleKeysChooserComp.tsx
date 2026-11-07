import type { Dispatch, SetStateAction } from 'react';

import { useAppStateAsync } from '../helper/appHooks';
import { getAllLocalBibleInfoList } from '../helper/bible-helpers/bibleDownloadHelpers';
import { handleError } from '../helper/errorHelpers';
import { tran } from '../lang/langHelpers';

// The Bible versions a document made from a passage holds: the passage's own,
// always ticked, and any other installed one. Shared by Generate Slides and
// Create Lyric, so both pick versions the same way.
export default function BibleKeysChooserComp({
    bibleKey,
    bibleKeys,
    setBibleKeys,
    isDisabled,
}: Readonly<{
    bibleKey: string;
    bibleKeys: string[];
    setBibleKeys: Dispatch<SetStateAction<string[]>>;
    isDisabled: boolean;
}>) {
    // A list that could not be read is null, and says so: a rejection leaves
    // the hook's value as it was, and the popup read "Loading" for good
    // (2026-11-04).
    const [bibles] = useAppStateAsync(async () => {
        try {
            return await getAllLocalBibleInfoList();
        } catch (error) {
            handleError(error);
            return null;
        }
    }, []);
    return (
        <div className="flex-grow-1 overflow-auto" style={{ minHeight: 100 }}>
            <label className="d-flex align-items-center gap-2 p-2">
                <input
                    type="checkbox"
                    className="form-check-input m-0"
                    checked
                    disabled
                />
                {bibleKey}
            </label>
            {bibles === undefined && <p role="status">{tran('Loading')}</p>}
            {bibles === null && (
                <p role="alert">{tran('Unable to get bible info list')}</p>
            )}
            {(bibles ?? [])
                .filter(({ key }) => key !== bibleKey)
                .map((bible) => (
                    <label
                        key={bible.key}
                        className="d-flex align-items-center gap-2 p-2"
                        data-locale-ff={bible.locale}
                    >
                        <input
                            type="checkbox"
                            className="form-check-input m-0"
                            checked={bibleKeys.includes(bible.key)}
                            disabled={isDisabled}
                            onChange={() =>
                                setBibleKeys((keys) =>
                                    keys.includes(bible.key)
                                        ? keys.filter(
                                              (key) => key !== bible.key,
                                          )
                                        : [...keys, bible.key],
                                )
                            }
                        />
                        <span>
                            {bible.key} — {bible.title}
                        </span>
                    </label>
                ))}
        </div>
    );
}
