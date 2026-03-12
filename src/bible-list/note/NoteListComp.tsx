import {
    defaultDataDirNames,
    dirSourceSettingNames,
} from '../../helper/constants';
import { useGenDirSourceReload } from '../../helper/dirSourceHelpers';
import { tran } from '../../lang/langHelpers';
import FileListHandlerComp from '../../others/FileListHandlerComp';
import Note from './Note';
import NoteFileComp from './NoteFileComp';
import { sortNoteFilePaths } from './noteHelpers';

export default function NoteListComp() {
    const dirSource = useGenDirSourceReload(dirSourceSettingNames.NOTES);
    const handleBodyRendering = (filePaths: string[]) => {
        return filePaths.map((filePath, i) => {
            return (
                <NoteFileComp key={filePath} index={i} filePath={filePath} />
            );
        });
    };
    if (dirSource === null) {
        return null;
    }
    // Make sure the default note file is created
    Note.getDefault();
    return (
        <FileListHandlerComp
            className="note-list"
            mimetypeName="note"
            defaultFolderName={defaultDataDirNames.NOTES}
            dirSource={dirSource}
            onNewFile={async (dirPath: string, name: string) => {
                return !(await Note.create(dirPath, name));
            }}
            header={<span>{tran('Notes')}</span>}
            bodyHandler={handleBodyRendering}
            userClassName="p-0"
            sortFilePaths={sortNoteFilePaths}
        />
    );
}
