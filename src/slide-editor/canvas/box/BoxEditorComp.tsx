import { useCallback, useMemo, useRef, type MouseEvent } from 'react';

import { tran } from '../../../lang/langHelpers';
import { useSlideCanvasScale } from '../canvasEventHelpers';
import BoxEditorController from '../../BoxEditorController';
import CanvasItem, {
    useCanvasItemContext,
    useCanvasItemPropsContext,
    useEditingCanvasItemAndSetterContext,
    useIsCanvasItemSelected,
    useSelectedCanvasItemsAndSetterContext,
    useSetEditingCanvasItem,
    useSetSelectedCanvasItems,
} from '../CanvasItem';
import { useCanvasControllerContext } from '../CanvasController';
import { useCanvasSnapContext } from '../canvasSnapGuideHelpers';
import { checkIsAppendSelectionModifier } from '../canvasSelectionHelpers';
import { useAppCurrentRef, useAppEffect } from '../../../helper/appHooks';
import { getRotatedResizeCursor } from './boxEditorHelpers';
import { useToggleBibleLookupPopupContext } from '../../../others/commonButtons';
import BoxEditorCanvasItemRenderComp from './BoxEditorCanvasItemRenderComp';
import BoxEditorNormalTextEditModeComp from './BoxEditorNormalTextEditModeComp';
import { genErrorContextMenuHandler } from './BoxEditorNormalViewErrorComp';

// TODO: switch box by tab, shift
// TODO: key => ctl+d, delete, copy&paste, paste across slide
// TODO: move box by left right up down key, shift&ctl

