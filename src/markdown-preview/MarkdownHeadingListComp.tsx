import type {
    CSSProperties,
    KeyboardEvent as ReactKeyboardEvent,
    RefObject,
} from 'react';
import { useRef } from 'react';

import { useAppEffect } from '../helper/appHooks';
import { tran } from '../lang/langHelpers';
import type { MarkdownHeadingType } from './markdownHeadingHelpers';

const FOCUS_KEY_LIST = ['ArrowDown', 'ArrowUp', 'Home', 'End'];

function toFocusIndex(key: string, index: number, count: number) {
    if (key === 'Home') {
        return 0;
    }
    if (key === 'End') {
        return count - 1;
    }
    if (key === 'ArrowDown') {
        return index < 0 ? 0 : Math.min(index + 1, count - 1);
    }
    return index < 0 ? count - 1 : Math.max(index - 1, 0);
}

/**
 * The page's headings, hung from the head row's Sections button
 * (`markdownHeadingHelpers.ts`): a press on one scrolls the page to it and
 * closes the list. Each is set in by its level under the page's highest, and
 * the section being read is marked and focused, so the arrows move from
 * there. Escape, a press anywhere else, or the button again closes it.
 * Mounted only while open, and never on paper (the head row is not).
 */
export default function MarkdownHeadingListComp({
    headings,
    currentIndex,
    toggleRef,
    onPick,
    onClose,
}: Readonly<{
    headings: MarkdownHeadingType[];
    currentIndex: number;
    // The button that opened it: a press there is that button's own.
    toggleRef: RefObject<HTMLButtonElement | null>;
    onPick: (index: number) => void;
    // `isFocusBack`: the focus goes back to that button.
    onClose: (isFocusBack: boolean) => void;
}>) {
    const listRef = useRef<HTMLElement>(null);
    useAppEffect(() => {
        const listElement = listRef.current;
        listElement
            ?.querySelectorAll('button')
            .item(Math.max(currentIndex, 0))
            ?.focus();
        const handlePointerDown = (event: PointerEvent) => {
            const target = event.target;
            if (
                target instanceof Node &&
                (listElement?.contains(target) ||
                    toggleRef.current?.contains(target))
            ) {
                return;
            }
            onClose(false);
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape' || event.defaultPrevented) {
                return;
            }
            event.preventDefault();
            onClose(true);
        };
        document.addEventListener('pointerdown', handlePointerDown, true);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener(
                'pointerdown',
                handlePointerDown,
                true,
            );
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    const handleKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
        if (!FOCUS_KEY_LIST.includes(event.key)) {
            return;
        }
        const buttonList = Array.from(
            event.currentTarget.querySelectorAll('button'),
        );
        if (buttonList.length === 0) {
            return;
        }
        event.preventDefault();
        const index = buttonList.findIndex((button) => {
            return button === document.activeElement;
        });
        buttonList[toFocusIndex(event.key, index, buttonList.length)]?.focus();
    };

    const topLevel = Math.min(
        ...headings.map((heading) => {
            return heading.level;
        }),
    );
    return (
        <nav
            ref={listRef}
            className="app-markdown-heading-list"
            aria-label={tran('Sections')}
            onKeyDown={handleKeyDown}
        >
            <ul>
                {headings.map((heading, index) => {
                    const depth = heading.level - topLevel;
                    return (
                        <li key={`${index}-${heading.text}`}>
                            <button
                                type="button"
                                className={
                                    'app-markdown-heading-list-item' +
                                    (depth === 0
                                        ? ' app-markdown-heading-list-item--top'
                                        : '')
                                }
                                style={
                                    {
                                        '--app-heading-depth': depth,
                                    } as CSSProperties
                                }
                                title={heading.text}
                                aria-current={
                                    index === currentIndex
                                        ? 'location'
                                        : undefined
                                }
                                onClick={() => {
                                    onPick(index);
                                }}
                            >
                                {heading.text}
                            </button>
                        </li>
                    );
                })}
            </ul>
        </nav>
    );
}
