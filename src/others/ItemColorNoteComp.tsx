import { useMemo, useState } from 'react';

import colorList from './color-list.json';
import ColorNoteInf from '../helper/ColorNoteInf';
import { useAppEffectAsync } from '../helper/debuggerHelpers';
import { freezeObject } from '../helper/helpers';
import {
    ContextMenuItemType,
    showAppContextMenu,
} from '../context-menu/appContextMenuHelpers';

freezeObject(colorList);

// https://www.w3.org/wiki/CSS/Properties/color/keywords

export default function ItemColorNoteComp({
    item,
}: Readonly<{
    item: ColorNoteInf;
}>) {
    const [colorNote, setColorNote] = useState('');
    useAppEffectAsync(
        async (contextMethods) => {
            const colorNote = await item.getColorNote();
            contextMethods.setColorNote(colorNote ?? '');
        },
        [item],
        { setColorNote },
    );
    const setColorNote1 = (colorNote: string | null) => {
        setColorNote(colorNote ?? '');
        item.setColorNote(colorNote);
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
        return reverseColorMap[colorNote] ?? 'No Color';
    }, [colorNote]);
    const handleColorSelecting = (event: any) => {
        event.stopPropagation();
        const colors = Object.entries({
            ...colorList.main,
            ...colorList.extension,
        });
        // unique colors by key
        const items: ContextMenuItemType[] = [
            {
                childBefore: (
                    <i className="bi bi-x-lg" style={{ color: 'red' }} />
                ),
                menuElement: '`No Color',
                title: '`Clear Color Note',
                disabled: colorNote === null,
                onSelect: () => {
                    setColorNote1(null);
                },
            },
            ...colors.map(([name, colorCode]): ContextMenuItemType => {
                return {
                    menuElement: name,
                    disabled: colorNote === colorCode,
                    onSelect: () => {
                        setColorNote1(colorCode);
                    },
                    childAfter: (
                        <div className="flex-fill">
                            <i
                                className="bi bi-record-circle float-end"
                                style={{ color: colorCode }}
                            />
                        </div>
                    ),
                };
            }),
        ];
        showAppContextMenu(event, items);
    };

    return (
        <span
            className={`color-note app-caught-hover-pointer ${colorNote ? 'active' : ''}`}
            title={title}
            onClick={handleColorSelecting}
        >
            <i
                className="bi bi-record-circle"
                style={
                    colorNote
                        ? {
                              color: colorNote,
                          }
                        : {}
                }
            />
        </span>
    );
}
