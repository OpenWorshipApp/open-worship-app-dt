import ShowHideScreen from './ShowHideScreen';
import MiniScreenClearControlComp from './MiniScreenClearControlComp';
import ItemColorNoteComp from '../../others/ItemColorNoteComp';
import {
    useScreenManagerBaseContext,
    useScreenManagerEvents,
} from '../managers/screenManagerHooks';
import { useCallback, useState } from 'react';
import ShowingScreenIcon from './ShowingScreenIcon';
import { tran } from '../../lang/langHelpers';
import { useAppCurrentRef } from '../../helper/appHooks';

export default function ScreenPreviewerHeaderComp({
    isFullView,
    setIsFullView,
}: Readonly<{
    isFullView: boolean;
    setIsFullView: (value: boolean) => void;
}>) {
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
    const isFullViewRef = useAppCurrentRef(isFullView);
    const setIsFullViewRef = useAppCurrentRef(setIsFullView);
    const handleToggleFullView = useCallback(() => {
        setIsFullViewRef.current(!isFullViewRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const fullViewLabel = isFullView
        ? tran('Exit full view')
        : tran('Full view');
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
                <div className="flex-fill d-flex justify-content-end align-items-center ms-2">
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
                    <div className="ms-2">
                        <i
                            className={
                                `bi bi-${
                                    isFullView
                                        ? 'fullscreen-exit'
                                        : 'arrows-fullscreen'
                                }` + ' app-caught-hover-pointer'
                            }
                            title={fullViewLabel}
                            aria-label={fullViewLabel}
                            onClick={handleToggleFullView}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
