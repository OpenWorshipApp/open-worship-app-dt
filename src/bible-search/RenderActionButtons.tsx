import { useCallback } from 'react';
import KeyboardEventListener, {
    EventMapper as KBEventMapper, useKeyboardRegistering,
} from '../event/KeyboardEventListener';
import SlideItem from '../slide-list/SlideItem';
import {
    addBibleItem, AddBiblePropsType, updateBibleItem,
} from '../helper/bible-helpers/bibleHelpers';
import PresentFTManager from '../_present/PresentFTManager';
import {
    useWindowIsEditingMode, useWindowIsPresentingMode, useWindowMode,
} from '../router/routeHelpers';
import { useModalTypeData } from '../app-modal/helpers';
import { useCloseAppModal } from '../app-modal/LinkToAppModal';
import RenderKeepWindowOpen, {
    getIsKeepWindowOpen,
} from './RenderKeepWindowOpen';

const presentEventMapper: KBEventMapper = {
    wControlKey: ['Ctrl', 'Shift'],
    mControlKey: ['Ctrl', 'Shift'],
    lControlKey: ['Ctrl', 'Shift'],
    key: 'Enter',
};

const addListEventMapper: KBEventMapper = {
    wControlKey: ['Ctrl'],
    mControlKey: ['Ctrl'],
    lControlKey: ['Ctrl'],
    key: 'Enter',
};

export default function RenderActionButtons(props: AddBiblePropsType) {
    const closeModal = useCloseAppModal();
    const { data } = useModalTypeData();
    const windowMode = useWindowMode();
    const isBibleEditing = !!data;
    // TODO: fix slide select editing
    const isSlideSelectEditing = !!SlideItem.getSelectedEditingResult();
    const isWindowEditing = useWindowIsEditingMode();
    const isWindowPresenting = useWindowIsPresentingMode();
    const addOrUpdateBibleItem = useCallback(async () => {
        const isKeepWindowOpen = getIsKeepWindowOpen();
        if (!isKeepWindowOpen) {
            closeModal();
        }
        if (isBibleEditing) {
            return updateBibleItem(props, data);
        } else {
            return addBibleItem(props, windowMode);
        }
    }, [props, data, isBibleEditing, closeModal, windowMode]);
    const addBibleItemAndPresent = useCallback(async (event: any) => {
        const bibleItem = await addOrUpdateBibleItem();
        if (bibleItem !== null) {
            if (isWindowPresenting) {
                PresentFTManager.ftBibleItemSelect(event, [bibleItem]);
            }
        }
    }, [addOrUpdateBibleItem, isWindowPresenting]);
    useKeyboardRegistering(addListEventMapper, () => {
        addOrUpdateBibleItem();
    });
    useKeyboardRegistering(presentEventMapper, (event) => {
        addBibleItemAndPresent(event);
    });
    const getAddingTitle = () => {
        if (isWindowEditing) {
            return 'Add to Slide';
        }
        return isBibleEditing ? 'Save Bible Item' : 'Add Bible Item';
    };
    return (
        <>
            {isBibleEditing ? null :
                <RenderKeepWindowOpen />}
            <div className='btn-group mx-1'>
                {isWindowEditing && !isSlideSelectEditing ? null :
                    <button type='button'
                        className='btn btn-sm btn-info'
                        onClick={addOrUpdateBibleItem}
                        data-tool-tip={KeyboardEventListener
                            .toShortcutKey(addListEventMapper)}>
                        <i className='bi bi-plus-lg' />
                        {getAddingTitle()}
                    </button>}
                {isWindowPresenting && <button type='button'
                    className='btn btn-sm btn-info ms-1'
                    onClick={addBibleItemAndPresent}
                    data-tool-tip={KeyboardEventListener
                        .toShortcutKey(presentEventMapper)}>
                    <i className='bi bi-easel' />
                    {isBibleEditing ? 'Save and Present' : 'Present'}
                </button>}
            </div>
        </>
    );
}
