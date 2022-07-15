import './EditorControllerBoxWrapper.scss';

import { boxEditorController } from '../BoxEditorController';
import CanvasItem from './CanvasItem';
import { showBoxContextMenu, useCCRefresh } from './canvasHelpers';
import BoxEditorRenderText from './BoxEditorRenderText';

export default function BoxEditorControllingMod({ canvasItem }: {
    canvasItem: CanvasItem,
}) {
    const canvasController = canvasItem.canvasController;
    if (canvasController === null) {
        return null;
    }
    useCCRefresh(canvasController, ['update']);
    return (
        <div className="editor-controller-box-wrapper"
            ref={(div) => {
                if (div !== null) {
                    boxEditorController.release();
                    boxEditorController.initEvent(div);
                }
            }}
            style={{
                width: '0',
                height: '0',
                top: `${canvasItem.props.top + canvasItem.props.height / 2}px`,
                left: `${canvasItem.props.left + canvasItem.props.width / 2}px`,
                transform: `rotate(${canvasItem.props.rotate}deg)`,
                zIndex: canvasItem.props.zIndex,
            }}>
            <div className={'box-editor controllable'}
                onContextMenu={(e) => {
                    e.stopPropagation();
                    showBoxContextMenu(e, canvasController, canvasItem);
                }}
                onDoubleClick={(e) => {
                    e.stopPropagation();
                    canvasItem.isEditing = true;
                }}
                style={{
                    border: canvasItem.isSelected ? '2px dashed green' : undefined,
                    transform: 'translate(-50%, -50%)',
                    width: `${canvasItem.props.width}px`,
                    height: `${canvasItem.props.height}px`,
                }}>
                <div className='w-100 h-100' style={canvasItem.style}>
                    <BoxEditorRenderText text={canvasItem.props.text} />
                </div>
                <div className='tools'>
                    <div className={`object ${boxEditorController.rotatorCN}`} />
                    <div className="rotate-link" />
                    {Object.keys(boxEditorController.resizeActorList)
                        .map((cn, i) => <div key={`${i}`}
                            className={`object ${cn}`} />)
                    }
                </div>
            </div>
        </div>
    );
}
