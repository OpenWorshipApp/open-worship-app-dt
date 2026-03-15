import ShowHideScreen from './ShowHideScreen';
import MiniScreenClearControlComp from './MiniScreenClearControlComp';
import ItemColorNoteComp from '../../others/ItemColorNoteComp';
import { useScreenManagerBaseContext } from '../managers/screenManagerHooks';
import { useCallback, useState } from 'react';
import ShowingScreenIcon from './ShowingScreenIcon';

export default function ScreenPreviewerHeaderComp() {
    const screenManagerBase = useScreenManagerBaseContext();
    const [isLocked, setIsLocked] = useState(screenManagerBase.isLocked);
    const setIsLocked1 = useCallback(
        (newIsLocked: boolean) => {
            screenManagerBase.isLocked = newIsLocked;
            setIsLocked(newIsLocked);
        },
        [screenManagerBase],
    );
    const handleToggleLock = useCallback(() => {
        setIsLocked1(!isLocked);
    }, [isLocked, setIsLocked1]);
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
                    <div className="ms-2">
                        <i
                            className={
                                `bi bi-${isLocked ? 'lock-fill' : 'unlock'}` +
                                ' app-caught-hover-pointer'
                            }
                            style={{ color: isLocked ? 'red' : 'green' }}
                            onClick={handleToggleLock}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
