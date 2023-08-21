import {
    EventMapper as KBEventMapper,
    toShortcutKey,
    useKeyboardRegistering,
} from '../event/KeyboardEventListener';
import { tran } from '../lang';
import LinkToAppModal, {
    useOpenAppModal,
} from '../app-modal/LinkToAppModal';
import { AppModalType } from '../app-modal/helpers';

export function useOpenBibleSearch() {
    return useOpenAppModal(AppModalType.BIBLE_SEARCH);
}

export default function BibleSearchHeader() {
    const openBibleSearch = useOpenBibleSearch();
    const eventMapper: KBEventMapper = {
        wControlKey: ['Ctrl'],
        mControlKey: ['Ctrl'],
        lControlKey: ['Ctrl'],
        key: 'b',
    };
    useKeyboardRegistering(eventMapper, openBibleSearch);
    return (
        <LinkToAppModal modalType={AppModalType.BIBLE_SEARCH}>
            <button className='btn btn-labeled btn-primary'
                style={{ width: '220px' }}
                data-tool-tip={toShortcutKey(eventMapper)}
                type='button'>
                <span className='btn-label'>
                    <i className='bi bi-book' />
                </span>
                {tran('bible-search')}
            </button>
        </LinkToAppModal>
    );
}
