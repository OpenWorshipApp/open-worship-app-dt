import { useCallback, useRef, type MouseEvent } from 'react';

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
import { createMouseEventUnder } from '../context-menu/contextMenuEventHelpers';

/**
 * The split buttons -- and their keys -- of the view being edited while it
 * shows the book or chapter grid, where `RenderEditingActionButtonsComp` (and
 * the split it carries) is not mounted. There is no passage to copy, so the
 * new view opens the picked book's chapter 1, or Genesis 1
 * (`splitWithoutPassage`). Nothing is read until a press. In a colour group
 * the press asks which version first, as it does on a view with a passage.
 */
export default function RenderLookupSplitButtonsComp({
    bookKey,
}: Readonly<{ bookKey: string | null }>) {
    const viewController = useLookupBibleItemControllerContext();
    const viewControllerRef = useAppCurrentRef(viewController);
    const bookKeyRef = useAppCurrentRef(bookKey);
    const splitHorizontalRef = useRef<HTMLButtonElement>(null);
    const splitVerticalRef = useRef<HTMLButtonElement>(null);
    useKeyboardRegistering(
        splitEventMappers,
        (event) => {
            event.preventDefault();
            const isHorizontal = event.key.toLowerCase() === 's';
            const button = (
                isHorizontal ? splitHorizontalRef : splitVerticalRef
            ).current;
            viewControllerRef.current.splitWithoutPassageOnPress(
                // A key has no pointer position: the version list a grouped
                // view asks with hangs under the key's own button.
                button === null ? event : createMouseEventUnder(button),
                bookKeyRef.current,
                isHorizontal,
            );
        },
        [],
    );
    const handleSplitHorizontal = useCallback((event: MouseEvent) => {
        viewControllerRef.current.splitWithoutPassageOnPress(
            event,
            bookKeyRef.current,
            true,
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleSplitVertical = useCallback((event: MouseEvent) => {
        viewControllerRef.current.splitWithoutPassageOnPress(
            event,
            bookKeyRef.current,
            false,
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const isAskingBibleKey = viewController.checkIsSplitAskingBibleKey(
        viewController.selectedBibleItem,
    );
    const splitHorizontalLabel = isAskingBibleKey
        ? tran('Split Horizontal to')
        : tran('Split horizontal');
    const splitVerticalLabel = isAskingBibleKey
        ? tran('Split Vertical to')
        : tran('Split vertical');
    return (
        <div className="btn-group">
            <button
                type="button"
                className="btn btn-sm btn-outline-info"
                title={
                    splitHorizontalLabel +
                    ` [${toShortcutKey(splitHorizontalEventMapper)}]`
                }
                aria-label={splitHorizontalLabel}
                aria-haspopup={isAskingBibleKey ? 'menu' : undefined}
                ref={splitHorizontalRef}
                onClick={handleSplitHorizontal}
            >
                <i className="bi bi-vr" />
            </button>
            <button
                type="button"
                className="btn btn-sm btn-outline-info"
                title={
                    splitVerticalLabel +
                    ` [${toShortcutKey(splitVerticalEventMapper)}]`
                }
                aria-label={splitVerticalLabel}
                aria-haspopup={isAskingBibleKey ? 'menu' : undefined}
                ref={splitVerticalRef}
                onClick={handleSplitVertical}
            >
                <i className="bi bi-hr" />
            </button>
        </div>
    );
}
