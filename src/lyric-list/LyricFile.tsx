import { useState } from 'react';
import Lyric from './Lyric';
import FileItemHandler from '../others/FileItemHandler';
import FileSource from '../helper/FileSource';

export default function LyricFile({
    index, list, setList, fileSource,
}: {
    index: number,
    list: FileSource[] | null,
    setList: (newList: FileSource[] | null) => void,
    fileSource: FileSource,
}) {
    const [data, setData] = useState<Lyric | null | undefined>(null);
    return (
        <FileItemHandler
            index={index}
            mimetype={'lyric'}
            list={list}
            setList={setList}
            data={data}
            setData={setData}
            fileSource={fileSource}
            className={`${data?.isSelected ? 'active' : ''}`}
            onClick={() => {
                if (data) {
                    Lyric.presentLyric(data.isSelected ? null : data);
                }
            }}
            child={<>
                <i className="bi bi-music-note" />
                {fileSource.name}
            </>}
        />
    );
}
