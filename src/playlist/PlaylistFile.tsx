import { useState } from 'react';
import { useStateSettingBoolean } from '../helper/settingHelper';
import BibleItem from '../bible-list/BibleItem';
import PlaylistSlideItem from './PlaylistSlideItem';
import FileItemHandler from '../others/FileItemHandler';
import Playlist from './Playlist';
import FileSource from '../helper/FileSource';
import BibleItemRender from '../bible-list/BibleItemRender';

export default function PlaylistFile({
    index, list, setList, fileSource,
}: {
    index: number,
    list: FileSource[] | null,
    setList: (newList: FileSource[] | null) => void,
    fileSource: FileSource,
}) {
    const [data, setData] = useState<Playlist | null | undefined>(null);
    const [isOpened, setIsOpened] = useStateSettingBoolean(`opened-${fileSource.filePath}`);
    return (
        <FileItemHandler
            index={index}
            mimetype={'playlist'}
            list={list}
            setList={setList}
            data={data}
            setData={setData}
            fileSource={fileSource}
            className={'playlist-file'}
            onClick={() => setIsOpened(!isOpened)}
            onDrop={async (event) => {
                if (data) {
                    const receivedData = event.dataTransfer.getData('text');
                    try {
                        JSON.parse(receivedData);
                        const bible = JSON.parse(receivedData);
                        delete bible.groupIndex;
                        data.content.items.push({
                            type: 'bible',
                            bible: bible as BibleItem,
                        });
                    } catch (error) {
                        data.content.items.push({
                            type: 'slide',
                            slideItemPath: receivedData,
                        });
                    }
                    data.save().then(() => {
                        setList(null);
                    });
                }
            }}
            child={<div className='card pointer mt-1 ps-2'>
                <div className='card-header'
                    onClick={() => setIsOpened(!isOpened)}>
                    <i className={`bi ${isOpened ? 'bi-chevron-down' : 'bi-chevron-right'}`} />
                    {fileSource.name}
                </div>
                {isOpened && data && <div className='card-body d-flex flex-column'>
                    {data.content.items.map((item, i) => {
                        if (item.type === 'slide') {
                            const slidePath = item.slideItemPath as string;
                            return (
                                <PlaylistSlideItem
                                slideItemPath={slidePath}
                                width={200} />
                            );
                        }
                        return (
                            <BibleItemRender key={`${i}`} index={i}
                                bibleItem={item.bible as BibleItem} />
                        );
                    })}
                </div>}
            </div>}
        />
    );
}
