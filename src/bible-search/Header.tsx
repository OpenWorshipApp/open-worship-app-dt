import { useTranslation } from 'react-i18next';
import {
    EventMapper,
    keyboardEventListener,
    useKeyboardRegistering,
} from '../event/KeyboardEventListener';
import { closeBibleSearch } from './HandleBibleSearch';

export default function Header() {
    const { t } = useTranslation();
    const eventMapper: EventMapper = {
        wControlKey: ['Ctrl'],
        mControlKey: ['Ctrl'],
        lControlKey: ['Ctrl'],
        key: 'q',
    };
    useKeyboardRegistering(eventMapper, closeBibleSearch);
    return (
        <div className='card-header text-center w-100'>
            <span>📖 {t('bible-search')}</span>
            <button type='button' onClick={closeBibleSearch}
                data-tool-tip={keyboardEventListener.toShortcutKey(eventMapper)}
                className='tool-tip tool-tip-fade tool-tip-left btn-close float-end'></button>
        </div>
    );
}
