import {
    ContextMenuItemType,
    showAppContextMenu,
} from './AppContextMenu';
import colorList from './color-list.json';
import ColorNoteInf from '../helper/ColorNoteInf';
import { useMemo } from 'react';

// https://www.w3.org/wiki/CSS/Properties/color/keywords

export default function ItemColorNote({ item }: {
    item: ColorNoteInf,
}) {
    const title = useMemo(() => {
        const reverseColorMap: Record<string, string> =
            Object.entries({
                ...colorList.main,
                ...colorList.extension,
            }).reduce((acc, [name, colorCode]) => {
                acc[colorCode] = name;
                return acc;
            }, {} as Record<string, string>);
        return reverseColorMap[item.colorNote || ''] || 'no color';
    }, [item.colorNote]);

    return (
        <span className={`color-note ${item.colorNote ? 'active' : ''}`}
            title={title}
            onClick={(event) => {
                event.stopPropagation();
                const colors = Object.entries({
                    ...colorList.main,
                    ...colorList.extension,
                });
                // unique colors by key
                const items: ContextMenuItemType[] = [{
                    title: 'no color',
                    disabled: item.colorNote === null,
                    onClick: () => {
                        item.colorNote = null;
                    },
                }, ...colors.map(([name, colorCode]): ContextMenuItemType => {
                    return {
                        title: name,
                        disabled: item.colorNote === colorCode,
                        onClick: () => {
                            item.colorNote = colorCode;
                        },
                        otherChild: (<div className='flex-fill'>
                            <i className='bi bi-record-circle float-end'
                                style={{ color: colorCode }} />
                        </div>),
                    };
                })];
                showAppContextMenu(event as any, items);
            }} >
            <i className='bi bi-record-circle'
                style={item.colorNote ? {
                    color: item.colorNote,
                } : {}} />
        </span>
    );
}
