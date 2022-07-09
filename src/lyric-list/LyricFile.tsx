import { useState } from 'react';
import Lyric from './Lyric';
import FileItemHandler from '../others/FileItemHandler';
import FileSource from '../helper/FileSource';
import ItemColorNote from '../others/ItemColorNote';
import ItemSource from '../helper/ItemSource';

export default function LyricFile({
    index, fileSource,
}: {
    index: number,
    fileSource: FileSource,
}) {
    const [data, setData] = useState<Lyric | null | undefined>(null);
    return (
        <FileItemHandler
            index={index}
            mimetype={'lyric'}
            data={data}
            setData={setData}
            fileSource={fileSource}
            isPointer
            onClick={() => {
                if (data) {
                    data.isSelected = !data.isSelected;
                }
            }}
            child={<>
                <i className="bi bi-music-note" />
                {fileSource.name}
                <ItemColorNote item={data as ItemSource<any>} />
            </>}
        />
    );
}