// A box is in exactly one of three states — plain, selected (controlling) and
// text editing; selecting clears editing and vice versa (see
// `canvasEditingHelpers`). All three share ONE element tree: the state only
// changes class names, handlers and what is rendered NEXT TO the content. The
// content renderer itself never moves, so React keeps its DOM — switching
// state used to unmount the whole subtree and restart every `<video>`,
// `<iframe>` and camera stream on the canvas.
export function BoxEditorComp() {
    const canvasController = useCanvasControllerContext();
    const canvasItem = useCanvasItemContext();
    const props = useCanvasItemPropsContext();
    const scale = useSlideCanvasScale(canvasController);
    const isSelected = useIsCanvasItemSelected();
    const { canvasItem: editingCanvasItem } =
        useEditingCanvasItemAndSetterContext();
    const { canvasItems: selectedCanvasItems } =
        useSelectedCanvasItemsAndSetterContext();
    const snapContext = useCanvasSnapContext();
    const handleCanvasItemEditing = useSetEditingCanvasItem();
    const handleSelectCanvasItem = useSetSelectedCanvasItems();
    const showBibleLookupPopup = useToggleBibleLookupPopupContext();

    const isLocked = props.locked === true;
    // Only a text box has an editing mode; double-clicking anything else just
    // takes it out of the selection.
    const isEditing =
        canvasItem === editingCanvasItem && canvasItem.type === 'text';
    // A locked box keeps its outline but no drag/resize/rotate engine.
    const shouldControl = isSelected && !isLocked;

    // One controller per box for its whole life: a fresh one per render (what
    // this used to do) also re-registered every pointer listener on every
    // render.
    const boxEditorController = useMemo(() => {
        return new BoxEditorController(1);
    }, []);
    boxEditorController.scaleFactor = scale;
    if (shouldControl) {
        boxEditorController.lockAspectRatio = canvasItem.shouldLockAspectRatio;
        boxEditorController.getSnapTargets = snapContext.getSnapTargets;
        boxEditorController.onSnapping = snapContext.setSnapLines;
        // Resolved when a drag starts rather than on every render, and locked
        // items stay put even when dragged as part of a multi-selection.
        boxEditorController.getMoveGroupIds = () => {
            return selectedCanvasItems
                .filter((item) => {
                    return !item.isLocked;
                })
                .map((item) => {
                    return item.id;
                });
        };
    }

    const canvasControllerRef = useAppCurrentRef(canvasController);
    const canvasItemRef = useAppCurrentRef(canvasItem);
    const isSelectedRef = useAppCurrentRef(isSelected);
    const isEditingRef = useAppCurrentRef(isEditing);
    const handleSelectCanvasItemRef = useAppCurrentRef(handleSelectCanvasItem);
    const handleCanvasItemEditingRef = useAppCurrentRef(
        handleCanvasItemEditing,
    );

    const wrapperRef = useRef<HTMLDivElement | null>(null);
    useAppEffect(() => {
        const wrapperElement = wrapperRef.current;
        if (wrapperElement === null || !shouldControl) {
            return;
        }
        boxEditorController.initEvent(wrapperElement, async (groupMoves) => {
            const canvasController = canvasControllerRef.current;
            const canvasItem = canvasItemRef.current;
            const info = boxEditorController.getInfo();
            if (info === null) {
                return;
            }
            if (groupMoves.length === 0) {
                canvasController.editCanvasItemById(
                    canvasItem.id,
                    (latestCanvasItem) => {
                        latestCanvasItem.applyProps(info);
                    },
                );
                return;
            }
            // A single call so dragging a multi-selection lands as one undo
            // step rather than one per box.
            const movesById = new Map(
                groupMoves.map(({ id, ...props }) => {
                    return [id, props];
                }),
            );
            canvasController.editCanvasItemsByIds(
                [canvasItem.id, ...movesById.keys()],
                (latestCanvasItem) => {
                    latestCanvasItem.applyProps(
                        movesById.get(latestCanvasItem.id) ?? info,
                    );
                },
            );
        });
        return () => {
            boxEditorController.release();
        };
    }, [shouldControl, boxEditorController]);

    const handleClick = useCallback((event: MouseEvent) => {
        event.stopPropagation();
        if (isEditingRef.current) {
            // Focusing the editor here would pull focus out of the textarea.
            return;
        }
        const isAppend = checkIsAppendSelectionModifier(event);
        // Shift/Ctrl click toggles the box within the current selection; a
        // plain click on an already-selected box leaves the selection alone
        // so it can be dragged as a group.
        if (!isSelectedRef.current || isAppend) {
            handleSelectCanvasItemRef.current(canvasItemRef.current, {
                isAppend,
            });
        }
        canvasControllerRef.current.focusEditor();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleDoubleClick = useCallback((event: MouseEvent) => {
        event.stopPropagation();
        if (!isSelectedRef.current || canvasItemRef.current.isLocked) {
            return;
        }
        handleCanvasItemEditingRef.current(canvasItemRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // An error box is a broken item: the only useful actions are getting rid
    // of it and reading what went wrong.
    const handleContextMenu =
        canvasItem.type === 'error'
            ? genErrorContextMenuHandler(canvasController, canvasItem)
            : canvasController.genHandleContextMenuOpening(
                  canvasItem,
                  handleCanvasItemEditing.bind(null, canvasItem),
                  isSelected,
                  showBibleLookupPopup,
              );

    let boxClassName = 'app-box-editor';
    if (isSelected) {
        boxClassName += ' controllable' + (isLocked ? ' locked' : '');
    } else {
        boxClassName +=
            ' shadow-caught-hover-pointer' + (isEditing ? ' editable' : '');
    }
    return (
        <div
            className={
                'editor-controller-box-wrapper' +
                (shouldControl ? ' controlling' : '')
            }
            ref={wrapperRef}
            style={{
                width: '0',
                height: '0',
                top: `${props.top + props.height / 2}px`,
                left: `${props.left + props.width / 2}px`,
                transform: `rotate(${props.rotate}deg)`,
            }}
        >
            <div
                className={boxClassName}
                data-app-box-editor-id={canvasItem.id}
                onClick={handleClick}
                onDoubleClick={handleDoubleClick}
                // While editing, the textarea's own wrapper commits the draft
                // instead of opening a menu.
                onContextMenu={isEditing ? undefined : handleContextMenu}
                style={{
                    // The wrapper above owns the box's position, so this
                    // carries everything else `genBoxStyle` would give it —
                    // `display: flex` included, or the renderer inside would
                    // lay itself out as a block and wrap its text at a
                    // different width than the screen output does.
                    display: 'flex',
                    transform: 'translate(-50%, -50%)',
                    ...CanvasItem.genShapeBoxStyle(props),
                }}
            >
                {isEditing ? (
                    <BoxEditorNormalTextEditModeComp />
                ) : (
                    <BoxEditorCanvasItemRenderComp />
                )}
                {isSelected ? (
                    isLocked ? (
                        <div
                            className="locked-indicator"
                            title={tran('Locked')}
                        >
                            🔒
                        </div>
                    ) : (
                        <div className="tools">
                            <div
                                className={`object ${boxEditorController.rotatorCN}`}
                            />
                            <div className="rotate-link" />
                            {Object.keys(
                                boxEditorController.resizeActorList,
                            ).map((className) => {
                                return (
                                    <div
                                        key={className}
                                        className={`object ${className}`}
                                        style={{
                                            cursor: getRotatedResizeCursor(
                                                className,
                                                props.rotate,
                                            ),
                                        }}
                                    />
                                );
                            })}
                        </div>
                    )
                ) : null}
            </div>
        </div>
    );
}
