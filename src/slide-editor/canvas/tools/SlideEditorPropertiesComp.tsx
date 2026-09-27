import { tran } from '../../../lang/langHelpers';
import type CanvasItem from '../CanvasItem';
import CanvasItemPropsEditorComp from './CanvasItemPropsEditorComp';
import SlidePropertyEditorComp from './SlidePropertyEditorComp';

export default function SlideEditorPropertiesComp({
    canvasItems,
}: Readonly<{
    canvasItems: CanvasItem<any>[];
}>) {
    return (
        <div
            className="d-flex flex-column w-100 h-100 p-1"
            style={{
                // `auto`, never `hidden`: focusing a field scrolls this box
                // sideways to show it, and with `hidden` there was no way back
                // -- labels stayed cut off on the left until a reload.
                overflowX: 'auto',
            }}
        >
            <SlidePropertyEditorComp />
            {canvasItems.length === 0 ? (
                <div className="d-flex justify-content-center align-items-center h-100">
                    <div>
                        <h2 className="text-muted">
                            {tran('No canvas item selected')}
                        </h2>
                        <hr />
                        <h3 className="text-muted">
                            {tran('Please select an item to edit')}
                        </h3>
                    </div>
                </div>
            ) : null}
            {canvasItems.map((canvasItem) => {
                return (
                    <CanvasItemPropsEditorComp
                        key={canvasItem.id}
                        canvasItem={canvasItem}
                    />
                );
            })}
        </div>
    );
}
