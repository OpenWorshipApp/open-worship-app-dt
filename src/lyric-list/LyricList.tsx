import './LyricList.scss';

import { useState } from 'react';
import {
    useStateSettingString,
} from '../helper/settingHelper';
import {
    useLyricUpdating,
} from '../event/PreviewingEventListener';
import LyricItem from './LyricItem';
import FileListHandler from '../others/FileListHandler';
import FileSource from '../helper/FileSource';
import Lyric from './Lyric';

const id = 'lyric-list';
export default function LyricList() {
    const [list, setList] = useState<FileSource[] | null>(null);
    const [dir, setDir] = useStateSettingString(`${id}-selected-dir`, '');
    useLyricUpdating((newLyric) => {
        newLyric.save().then(() => {
            setList(null);
        });
    });
    return (
        <FileListHandler id={id} mimetype={'lyric'}
            list={list} setList={setList}
        dir={dir} setDir={setDir}
            onNewFile={async (name) => {
                if (name !== null) {
                    const isSuccess = await Lyric.createNew(dir, name, {
                        items: [Lyric.toNewLyric(name)],
                    });
                    if (isSuccess) {
                        setList(null);
                        return false;
                    }
                }
                return true;
            }}
            header={<span>Lyrics</span>}
            body={<>
                {(list || []).map((fileSource, i) => {
                    return <LyricItem key={`${i}`}
                        index={i}
                        fileSource={fileSource}
                        list={list} setList={setList} />;
                })}
            </>} />
    );
}
