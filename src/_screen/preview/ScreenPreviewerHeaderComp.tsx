import ShowHideScreen from './ShowHideScreen';
import MiniScreenClearControlComp from './MiniScreenClearControlComp';
import ItemColorNoteComp from '../../others/ItemColorNoteComp';
import {
    useScreenManagerBaseContext,
    useScreenManagerEvents,
} from '../managers/screenManagerHooks';
import { useCallback, useState } from 'react';
import ShowingScreenIcon from './ShowingScreenIcon';

export default function ScreenPreviewerHeaderComp() {
    const screenManagerBase = useScreenManagerBaseContext();
    const [isLocked, setIsLocked] = useState(screenManagerBase.isLocked);
    // A group member's lock is toggled from a sibling; re-sync from the
    // instance event that its setter fires.
    useScreenManagerEvents(['instance'], screenManagerBase, () => {
        setIsLocked(screenManagerBase.isLocked);
    });
    const handleToggleLock = useCallback(() => {
        const newIsLocked = !screenManagerBase.isLocked;
        setIsLocked(newIsLocked);
        screenManagerBase.setIsLockedWithSyncGroup(newIsLocked);
    }, [screenManagerBase]);
    return (
        <div
            className="card-header w-100"
            style={{
                overflowX: 'auto',
                overflowY: 'hidden',
                height: '26px',
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
