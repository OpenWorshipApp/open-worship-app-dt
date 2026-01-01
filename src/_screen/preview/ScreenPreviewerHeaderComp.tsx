import ShowHideScreen from './ShowHideScreen';
import MiniScreenClearControlComp from './MiniScreenClearControlComp';
import ItemColorNoteComp from '../../others/ItemColorNoteComp';
import { useScreenManagerBaseContext } from '../managers/screenManagerHooks';
import { useState } from 'react';
import ShowingScreenIcon from './ShowingScreenIcon';

export default function ScreenPreviewerHeaderComp() {
    const screenManagerBase = useScreenManagerBaseContext();
    const [isLocked, setIsLocked] = useState(screenManagerBase.isLocked);
    const setIsLocked1 = (newIsLocked: boolean) => {
        screenManagerBase.isLocked = newIsLocked;
        setIsLocked(newIsLocked);
    };
    return (
        <div
            className="card-header w-100"
            style={{
                overflowX: 'auto',
                overflowY: 'hidden',
                height: '30px',
                padding: '2px',
            }}
        >
            <div className="d-flex w-100 h-100">
                <div className="d-flex justify-content-start">
                    <ShowHideScreen />
                    <MiniScreenClearControlComp />
                </div>
                <div className="flex-fill d-flex justify-content-end ms-2">
                    <ShowingScreenIcon screenId={screenManagerBase.screenId} />
                    <div className="ms-2">
                        <ItemColorNoteComp item={screenManagerBase} />
                    </div>
                    <div className="ms-2" title="TODO: implement this feature">
                        <i
                            className={
                                `bi bi-${isLocked ? 'lock-fill' : 'unlock'}` +
                                ' app-caught-hover-pointer'
                            }
                            style={{ color: isLocked ? 'red' : 'green' }}
                            onClick={() => {
                                setIsLocked1(!isLocked);
                            }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
