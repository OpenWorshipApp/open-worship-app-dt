import './BibleView.scss';

import { showAppContextMenu } from '../others/AppContextMenu';
import BibleItem, {
    useBibleItemRenderText,
    useBibleItemRenderTitle,
} from '../bible-list/BibleItem';
import { copyToClipboard } from '../server/appHelper';
import BibleSelection from '../bible-search/BibleSelection';
import { useCallback } from 'react';

export default function BibleView({
    index, bibleItem, onBibleChange, onClose, fontSize,
}: {
    index: number,
    bibleItem: BibleItem,
    onBibleChange: (bibleKey: string, index: number) => void,
    onClose: (index: number) => void,
    fontSize: number,
}) {
    const title = useBibleItemRenderTitle(bibleItem);
    const text = useBibleItemRenderText(bibleItem);
    const onChangeCallback = useCallback((
        oldBibleKey: string, newBibleKey: string) => {
        onBibleChange(newBibleKey, index);
    }, [index, onBibleChange]);
    return (
        <div className='bible-view card flex-fill'
            onContextMenu={(event) => {
                showAppContextMenu(event as any, [
                    {
                        title: 'Copy', onClick: () => {
                            const toCopyText = `${title}\n${text}`;
                            copyToClipboard(toCopyText);
                        },
                    },
                ]);
            }}>
            <div className='card-header'>
                <div className='d-flex'>
                    <div className='flex-fill'>
                        <div>
                            <span className='input-group-text select float-start'>
                                <BibleSelection value={bibleItem.bibleKey}
                                    onChange={onChangeCallback} />
                            </span>
                        </div>
                        <div className='title'>
                            {title}
                        </div>
                    </div>
                    <div>
                        <button className='btn-close' onClick={() => {
                            onClose(index);
                        }} />
                    </div>
                </div>
            </div>
            <div className='card-body p-3'>
                <p className='selectable-text' style={{
                    fontSize: `${fontSize}px`,
                }}>{text}</p>
            </div>
        </div>
    );
}
