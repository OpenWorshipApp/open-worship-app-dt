import { type ChangeEvent, useCallback } from 'react';

import { tran } from '../lang/langHelpers';
import { useAppCurrentRef } from '../helper/appHooks';

type AlignmentDataType = {
    verticalAlignment?: string;
    horizontalAlignment?: string;
};

/**
 * Where the overlay sits, as ONE control.
 *
 * It used to be two rows: a three-button strip for top/middle/bottom, another
 * for left/centre/right, and a separate 330px box for the X/Y nudge -- about
 * a third of the panel's height spent answering one question. A compositing
 * desk asks it with a nine-cell pad, because the answer is a place rather than
 * two independent choices, and the pad shows that place instead of describing
 * it. The nudge belongs in the same cell for the same reason: an offset IS
 * the position, measured from the cell.
 *
 * Every cell keeps a name of its own (`Top left`, `Middle center`, ...) rather
 * than a composed one, so a cell is still findable and pressable by the words
 * on it -- three cells all answering to "Align top" would be worse than the
 * buttons it replaces.
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
    verticalAlignment: string;
    horizontalAlignment: string;
    labelKey: string;
    isActive: boolean;
    onChoose: (data: AlignmentDataType) => void;
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

export default function ForegroundPositionPadComp({
    data,
    onData,
    offsetX,
    setOffsetX,
    offsetY,
    setOffsetY,
}: Readonly<{
    data: AlignmentDataType;
    onData: (data: AlignmentDataType) => void;
    offsetX: number;
    setOffsetX: (value: number) => void;
    offsetY: number;
    setOffsetY: (value: number) => void;
}>) {
    const setOffsetXRef = useAppCurrentRef(setOffsetX);
    const setOffsetYRef = useAppCurrentRef(setOffsetY);
    const handleOffsetXChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            setOffsetXRef.current(Number.parseInt(event.target.value) || 0);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const handleOffsetYChange = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            setOffsetYRef.current(Number.parseInt(event.target.value) || 0);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const offsetTitle = tran('Position offset in pixels');
    return (
        <div className="fg-pad" data-widget-name="Position">
            <div
                className="fg-pad-grid"
                role="group"
                aria-label={tran('Position')}
            >
                {PAD_ROW_LIST.map((row) => {
                    return row.cells.map((cell) => {
                        return (
                            <PadCellComp
                                key={cell.labelKey}
                                verticalAlignment={row.verticalAlignment}
                                horizontalAlignment={cell.horizontalAlignment}
                                labelKey={cell.labelKey}
                                isActive={
                                    data.verticalAlignment ===
                                        row.verticalAlignment &&
                                    data.horizontalAlignment ===
                                        cell.horizontalAlignment
                                }
                                onChoose={onData}
                            />
                        );
                    });
                })}
            </div>
            <div className="fg-pad-offset" title={offsetTitle}>
                <label className="fg-pad-offset-axis">
                    <span aria-hidden="true">X</span>
                    <input
                        type="number"
                        aria-label={`${offsetTitle} X`}
                        value={offsetX}
                        onChange={handleOffsetXChange}
                    />
                </label>
                <label className="fg-pad-offset-axis">
                    <span aria-hidden="true">Y</span>
                    <input
                        type="number"
                        aria-label={`${offsetTitle} Y`}
                        value={offsetY}
                        onChange={handleOffsetYChange}
                    />
                </label>
            </div>
        </div>
    );
}
