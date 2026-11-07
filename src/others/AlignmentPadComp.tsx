import './AlignmentPadComp.scss';

import { useCallback } from 'react';

import { tran } from '../lang/langHelpers';
import { useAppCurrentRef } from '../helper/appHooks';

export type PadVerticalAlignmentType = 'start' | 'center' | 'end';
export type PadHorizontalAlignmentType = 'left' | 'center' | 'right';

export type AlignmentPadDataType = {
    verticalAlignment: PadVerticalAlignmentType;
    horizontalAlignment: PadHorizontalAlignmentType;
};

/**
 * Where a thing sits, as a nine-cell pad: the answer is a PLACE rather than
 * two independent choices, and the pad shows that place instead of
 * describing it.
 *
 * Every cell keeps a name of its own (`Top left`, `Middle center`, ...) rather
 * than a composed one, so a cell is still findable and pressable by the words
 * on it -- three cells all answering to "Align top" would be worse.
 *
 * Shared by the foreground's Position pad and the Stage Style panel's box
 * position. The styles stay `fg-pad-*`: they were the foreground's first.
 */
const PAD_ROW_LIST = [
    {
        verticalAlignment: 'start',
        cells: [
            { horizontalAlignment: 'left', labelKey: 'Top left' },
            { horizontalAlignment: 'center', labelKey: 'Top center' },
            { horizontalAlignment: 'right', labelKey: 'Top right' },
        ],
    },
    {
        verticalAlignment: 'center',
        cells: [
            { horizontalAlignment: 'left', labelKey: 'Middle left' },
            { horizontalAlignment: 'center', labelKey: 'Middle center' },
            { horizontalAlignment: 'right', labelKey: 'Middle right' },
        ],
    },
    {
        verticalAlignment: 'end',
        cells: [
            { horizontalAlignment: 'left', labelKey: 'Bottom left' },
            { horizontalAlignment: 'center', labelKey: 'Bottom center' },
            { horizontalAlignment: 'right', labelKey: 'Bottom right' },
        ],
    },
] as const;

function PadCellComp({
    verticalAlignment,
    horizontalAlignment,
    labelKey,
    isActive,
    onChoose,
}: Readonly<{
    verticalAlignment: PadVerticalAlignmentType;
    horizontalAlignment: PadHorizontalAlignmentType;
    labelKey: string;
    isActive: boolean;
    onChoose: (data: AlignmentPadDataType) => void;
}>) {
    const onChooseRef = useAppCurrentRef(onChoose);
    const handleClick = useCallback(() => {
        onChooseRef.current({ verticalAlignment, horizontalAlignment });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const label = tran(labelKey);
    return (
        <button
            type="button"
            className={'fg-pad-cell' + (isActive ? ' fg-pad-cell-active' : '')}
            title={label}
            aria-label={label}
            aria-pressed={isActive}
            onClick={handleClick}
        >
            <span className="fg-pad-dot" />
        </button>
    );
}

/**
 * The pad alone. A value that matches no cell (`null`, or anything a stored
 * record held that is not a place) lights none of them.
 */
export default function AlignmentPadComp({
    verticalAlignment,
    horizontalAlignment,
    label,
    onChoose,
}: Readonly<{
    verticalAlignment: string | null | undefined;
    horizontalAlignment: string | null | undefined;
    label: string;
    onChoose: (data: AlignmentPadDataType) => void;
}>) {
    return (
        <div className="fg-pad-grid" role="group" aria-label={label}>
            {PAD_ROW_LIST.map((row) => {
                return row.cells.map((cell) => {
                    return (
                        <PadCellComp
                            key={cell.labelKey}
                            verticalAlignment={row.verticalAlignment}
                            horizontalAlignment={cell.horizontalAlignment}
                            labelKey={cell.labelKey}
                            isActive={
                                verticalAlignment === row.verticalAlignment &&
                                horizontalAlignment === cell.horizontalAlignment
                            }
                            onChoose={onChoose}
                        />
                    );
                });
            })}
        </div>
    );
}
