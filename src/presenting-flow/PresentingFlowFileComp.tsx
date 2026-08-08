import { useCallback, useMemo, useState } from 'react';

import type { ContextMenuItemType } from '../context-menu/appContextMenuHelpers';
import {
    createMouseEvent,
    showAppContextMenu,
} from '../context-menu/appContextMenuHelpers';
import { genContextMenuItemIcon } from '../context-menu/contextMenuIconHelpers';
import type { AppDocumentSourceAbs } from '../helper/AppEditableDocumentSourceAbs';
import { useAppEffect, useAppCurrentRef } from '../helper/appHooks';
import FileSource from '../helper/FileSource';
import { useStateSettingBoolean } from '../helper/settingHelpers';
import { tran } from '../lang/langHelpers';
import FileItemHandlerComp from '../others/FileItemHandlerComp';
import FileReadErrorComp from '../others/FileReadErrorComp';
import LoadingComp from '../others/LoadingComp';
import PresentingFlow from './PresentingFlow';
import type {
    PresentingFlowActionArmingType,
    PresentingFlowActionType,
} from './presentingFlowActionHelpers';
import {
    checkIsPresentingFlowActionGroup,
    presentingFlowActionMenuList,
} from './presentingFlowActionHelpers';
import {
    askForPresentingFlowActionArming,
    askForPresentingFlowActionScreenIds,
} from './presentingFlowActionArmingHelpers';
import { exportPresentingFlow } from './presentingFlowArchiveHelpers';
import { usePresentingFlowItems } from './presentingFlowItemsHelpers';
import { checkIsPresentingFlowFilePathOnScreen } from './presentingFlowOnScreenHelpers';
import PresentingFlowItemComp from './PresentingFlowItemComp';
import {
    extractDropPayload,
    presentingFlowDraggingStore,
    toPresentingFlowSettingName,
    UNSUPPORTED_DROP_PAYLOAD,
} from './presentingFlowHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import {
    setPresentingFlowPreviewFilePath,
    togglePresentingFlowPreviewFilePath,
    usePresentingFlowPreviewFilePath,
} from './presentingFlowPreviewFloatingHelpers';

function PresentingFlowItemsComp({
    presentingFlow,
}: Readonly<{
    presentingFlow: PresentingFlow;
}>) {
    const presentingFlowItems = usePresentingFlowItems(presentingFlow.filePath);
    if (presentingFlowItems === undefined) {
        return (
            <div
                style={{ minHeight: '1.5rem' }}
                className="d-flex align-items-center justify-content-center"
            >
                <LoadingComp />
            </div>
        );
    }
    if (presentingFlowItems === null) {
        return <FileReadErrorComp />;
    }
    if (presentingFlowItems.length === 0) {
        return (
            <div className="app-presenting-flow-row app-presenting-flow-row-empty">
                {tran('Drop items here')}
            </div>
        );
    }
    return (
        <>
            {presentingFlowItems.map((presentingFlowItem, i) => {
                return (
                    <PresentingFlowItemComp
                        key={`${presentingFlowItem.type}-${i}`}
                        presentingFlow={presentingFlow}
                        presentingFlowItem={presentingFlowItem}
                        index={i}
                        itemCount={presentingFlowItems.length}
                    />
                );
            })}
        </>
    );
}

