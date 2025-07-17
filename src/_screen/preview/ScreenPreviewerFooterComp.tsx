import { useState } from 'react';
import { useScreenManagerBaseContext } from '../managers/screenManagerHooks';
import DisplayControl from './DisplayControl';
import ScreenEffectControlComp from './ScreenEffectControlComp';

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
                <div className="d-flex justify-content-start flex-fill">
                    <DisplayControl />
                    <ScreenEffectControlComp />
                </div>
                <div>
                    <div
                        className="d-flex input-group input-group-sm"
                        title="Stage number"
                        style={{
                            minWidth: '100px',
                        }}
                    >
                        <small>`Stage:</small>
                        <input
                            className="form-control"
                            type="number"
                            style={{
                                width: '30px',
                                height: '20px',
                            }}
                            min="0"
                            value={stageNumber}
                            onChange={(e) => {
                                setStageNumber1(parseInt(e.target.value, 10));
                            }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
