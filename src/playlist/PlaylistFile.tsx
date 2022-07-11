import { useState } from 'react';
import { useStateSettingBoolean } from '../helper/settingHelper';
import BibleItem from '../bible-list/BibleItem';
import PlaylistSlideItem from './PlaylistSlideItem';
import FileItemHandler from '../others/FileItemHandler';
import Playlist from './Playlist';
import FileSource from '../helper/FileSource';
import BibleItemRender from '../bible-list/BibleItemRender';

export default function PlaylistFile({
    index, fileSource,
}: {
    index: number,
    fileSource: FileSource,
}) {
    const [data, setData] = useState<Playlist | null | undefined>(null);
    const [isOpened, setIsOpened] = useStateSettingBoolean(`opened-${fileSource.filePath}`);
    return (
        <FileItemHandler
            index={index}
            mimetype={'playlist'}
            data={data}
            setData={setData}
            fileSource={fileSource}
            className={'playlist-file'}
            onClick={() => setIsOpened(!isOpened)}
            onDrop={async (event) => {
                if (data) {
                    const receivedData = event.dataTransfer.getData('text');
                    if (data.addFromData(receivedData)) {
                        data.save();
                    }
                }
            }}
            child={<div className='card pointer mt-1 ps-2'>
                <div className='card-header'
                    onClick={() => setIsOpened(!isOpened)}>
                    <i className={`bi ${isOpened ? 'bi-chevron-down' : 'bi-chevron-right'}`} />
                    {fileSource.name}
                </div>
                {isOpened && data && <div className='card-body d-flex flex-column'>
                    {data.items.map((playlistItem, i) => {
                        if (playlistItem.isSlideItem) {
                            return (
                                <PlaylistSlideItem width={200}
                                    slideItemPath={playlistItem.path} />
                            );
                        } else if (playlistItem.isBibleItem) {
                            return (
                                <BibleItemRender key={`${i}`} index={i}
                                    bibleItem={playlistItem.item as BibleItem} />
                            );
                        } else if (playlistItem.isLyricItem) {
                            return (
                                <div>Not Supported Item Type</div>
                            );
                        }
                    })}
                </div>}
            </div>}
        />
    );
}
