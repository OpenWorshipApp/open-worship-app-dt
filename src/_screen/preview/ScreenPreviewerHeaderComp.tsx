import ContextMenuDotsButtonComp from '../../context-menu/ContextMenuDotsButtonComp';
import ShowHideScreen from './ShowHideScreen';
import MiniScreenClearControlComp from './MiniScreenClearControlComp';
import ItemColorNoteComp from '../../others/ItemColorNoteComp';
import {
    useScreenManagerBaseContext,
    useScreenManagerEvents,
} from '../managers/screenManagerHooks';
import { useCallback, useState } from 'react';
import ShowingScreenIconComp from './ShowingScreenIcon';
import { tran } from '../../lang/langHelpers';
import { useAppCurrentRef } from '../../helper/appHooks';
import { pressElementLikeButton } from '../../helper/helpers';
import { useIsMiniScreenNoRendering } from './miniScreenRenderingHelpers';

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
    const screenManagerBaseRef = useAppCurrentRef(screenManagerBase);
    const handleToggleLock = useCallback(() => {
        const screenManagerBase = screenManagerBaseRef.current;
        const newIsLocked = !screenManagerBase.isLocked;
        setIsLocked(newIsLocked);
        screenManagerBase.setIsLockedWithSyncGroup(newIsLocked);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const isFullViewRef = useAppCurrentRef(isFullView);
    const setIsFullViewRef = useAppCurrentRef(setIsFullView);
    const handleToggleFullView = useCallback(() => {
        setIsFullViewRef.current(!isFullViewRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const [isNoRendering, setIsNoRendering] = useIsMiniScreenNoRendering(
        screenManagerBase.screenId,
    );
    const handleToggleRendering = useCallback(() => {
        setIsNoRendering((isPreviousNoRendering) => {
            return !isPreviousNoRendering;
        });
    }, [setIsNoRendering]);
    const renderingLabel = isNoRendering
        ? tran('Resume rendering preview')
        : tran('Stop rendering preview');
    const fullViewLabel = isFullView
        ? tran('Exit full view')
        : tran('Full view');
    const lockLabel = isLocked ? tran('Unlock') : tran('Lock');
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
                    {/* Beside the clear buttons rather than with the card's
                        own controls on the right: it is about what this card
                        DRAWS, and the screen itself is unaffected. */}
                    <div className="ms-2 d-flex align-items-center">
                        <i
                            className={
                                `bi bi-${isNoRendering ? 'eye-slash' : 'eye'}` +
                                ' app-caught-hover-pointer'
                            }
                            style={
                                isNoRendering
                                    ? { color: 'var(--bs-warning)' }
                                    : undefined
                            }
                            role="button"
                            tabIndex={0}
                            title={renderingLabel}
                            aria-label={renderingLabel}
                            aria-pressed={isNoRendering}
                            onClick={handleToggleRendering}
                            onKeyDown={pressElementLikeButton}
                        />
                    </div>
                </div>
                <div className="flex-fill d-flex justify-content-end align-items-center ms-2">
                    <ShowingScreenIconComp
                        screenId={screenManagerBase.screenId}
                    />
                    <div className="ms-2">
                        <ItemColorNoteComp item={screenManagerBase} />
                    </div>
                    <div className="ms-2">
                        {/* Named, focusable and key-operable on purpose: this
                            was an anonymous <i> with an onClick, so a screen
                            reader announced nothing, the keyboard could not
                            reach it, and no tool could find it by label.
                            Every icon-control in this header and its footer
                            needs the same four things -- the fix used to stop
                            at this one, which left the Full view toggle beside
                            it out of the accessibility tree entirely. */}
                        <i
                            className={
                                `bi bi-${isLocked ? 'lock-fill' : 'unlock'}` +
                                ' app-caught-hover-pointer'
                            }
                            style={{ color: isLocked ? 'red' : 'green' }}
                            role="button"
                            tabIndex={0}
                            title={lockLabel}
                            aria-label={lockLabel}
                            aria-pressed={isLocked}
                            onClick={handleToggleLock}
                            onKeyDown={pressElementLikeButton}
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
                            role="button"
                            tabIndex={0}
                            title={fullViewLabel}
                            aria-label={fullViewLabel}
                            aria-pressed={isFullView}
                            onClick={handleToggleFullView}
                            onKeyDown={pressElementLikeButton}
                        />
                    </div>
                    {/* The screen's own menu — the one a right-click anywhere on
                        the preview gives. No handler: the card around this
                        header owns it. */}
                    <div className="ms-2">
                        <ContextMenuDotsButtonComp />
                    </div>
                </div>
            </div>
        </div>
    );
}
