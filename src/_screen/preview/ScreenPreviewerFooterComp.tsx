import { useState } from 'react';

import { tran } from '../../lang/langHelpers';
import { useScreenManagerBaseContext } from '../managers/screenManagerHooks';
import DisplayControl from './DisplayControl';
import ScreenEffectControlComp from './ScreenEffectControlComp';
import type { ContextMenuItemType } from '../../context-menu/appContextMenuHelpers';
import { showAppContextMenu } from '../../context-menu/appContextMenuHelpers';

function getNewStageNumber(
    event: any,
    currentStageNumber: number,
    onChange: (newStageNumber: number) => void,
) {
    const items: ContextMenuItemType[] = Array.from(
        { length: 5 },
        (_, i) => i,
    ).map((i) => {
        return {
            menuElement: `${i}`,
            disabled: i === currentStageNumber,
            onSelect: () => {
                onChange(i);
            },
        };
    });
    items.push(
        {
            menuElement: tran('Decrement'),
            disabled: currentStageNumber <= 0,
            onSelect: () => {
                onChange(Math.max(0, currentStageNumber - 1));
            },
        },
        {
            menuElement: tran('Increment'),
            onSelect: () => {
                onChange(currentStageNumber + 1);
            },
        },
    );
    showAppContextMenu(event, items);
}

export default function ScreenPreviewerFooterComp() {
    const screenManagerBase = useScreenManagerBaseContext();
    const [stageNumber, setStageNumber] = useState(
        screenManagerBase.stageNumber,
    );
    const setStageNumber1 = (newStageNumber: number) => {
        screenManagerBase.stageNumber = newStageNumber;
        setStageNumber(newStageNumber);
    };
    return (
        <div
            className="card-footer w-100"
            style={{
                overflowX: 'auto',
                overflowY: 'hidden',
                height: '25px',
                padding: '1px',
            }}
        >
            <div className="d-flex w-100 h-100">
                <div className="d-flex justify-content-start">
                    <DisplayControl />
                    <ScreenEffectControlComp />
                </div>
                <div className="flex-grow-1 d-flex justify-content-end">
                    <div
                        className="d-flex app-caught-hover-pointer"
                        title={tran('Click to change Stage Number')}
                        onClick={(event) => {
                            getNewStageNumber(
                                event,
                                stageNumber,
                                setStageNumber1,
                            );
                        }}
                    >
                        <small>{tran('Stage:')}</small>
                        <div className="px-1 text-muted">{stageNumber}</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
