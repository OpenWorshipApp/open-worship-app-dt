import {
    toInputText,
    toTrailingReference,
} from '../helper/bible-helpers/bibleLogicHelpers2';
import RenderLookupSuggestionComp from './RenderLookupSuggestionComp';
import { keyToBook } from '../helper/bible-helpers/bibleInfoHelpers';
import { useBibleKeyContext } from '../bible-list/bibleHelpers';
import {
    EditingResultContext,
    useLookupBibleItemControllerContext,
} from '../bible-reader/LookupBibleItemController';
import { use, useCallback } from 'react';
import { useAppCurrentRef } from '../helper/appHooks';

export default function RenderBibleLookupBodyComp() {
    const viewController = useLookupBibleItemControllerContext();
    const bibleKey = useBibleKeyContext();
    const editingResult = use(EditingResultContext);
    const bibleKeyRef = useAppCurrentRef(bibleKey);
    const viewControllerRef = useAppCurrentRef(viewController);
    const editingResultRef = useAppCurrentRef(editingResult);
    const handleBookSelecting = useCallback(
        async (_: string, newBook: string) => {
            const newText = await toInputText(bibleKeyRef.current, newBook);
            // "Psalms 23:1" matched no book: picking the one it meant keeps
            // the "23:1" that was already typed instead of dropping it.
            const trailingReference = toTrailingReference(
                editingResultRef.current?.result.guessingBook ?? null,
            );
            viewControllerRef.current.inputText =
                trailingReference !== null && newText.endsWith(' ')
                    ? `${newText}${trailingReference}`
                    : newText;
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const handleChapterSelecting = useCallback(async (newChapter: number) => {
        if (editingResultRef.current === null) {
            return;
        }
        if (
            bibleKeyRef.current === null ||
            editingResultRef.current.result.bookKey === null
        ) {
            return;
        }
        const book = await keyToBook(
            bibleKeyRef.current,
            editingResultRef.current.result.bookKey,
        );
        const newText = await toInputText(
            bibleKeyRef.current,
            book,
            newChapter,
        );
        viewControllerRef.current.inputText = `${newText}:`;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <RenderLookupSuggestionComp
            applyChapterSelection={handleChapterSelecting}
            applyBookSelection={handleBookSelecting}
        />
    );
}
