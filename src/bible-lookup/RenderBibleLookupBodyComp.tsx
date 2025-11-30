import { toInputText } from '../helper/bible-helpers/bibleLogicHelpers2';
import RenderLookupSuggestionComp from './RenderLookupSuggestionComp';
import { keyToBook } from '../helper/bible-helpers/bibleInfoHelpers';
import { useBibleKeyContext } from '../bible-list/bibleHelpers';
import {
    EditingResultContext,
    useLookupBibleItemControllerContext,
} from '../bible-reader/LookupBibleItemController';
import { use } from 'react';

export default function RenderBibleLookupBodyComp() {
    const viewController = useLookupBibleItemControllerContext();
    const bibleKey = useBibleKeyContext();
    const editingResult = use(EditingResultContext);
    const handleBookSelecting = async (_: string, newBook: string) => {
        const newText = await toInputText(bibleKey, newBook);
        viewController.inputText = newText;
    };
    const handleChapterSelecting = async (newChapter: number) => {
        if (editingResult === null) {
            return;
        }
        if (bibleKey === null || editingResult.result.bookKey === null) {
            return;
        }
        const book = await keyToBook(bibleKey, editingResult.result.bookKey);
        const newText = await toInputText(bibleKey, book, newChapter);
        viewController.inputText = `${newText}:`;
    };
    return (
        <RenderLookupSuggestionComp
            applyChapterSelection={handleChapterSelecting}
            applyBookSelection={handleBookSelecting}
        />
    );
}
