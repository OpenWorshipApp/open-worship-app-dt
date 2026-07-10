import { useCallback, type MouseEvent } from 'react';

import CanvasItem, {
    useCanvasItemContext,
    useCanvasItemPropsContext,
    useSetEditingCanvasItem,
    useSetSelectedCanvasItems,
} from '../CanvasItem';
import { BoxEditorNormalImageRender } from './BoxEditorNormalViewImageModeComp';
import { BoxEditorNormalHtmlRender } from './BoxEditorNormalViewHtmlModeComp';
import { BoxEditorNormalTextRender } from './BoxEditorNormalViewTextModeComp';
import { BoxEditorNormalBibleRender } from './BoxEditorNormalViewBibleModeComp';
import { useCanvasControllerContext } from '../CanvasController';
import { BoxEditorNormalVideoRender } from './BoxEditorNormalViewVideoModeComp';
import { BENViewErrorRender } from './BoxEditorNormalViewErrorComp';
import { useBoxEditorControllerContext } from '../../BoxEditorController';
import { checkIsAppendSelectionModifier } from '../canvasSelectionHelpers';
import { useAppCurrentRef } from '../../../helper/appHooks';
import { getRotatedResizeCursor } from './boxEditorHelpers';
import { useToggleBibleLookupPopupContext } from '../../../others/commonButtons';

function BoxEditorCanvasItemRender() {
    const canvasItem = useCanvasItemContext();
    switch (canvasItem.type) {
        case 'image':
            return <BoxEditorNormalImageRender />;
        case 'video':
            return <BoxEditorNormalVideoRender />;
        case 'text':
            return <BoxEditorNormalTextRender />;
        case 'html':
            return <BoxEditorNormalHtmlRender />;
        case 'bible':
            return <BoxEditorNormalBibleRender />;
        default:
            return <BENViewErrorRender />;
    }
}

export default function BoxEditorControllingModeComp() {
    // TODO: move box by left right up down key, shift&ctl
    const canvasController = useCanvasControllerContext();
    const canvasItem = useCanvasItemContext();
    const boxEditorController = useBoxEditorControllerContext();
    const handleCanvasItemEditing = useSetEditingCanvasItem();
    const handleSelectCanvasItem = useSetSelectedCanvasItems();
    const showBibleLookupPopup = useToggleBibleLookupPopupContext();
    const canvasControllerRef = useAppCurrentRef(canvasController);
    const handleSelectCanvasItemRef = useAppCurrentRef(handleSelectCanvasItem);
    const canvasItemRef = useAppCurrentRef(canvasItem);
    const handleClick = useCallback((event: MouseEvent) => {
        event.stopPropagation();
        // Shift/Ctrl click on an already-selected box removes it from
        // the current selection.
        if (checkIsAppendSelectionModifier(event)) {
            handleSelectCanvasItemRef.current(canvasItemRef.current, {
                isAppend: true,
            });
        }
        canvasControllerRef.current.focusEditor();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleCanvasItemEditingRef = useAppCurrentRef(
        handleCanvasItemEditing,
    );
    const handleDoubleClick = useCallback((event: MouseEvent) => {
        event.stopPropagation();
        if (canvasItemRef.current.isLocked) {
            return;
        }
        handleCanvasItemEditingRef.current(canvasItemRef.current);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const props = useCanvasItemPropsContext();
    const isLocked = props.locked === true;
    return (
        <div
            className="editor-controller-box-wrapper"
            ref={(div) => {
                if (div === null || isLocked) {
                    return;
                }
                boxEditorController.initEvent(div, async (groupMoves) => {
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
                    // A single call so dragging a multi-selection lands as one
                    // undo step rather than one per box.
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
            }}
            style={{
                width: '0',
                height: '0',
                top: `${props.top + props.height / 2}px`,
                left: `${props.left + props.width / 2}px`,
                transform: `rotate(${props.rotate}deg)`,
            }}
        >
            <div
                className={
                    'app-box-editor controllable' + (isLocked ? ' locked' : '')
                }
                data-app-box-editor-id={canvasItem.id}
                onClick={handleClick}
                onContextMenu={canvasController.genHandleContextMenuOpening(
                    canvasItem,
                    handleCanvasItemEditing.bind(null, canvasItem),
                    true,
                    showBibleLookupPopup,
                )}
                onDoubleClick={handleDoubleClick}
                style={{
                    // The wrapper above owns the box's position, so this
                    // carries everything else `genBoxStyle` would give a
                    // non-selected box — `display: flex` included, or the
                    // renderer inside would lay itself out as a block and
                    // wrap its text at a different width than when
                    // unselected.
                    display: 'flex',
                    transform: 'translate(-50%, -50%)',
                    ...CanvasItem.genShapeBoxStyle(props),
                }}
            >
                <BoxEditorCanvasItemRender />
                {isLocked ? (
                    <div className="locked-indicator" title="Locked">
                        🔒
                    </div>
                ) : (
                    <div className="tools">
                        <div
                            className={`object ${boxEditorController.rotatorCN}`}
                        />
                        <div className="rotate-link" />
                        {Object.keys(boxEditorController.resizeActorList).map(
                            (className) => {
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
                            },
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
