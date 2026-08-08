import { tran } from '../../../lang/langHelpers';
import type CanvasController from '../CanvasController';
import { canvasInsertActionList } from '../canvasInsertActionHelpers';
import { handleError } from '../../../helper/errorHelpers';

/**
 * The insert actions as a visible button row above the canvas.
 *
 * Third consumer of `canvasInsertActionList`, alongside the canvas right-click
 * menu and the app's Insert menu — an operator should not have to discover a
 * context menu to find out what a slide accepts.
 *
 * No event is passed to `handle`: the button's own click coordinates are
 * meaningless as an insertion point (they are over the toolbar, not the slide),
 * so the new box is centered — see `CanvasController.getInsertPosition`.
 */
export default function SlideEditorInsertToolbarComp({
    canvasController,
}: Readonly<{ canvasController: CanvasController }>) {
    return (
        <div className="slide-editor-insert-toolbar w-100 d-flex">
            {canvasInsertActionList.map((action) => {
                const label = tran(action.label);
                return (
                    <button
                        key={action.key}
                        type="button"
                        className="btn btn-sm btn-outline-info"
                        title={label}
                        onClick={() => {
                            Promise.resolve(
                                action.handle(canvasController),
                            ).catch(handleError);
                        }}
                    >
                        <i className={`bi bi-${action.iconName}`} />
                        <span className="ps-1">{label}</span>
                    </button>
                );
            })}
        </div>
    );
}
