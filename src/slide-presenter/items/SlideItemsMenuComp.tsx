import { getDefaultScreenDisplay } from '../../_screen/managers/screenHelpers';
import {
    EventMapper as KBEventMapper,
    useKeyboardRegistering,
} from '../../event/KeyboardEventListener';
import EditingHistoryManager, {
    useEditingHistoryStatus,
} from '../../others/EditingHistoryManager';
import {
    useSelectedVaryAppDocumentContext,
    useSlideWrongDimension,
} from '../../slide-list/appDocumentHelpers';
import AppDocument, { WrongDimensionType } from '../../slide-list/AppDocument';
import MenuIsModifying from './MenuIsModifying';

const savingEventMapper: KBEventMapper = {
    allControlKey: ['Ctrl'],
    key: 's',
};

function CheckingDimensionComp({
    wrongDimension,
}: Readonly<{
    wrongDimension: WrongDimensionType;
}>) {
    const selectedSlide = useSelectedVaryAppDocumentContext();
    const screenDisplay = getDefaultScreenDisplay();
    return (
        <button
            type="button"
            className="btn btn-sm btn-warning"
            title={
                'Fix slide dimension: ' +
                AppDocument.toWrongDimensionString(wrongDimension)
            }
            onClick={() => {
                selectedSlide.fixSlideDimension(screenDisplay);
            }}
        >
            <i className="bi bi-hammer" />
        </button>
    );
}

export default function SlideItemsMenuComp() {
    const selectedSlide = useSelectedVaryAppDocumentContext();
    const screenDisplay = getDefaultScreenDisplay();
    const { canUndo, canRedo, canSave } = useEditingHistoryStatus(
        selectedSlide.filePath,
    );
    const editingHistoryManager = EditingHistoryManager.getInstance(
        selectedSlide.filePath,
    );

    useKeyboardRegistering([savingEventMapper], () => {
        editingHistoryManager.save();
    });
    const wrongDimension = useSlideWrongDimension(selectedSlide, screenDisplay);
    if (!canSave && !wrongDimension) {
        return null;
    }
    return (
        <div
            style={{
                borderBottom: '1px solid #00000024',
                backgroundColor: '#00000020',
                minHeight: '35px',
            }}
        >
            <div className="btn-group control d-flex justify-content-center">
                <button
                    type="button"
                    className="btn btn-sm btn-info"
                    title="Undo"
                    disabled={!canUndo}
                    onClick={() => {
                        editingHistoryManager.undo();
                    }}
                >
                    <i className="bi bi-arrow-90deg-left" />
                </button>
                <button
                    type="button"
                    className="btn btn-sm btn-info"
                    title="Redo"
                    disabled={canRedo}
                    onClick={() => {
                        editingHistoryManager.redo();
                    }}
                >
                    <i className="bi bi-arrow-90deg-right" />
                </button>
                <MenuIsModifying eventMapper={savingEventMapper} />
                {wrongDimension !== null ? (
                    <CheckingDimensionComp wrongDimension={wrongDimension} />
                ) : null}
            </div>
        </div>
    );
}
