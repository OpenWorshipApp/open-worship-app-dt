import {
    LinuxControlEnum,
    MacControlEnum,
    useKeyboardRegistering,
    WindowsControlEnum,
} from '../../event/KeyboardEventListener';
import { useDisplay } from '../../event/PresentEventListener';
import Slide from '../../slide-list/Slide';
import { useFSRefresh } from '../../slide-list/slideHelpers';
import MenuIsModifying from './MenuIsModifying';

export default function SlideItemsMenu({ slide }: { slide: Slide }) {
    const { presentDisplay } = useDisplay();
    useFSRefresh(['update'], slide.fileSource);
    const eventMapper = {
        wControlKey: [WindowsControlEnum.Ctrl],
        mControlKey: [MacControlEnum.Ctrl],
        lControlKey: [LinuxControlEnum.Ctrl],
        key: 's',
    };
    useKeyboardRegistering(eventMapper, () => slide.save());
    const foundWrongDimension = slide.checkIsWrongDimension(presentDisplay);
    const editCacheManager = slide.editingCacheManager;
    const undo = editCacheManager.undoQueue;
    const redo = editCacheManager.redoQueue;
    const isHavingHistories = !!undo.length || !!redo.length;
    return (
        <div style={{
            borderBottom: '1px solid #00000024',
            backgroundColor: '#00000020',
            minHeight: (isHavingHistories || slide.isChanged) ? '35px' : '0px',
        }}>
            <div className='btn-group control d-flex justify-content-center'>
                {!!undo.length &&
                    <button type='button' className='btn btn-sm btn-info'
                        title='clear all'
                        onClick={() => {
                            editCacheManager.popUndo();
                        }}>
                        undo
                        <i className='bi bi-arrow-90deg-left'></i></button>
                }
                {!!redo.length &&
                    <button type='button' className='btn btn-sm btn-info'
                        title='clear background'
                        onClick={() => {
                            editCacheManager.popRedo();
                        }}>
                        redo
                        <i className='bi bi-arrow-90deg-right'></i></button>
                }
                <MenuIsModifying slide={slide}
                    isHavingHistories={isHavingHistories}
                    eventMapper={eventMapper} />
                {foundWrongDimension !== null &&
                    <button type='button' className='btn btn-sm btn-warning'
                        title={Slide.toWrongDimensionString(foundWrongDimension)}
                        onClick={() => slide.fixSlideDimension(presentDisplay)}>
                        Fix Slide Dimension</button>
                }
            </div>
        </div>
    );
}
