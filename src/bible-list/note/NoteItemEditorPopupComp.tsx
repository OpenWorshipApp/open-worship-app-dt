import { dirSourceSettingNames } from '../../helper/constants';
import DirSource from '../../helper/DirSource';
import { getParamFileFullName, getParamIdNum } from '../../helper/domHelpers';
import { pathJoin, fsExistSync } from '../../server/fileHelpers';
import Note from './Note';
import FileReadErrorComp from '../../others/FileReadErrorComp';
import { useAppStateAsync } from '../../helper/debuggerHelpers';
import { handleError } from '../../helper/errorHelpers';
import NoteEditorComp, { NoteTitleEditorComp } from './NoteEditorComp';
import LoadingComp from '../../others/LoadingComp';
import {
    useDirSourceWatching,
    useGenDirSourceReload,
} from '../../helper/dirSourceHelpers';

async function getNoteAndNoteItem() {
    const fileFullName = getParamFileFullName();
    if (fileFullName === null) {
        throw new Error('Note file not specified');
    }
    const dirPath = DirSource.getDirPathBySettingName(
        dirSourceSettingNames.NOTES,
    );
    if (dirPath === null) {
        throw new Error('Note directory not set');
    }
    const filePath = pathJoin(dirPath, fileFullName);
    if (fsExistSync(filePath) === false) {
        throw new Error(`Note file not found: ${fileFullName}`);
    }
    const note = await Note.fromFilePath(filePath);
    if (note === null) {
        throw new Error(`Failed to load note from file: ${fileFullName}`);
    }

    const noteItemId = getParamIdNum();
    if (noteItemId === null) {
        throw new Error('Note item ID not specified');
    }
    const noteItem = note.getItemById(noteItemId);
    if (noteItem === null) {
        throw new Error(`Note item not found: ${noteItemId}`);
    }
    return { note, noteItem };
}

const HEIGHT = 40;
export default function NoteItemEditorPopupComp() {
    const [data] = useAppStateAsync(async () => {
        try {
            const data = await getNoteAndNoteItem();
            return data;
        } catch (error) {
            handleError(error);
        }
        return null;
    }, []);
    const dirSource = useGenDirSourceReload(dirSourceSettingNames.NOTES);
    useDirSourceWatching(dirSource);
    if (data === undefined) {
        return <LoadingComp />;
    }
    if (data === null) {
        return <FileReadErrorComp />;
    }
    return (
        <div className="card w-100 h-100 app-overflow-hidden">
            <div
                className="card-header 100"
                style={{
                    height: HEIGHT,
                }}
            >
                <NoteTitleEditorComp
                    note={data.note}
                    noteItem={data.noteItem}
                />
            </div>
            <div
                className="card-body w-100 app-overflow-hidden"
                style={{
                    height: `calc(100% - ${HEIGHT}px)`,
                }}
            >
                <NoteEditorComp
                    note={data.note}
                    noteItem={data.noteItem}
                    extraStyle={{
                        height: '100%',
                    }}
                />
            </div>
        </div>
    );
}
