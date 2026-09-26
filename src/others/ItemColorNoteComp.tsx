import { useMemo, useState } from 'react';

import { tran } from '../lang/langHelpers';
import colorList from './color-list.json';
import type ColorNoteInf from '../helper/ColorNoteInf';
import { useAppEffectAsync } from '../helper/appHooks';
import { freezeObject, pressElementLikeButton } from '../helper/helpers';
import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';

freezeObject(colorList);

// https://www.w3.org/wiki/CSS/Properties/color/keywords

export function chooseColorNote(
    colorNote: string | null,
    setColorNote: (color: string | null) => void,
    event: any,
) {
    event.stopPropagation();
    const colors = Object.entries({
        ...colorList.main,
        ...colorList.extension,
    });
    // unique colors by key
    const items: ContextMenuItemType[] = [
        {
            childBefore: genContextMenuItemIcon('x-lg', { color: 'red' }),
            menuElement: tran('No Color'),
            title: tran('Clear Color Note'),
            disabled: colorNote === null,
            onSelect: () => {
                setColorNote(null);
            },
        },
        ...colors.map(([name, colorCode]): ContextMenuItemType => {
            return {
                // The swatch leads the row so it lines up with the icon column
                // every other menu uses — and with "No Color" right above it.
                childBefore: genContextMenuItemIcon('record-circle', {
                    color: colorCode,
                }),
                menuElement: name,
                disabled: colorNote === colorCode,
                onSelect: () => {
                    setColorNote(colorCode);
                },
            };
        }),
    ];
    showAppContextMenu(event, items);
}

export default function ItemColorNoteComp({
    item,
    onChange,
}: Readonly<{
    item: ColorNoteInf;
    onChange?: (colorNote: string | null) => void;
}>) {
    // The list already resolved this file's colour note and kept it on the
    // item (`useFilePaths`), so seed from that: re-reading it asynchronously
    // per item costs an `fsCheckFileExist` EVERY time the item mounts, and
    // with a windowed list an item mounts again on every scroll back.
    const [colorNote, setColorNote] = useState<string | null>(
        item.colorNote ?? null,
    );
    useAppEffectAsync(
        async (contextMethods) => {
            if (item.colorNote !== undefined) {
                return;
            }
            const colorNote = await item.getColorNote();
            contextMethods.setColorNote(colorNote ?? '');
        },
        [item],
        { setColorNote },
    );
    const setColorNote1 = (colorNote: string | null) => {
        setColorNote(colorNote);
        item.setColorNote(colorNote);
        onChange?.(colorNote);
    };
    const title = useMemo(() => {
        const reverseColorMap: Record<string, string> = Object.entries({
            ...colorList.main,
            ...colorList.extension,
        }).reduce(
            (acc, [name, colorCode]) => {
                acc[colorCode] = name;
                return acc;
            },
            {} as Record<string, string>,
        );
        return reverseColorMap[colorNote ?? ''] ?? tran('No Color');
    }, [colorNote]);

    const handleChoosing = chooseColorNote.bind(null, colorNote, setColorNote1);
    return (
        <span className={`color-note ${colorNote ? 'active' : ''}`}>
            {/*
              Button semantics by hand, for the same reason the colour swatches
              beside it need them: a styled `<i>` with an `onClick` is not a
              control to the accessibility tree. It was unreachable by keyboard,
              invisible to a screen reader, and -- because the only `title` sat
              on the WRAPPER -- anything that finds a control by its words (the
              help chatbot's matcher, `owa_find_ui`) resolved the span and
              pressed something that has no handler. Name, role and the press
              all belong on the one element now.
            */}
            <i
                role="button"
                tabIndex={0}
                aria-label={title}
                title={title}
                className="bi bi-record-circle app-caught-hover-pointer"
                onClick={handleChoosing}
                onKeyDown={pressElementLikeButton}
                style={{
                    textShadow: '0 0 2px var(--bs-info-text-emphasis)',
                    ...(colorNote
                        ? {
                              color: colorNote,
                          }
                        : {}),
                    opacity: colorNote ? 1 : 0.2,
                }}
            />
        </span>
    );
}
