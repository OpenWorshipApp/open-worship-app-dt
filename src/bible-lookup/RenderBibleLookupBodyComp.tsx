import RenderLookupSuggestionComp from './RenderLookupSuggestionComp';
import { useBibleKeyContext } from '../bible-list/bibleHelpers';
import {
    EditingResultContext,
    useLookupBibleItemControllerContext,
} from '../bible-reader/LookupBibleItemController';
import { use, useCallback } from 'react';
import { useAppCurrentRef } from '../helper/appHooks';
import { useKeyboardRegistering } from '../event/KeyboardEventListener';
import { lookupEnterEventMapper } from '../keyboard-shortcut/appShortcutMappers';
import {
    checkIsBibleLookupInputFocused,
    getBibleLookupInputText,
} from './selectionHelpers';
import {
    genBookPickInputText,
    genChapterPickInputText,
    genLookupEnterPick,
} from './lookupEnterHelpers';

export default function RenderBibleLookupBodyComp() {
    const viewController = useLookupBibleItemControllerContext();
    const bibleKey = useBibleKeyContext();
    const editingResult = use(EditingResultContext);
    const bibleKeyRef = useAppCurrentRef(bibleKey);
    const viewControllerRef = useAppCurrentRef(viewController);
    const editingResultRef = useAppCurrentRef(editingResult);
    // Each takes what the result it answers says, rather than reading the one
    // on screen: Enter in the box picks from a result worked out for the text
    // the box holds, which the one on screen may not be yet.
    const applyBook = useCallback(
        async (newBook: string, guessingBook: string | null) => {
            viewControllerRef.current.inputText = await genBookPickInputText(
                bibleKeyRef.current,
                newBook,
                guessingBook,
            );
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const applyChapter = useCallback(
        async (newChapter: number, bookKey: string | null) => {
            if (bibleKeyRef.current === null || bookKey === null) {
                return;
            }
            viewControllerRef.current.inputText = await genChapterPickInputText(
                bibleKeyRef.current,
                bookKey,
                newChapter,
            );
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    // A press on an option is a press on the list on screen, so the result
    // that list was drawn from is the one on screen too.
    const handleBookSelecting = useCallback(
        (_: string, newBook: string) => {
            applyBook(
                newBook,
                editingResultRef.current?.result.guessingBook ?? null,
            );
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const handleChapterSelecting = useCallback(
        (newChapter: number) => {
            applyChapter(
                newChapter,
                editingResultRef.current?.result.bookKey ?? null,
            );
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    // Enter in the reference box acts on the text IN the box. It used to press
    // the highlighted option of whatever list was up, and that list is drawn
    // from a result that lands after the keystroke: a fast `Genesis 1:1-31` +
    // Enter from Luke's chapter list pressed Luke's chapter 1, and the box
    // became `Luke 1:`. A press made in the list itself is still the list's
    // (`userEnteringSelected`).
    const handleInputEntering = useCallback(
        async () => {
            if (!checkIsBibleLookupInputFocused()) {
                return;
            }
            const inputText = getBibleLookupInputText();
            const { result } =
                await viewControllerRef.current.getEditingResult(inputText);
            const pick = await genLookupEnterPick(bibleKeyRef.current, result);
            // Typed on while this was worked out: the press belonged to a text
            // the box no longer holds.
            if (pick === null || getBibleLookupInputText() !== inputText) {
                return;
            }
            if (pick.kind === 'book') {
                await applyBook(pick.book, result.guessingBook);
            } else {
                await applyChapter(pick.chapter, result.bookKey);
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    useKeyboardRegistering([lookupEnterEventMapper], handleInputEntering, []);
    return (
        <RenderLookupSuggestionComp
            applyChapterSelection={handleChapterSelecting}
            applyBookSelection={handleBookSelecting}
        />
    );
}
