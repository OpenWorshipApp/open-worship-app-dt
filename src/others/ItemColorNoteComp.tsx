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

/**
 * Colour codes are written in either case across the list (`main` has
 * `#00FF00`, `extension` `#00ff00`) and a code is stored exactly as it was
 * picked, so name lookups and the current-row check compare case-insensitively.
 * Without this a default lime note (the `main` spelling) read as "No Color" and
 * left its own row unmarked.
 */
function toColorKey(colorCode: string) {
    return colorCode.toLowerCase();
}

/**
 * Each colour ONCE, under the first name the lists give it. Nine colours carry
 * two CSS names (`fuchsia` / `magenta`, `aqua` / `cyan`, `gray` / `grey` …)
 * and a note stores only the code, so the menu offered both rows and the dot
 * could name only one of them: `fuchsia` picked read back as "Color Note:
 * magenta" (F-6 of robot run 20261120-2021). The menu and the dot read this
 * one list, so the name pressed is the name said.
 */
function genColorEntries() {
    const seenKeys = new Set<string>();
    return Object.entries({
        ...colorList.main,
        ...colorList.extension,
    }).filter(([, colorCode]) => {
        const colorKey = toColorKey(colorCode);
        if (seenKeys.has(colorKey)) {
            return false;
        }
        seenKeys.add(colorKey);
        return true;
    });
}

export function chooseColorNote(
    colorNote: string | null,
    setColorNote: (color: string | null) => void,
    event: any,
    defaultColorNote: string | null = null,
) {
    event.stopPropagation();
    const colors = genColorEntries();
    const colorKey = colorNote ? toColorKey(colorNote) : '';
    const defaultColorKey = defaultColorNote
        ? toColorKey(defaultColorNote)
        : '';
    // unique colors by key
    const items: ContextMenuItemType[] = [
        {
            childBefore: genContextMenuItemIcon('x-lg', { color: 'red' }),
            menuElement: tran('No Color'),
            title: tran('Clear Color Note'),
            // By truthiness, as the swatch itself reads it: the component's
            // own async load stores a missing colour as `''`, not `null`, and
            // a strict `=== null` left "No Color" pressable on a cleared item.
            // An item with a default colour is already showing it -- clearing
            // there changes nothing, so it is offered only for another colour.
            disabled: !colorNote || colorKey === defaultColorKey,
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
                disabled: colorKey === toColorKey(colorCode),
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
    defaultColorNote = null,
}: Readonly<{
    item: ColorNoteInf;
    onChange?: (colorNote: string | null) => void;
    /**
     * The colour shown when the item has none of its own (a bible preview
     * section, which always has a colour). "No Color" then means "back to the
     * default", so the swatch starts at that colour instead of flashing with
     * no colour at all.
     */
    defaultColorNote?: string | null;
}>) {
    // The list already resolved this file's colour note and kept it on the
    // item (`useFilePaths`), so seed from that: re-reading it asynchronously
    // per item costs an `fsCheckFileExist` EVERY time the item mounts, and
    // with a windowed list an item mounts again on every scroll back.
    const [colorNote, setColorNote] = useState<string | null>(
        item.colorNote ?? defaultColorNote ?? null,
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
    // Says what the control IS before which colour it holds. The colour alone
    // -- `magenta`, a CSS keyword the menu lists as written -- said nothing
    // of what a press does, and in a translated window it was the row's one
    // English word.
    const title = useMemo(() => {
        const colorKey = toColorKey(colorNote ?? '');
        const colorName =
            genColorEntries().find(([, colorCode]) => {
                return toColorKey(colorCode) === colorKey;
            })?.[0] ?? tran('No Color');
        return `${tran('Color Note')}: ${colorName}`;
    }, [colorNote]);

    const handleChoosing = (event: any) => {
        chooseColorNote(colorNote, setColorNote1, event, defaultColorNote);
    };
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