function PresentingFlowPreviewComp({
    isOpened,
    setIsOpened,
    presentingFlow,
}: Readonly<{
    isOpened: boolean;
    setIsOpened: (isOpened: boolean) => void;
    presentingFlow: PresentingFlow;
}>) {
    const fileSource = FileSource.getInstance(presentingFlow.filePath);
    const previewingFilePath = usePresentingFlowPreviewFilePath();
    const isOpenedRef = useAppCurrentRef(isOpened);
    const setIsOpenedRef = useAppCurrentRef(setIsOpened);
    const handleToggleOpened = useCallback(() => {
        setIsOpenedRef.current(!isOpenedRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const presentingFlowRef = useAppCurrentRef(presentingFlow);
    const handlePreviewToggling = useCallback((event: any) => {
        event.stopPropagation();
        togglePresentingFlowPreviewFilePath(presentingFlowRef.current.filePath);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
        <div className="w-100 app-presenting-flow">
            <div
                className="app-presenting-flow-header d-flex align-items-center"
                onClick={handleToggleOpened}
            >
                <i className={`bi bi-chevron-${isOpened ? 'down' : 'right'}`} />
                <span className="app-ellipsis flex-fill ps-1">
                    {fileSource.name}
                </span>
                <i
                    className={
                        'bi bi-window-stack app-caught-hover-pointer px-1' +
                        (previewingFilePath === presentingFlow.filePath
                            ? ' app-presenting-flow-preview-showing'
                            : '')
                    }
                    title={tran('Preview Presenting Flow')}
                    onClick={handlePreviewToggling}
                />
            </div>
            {isOpened ? (
                <PresentingFlowItemsComp presentingFlow={presentingFlow} />
            ) : null}
        </div>
    );
}

export default function PresentingFlowFileComp({
    index,
    filePath,
}: Readonly<{
    index: number;
    filePath: string;
}>) {
    const [presentingFlow, setPresentingFlow] = useState<
        PresentingFlow | null | undefined
    >(undefined);
    const presentingFlowRef = useAppCurrentRef(presentingFlow);
    const settingName = toPresentingFlowSettingName(
        'presenting-flow-opened',
        filePath,
    );
    const [isOpened, setIsOpened] = useStateSettingBoolean(settingName);
    // Deliberately NOT re-created on file update. The instance holds no content
    // — `getItems()` re-reads the file every time — and dropping it back to
    // `undefined` on every add/remove flashed the row back to a spinner (and
    // raced the next drop, which bails out while there is no presenting flow yet).
    // `PresentingFlowItemsComp` listens for the same event and re-reads the items.
    const handleReloading = useCallback(() => {
        presentingFlowRef.current?.fileSource.fireUpdateEvent();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const setIsOpenedRef = useAppCurrentRef(setIsOpened);
    const contextMenuItems = useMemo((): ContextMenuItemType[] => {
        const genActionMenuItem = (
            action: PresentingFlowActionType,
        ): ContextMenuItemType => {
            return {
                childBefore: genContextMenuItemIcon(action.iconName, {
                    color: action.color,
                }),
                menuElement: tran(action.label),
                onSelect: async () => {
                    // A run action armed with a NUMBER — or with a time of day,
                    // or with a SHORTCUT — is asked for it BEFORE the entry
                    // exists: a clock without one is not a valid entry
                    // (`PresentingFlowItem.validate`) and a shortcut must be free
                    // before the line is written, so a cancelled question must
                    // add nothing. One armed with something else — a `Jump to`
                    // takes the CC attached to it afterwards — asks nothing and
                    // is added straight away.
                    let arming: PresentingFlowActionArmingType | undefined;
                    let screenIds: number[] | undefined;
                    if (
                        action.target === 'run' &&
                        (action.number !== null || action.canBeKeyArmed)
                    ) {
                        const answer =
                            await askForPresentingFlowActionArming(action);
                        if (answer === null) {
                            return;
                        }
                        arming = answer;
                    } else if (
                        action.target === 'screen' &&
                        action.requiresScreenIds
                    ) {
                        // The screen family's half of the same question: a
                        // `Screen: Show` that named no screen would fall back to
                        // whatever is selected, which is the one thing it may
                        // never do. Asked here, so a cancelled answer adds
                        // nothing.
                        const answer =
                            await askForPresentingFlowActionScreenIds(action);
                        if (answer === null) {
                            return;
                        }
                        screenIds = answer;
                    }
                    const isAdded = await PresentingFlow.getInstance(
                        filePath,
                    ).addActionItem(action.id, arming, undefined, screenIds);
                    if (isAdded) {
                        setIsOpenedRef.current(true);
                    }
                },
            };
        };
        return [
            {
                childBefore: genContextMenuItemIcon('window-stack'),
                menuElement: tran('Open Preview'),
                onSelect: () => {
                    setPresentingFlowPreviewFilePath(filePath);
                },
            },
            {
                // A generic icon on purpose: clearing is only the first family
                // of actions this menu offers.
                childBefore: genContextMenuItemIcon('lightning-charge'),
                menuElement: tran('Add Action'),
                // A second menu opened from this one's event, the way colour
                // notes are chosen — the action list is short and fixed, so the
                // pair reads as one nested menu.
                onSelect: (event) => {
                    event.stopPropagation();
                    showAppContextMenu(
                        event as MouseEvent,
                        presentingFlowActionMenuList.map((entry) => {
                            if (!checkIsPresentingFlowActionGroup(entry)) {
                                return genActionMenuItem(entry);
                            }
                            // A FAMILY, not an action: it adds nothing and opens
                            // a menu of its own. A chevron says so before it is
                            // clicked — every other row here writes a line into
                            // the run sheet.
                            return {
                                childBefore: genContextMenuItemIcon(
                                    entry.iconName,
                                    { color: entry.color },
                                ),
                                childAfter:
                                    genContextMenuItemIcon('chevron-right'),
                                menuElement: tran(entry.label),
                                onSelect: (subEvent: any) => {
                                    subEvent.stopPropagation();
                                    // The host closes this menu around
                                    // `onSelect`, so the event is spent by the
                                    // time the third level opens — its
                                    // coordinates are kept and a fresh event
                                    // synthesized at them, exactly as the
                                    // screen-pin checklist reopens itself.
                                    const { clientX, clientY } = subEvent;
                                    showAppContextMenu(
                                        createMouseEvent(clientX, clientY),
                                        entry.actionList.map(genActionMenuItem),
                                    );
                                },
                            };
                        }),
                    );
                },
            },
            {
                childBefore: genContextMenuItemIcon('file-earmark-arrow-down'),
                menuElement: tran('Export'),
                onSelect: () => {
                    exportPresentingFlow(PresentingFlow.getInstance(filePath));
                },
            },
        ];
    }, [filePath, setIsOpenedRef]);
    const handleDropping = useCallback(async (event: any) => {
        // An item dragged out of a presenting flow row is being reordered inside its
        // own list; that is handled by the row it lands on, not here.
        if (
            presentingFlowRef.current === null ||
            presentingFlowRef.current === undefined
        ) {
            return;
        }
        if (presentingFlowDraggingStore.current !== null) {
            return;
        }
        const payload = extractDropPayload(event);
        if (payload === null) {
            return;
        }
        if (payload === UNSUPPORTED_DROP_PAYLOAD) {
            showSimpleToast(
                tran('Adding Presenting Flow Item'),
                tran('This item type cannot be added to a presenting flow'),
            );
            return;
        }
        const isAdded = await presentingFlowRef.current.addItem(
            payload.droppedData,
            payload.dragData,
        );
        if (isAdded) {
            setIsOpenedRef.current(true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleChildRendering = useCallback(
        (presentingFlow: AppDocumentSourceAbs) => {
            return (
                <PresentingFlowPreviewComp
                    isOpened={isOpened}
                    setIsOpened={setIsOpened}
                    presentingFlow={presentingFlow as PresentingFlow}
                />
            );
        },
        [isOpened, setIsOpened],
    );
    useAppEffect(() => {
        if (presentingFlow !== undefined) {
            return;
        }
        setPresentingFlow(PresentingFlow.getInstance(filePath));
    }, [presentingFlow, filePath]);
    return (
        <FileItemHandlerComp
            index={index}
            fileData={presentingFlow}
            reload={handleReloading}
            filePath={filePath}
            className="presenting-flow-file"
            contextMenuItems={contextMenuItems}
            onDrop={handleDropping}
            renderChild={handleChildRendering}
            isSelected={isOpened}
            checkIsOnScreen={checkIsPresentingFlowFilePathOnScreen}
        />
    );
}
