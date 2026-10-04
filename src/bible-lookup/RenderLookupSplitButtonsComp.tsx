import { useCallback } from 'react';

import {
    toShortcutKey,
    useKeyboardRegistering,
} from '../event/KeyboardEventListener';
import {
    splitEventMappers,
    splitHorizontalEventMapper,
    splitVerticalEventMapper,
    useLookupBibleItemControllerContext,
} from '../bible-reader/LookupBibleItemController';
import { useAppCurrentRef } from '../helper/appHooks';
import { tran } from '../lang/langHelpers';

/**
 * The split buttons -- and their keys -- of the view being edited while it
 * shows the book or chapter grid, where `RenderEditingActionButtonsComp` (and
 * the split it carries) is not mounted. There is no passage to copy, so the
 * new view opens the picked book's chapter 1, or Genesis 1
 * (`splitWithoutPassage`). Nothing is read until a press.
 */
export default function RenderLookupSplitButtonsComp({
    bookKey,
}: Readonly<{ bookKey: string | null }>) {
    const viewController = useLookupBibleItemControllerContext();
    const viewControllerRef = useAppCurrentRef(viewController);
    const bookKeyRef = useAppCurrentRef(bookKey);
    useKeyboardRegistering(
        splitEventMappers,
        (event) => {
            event.preventDefault();
            viewControllerRef.current.splitWithoutPassage(
                bookKeyRef.current,
                event.key.toLowerCase() === 's',
            );
        },
        [],
    );
    const handleSplitHorizontal = useCallback(() => {
        viewControllerRef.current.splitWithoutPassage(bookKeyRef.current, true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleSplitVertical = useCallback(() => {
        viewControllerRef.current.splitWithoutPassage(
            bookKeyRef.current,
            false,
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <div className="btn-group">
            <button
                type="button"
                className="btn btn-sm btn-outline-info"
                title={
                    tran('Split horizontal') +
                    ` [${toShortcutKey(splitHorizontalEventMapper)}]`
                }
                aria-label={tran('Split horizontal')}
                onClick={handleSplitHorizontal}
            >
                <i className="bi bi-vr" />
            </button>
            <button
                type="button"
                className="btn btn-sm btn-outline-info"
                title={
                    tran('Split vertical') +
                    ` [${toShortcutKey(splitVerticalEventMapper)}]`
                }
                aria-label={tran('Split vertical')}
                onClick={handleSplitVertical}
            >
                <i className="bi bi-hr" />
            </button>
        </div>
    );
}
