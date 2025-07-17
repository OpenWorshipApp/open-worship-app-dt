import BibleItem from '../bible-list/BibleItem';
import { toInputText } from '../helper/bible-helpers/serverBibleHelpers2';
import { useAppStateAsync } from '../helper/debuggerHelpers';

export default function SettingAboutComp() {
    const bookKey = 'PSA';
    const bibleItem = BibleItem.fromData('KJV', bookKey, 150, 6, 6);
    const [text] = useAppStateAsync(() => {
        return bibleItem.toText();
    }, [bibleItem]);
    const [title] = useAppStateAsync(() => {
        return toInputText('KJV', bookKey, 150, 6, 6);
    });
    const onClick = () => {
        const url = 'https://github.com/OpenWorshipApp/open-worship-app-dt';
        window.open(url, '_blank');
    };
    return (
        <div>
            <div
                className="card border-success mb-3 mx-auto mt-5"
                style={{
                    maxWidth: '400px',
                    maxHeight: '275px',
                }}
            >
                <div className="card-header bg-transparent border-success">
                    (KJV) {title ?? 'not found'}
                </div>
                <div
                    className={
                        'card-body bg-transparent ' +
                        'border-success app-selectable-text'
                    }
                >
                    {text}
                </div>
            </div>
            <div
                className="alert alert-info"
                style={{ maxWidth: '700px', margin: 'auto' }}
            >
                {'`'}This is an open-source presentation app for worship
                service. Official Github repo here:{' '}
                <button className="btn btn-success" onClick={onClick}>
                    https://github.com/OpenWorshipApp/open-worship-app-dt
                </button>
            </div>
        </div>
    );
}
