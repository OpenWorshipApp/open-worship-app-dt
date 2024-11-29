import './SlideList.scss';

import { useCallback } from 'react';

import FileListHandler from '../others/FileListHandler';
import SlideFile from './SlideFile';
import Slide from './Slide';
import {
    checkIsPdf, convertOfficeFile, pdfMimetype, supportOfficeFE,
} from './slideHelpers';
import { extractExtension, getFileFullName } from '../server/fileHelper';
import FileSource from '../helper/FileSource';
import { useGenDS } from '../helper/dirSourceHelpers';
import {
    defaultDataDirNames, dirSourceSettingNames,
} from '../helper/constants';
import { DroppedFileType } from '../others/droppingFileHelpers';

export default function SlideList() {
    const dirSource = useGenDS(dirSourceSettingNames.SLIDE);
    if (dirSource !== null) {
        dirSource.checkExtraFile = (fileFullName: string) => {
            if (checkIsPdf(extractExtension(fileFullName))) {
                return {
                    fileFullName: fileFullName,
                    appMimetype: pdfMimetype,
                };
            }
            return null;
        };
    }
    const checkExtraFileCallback = useCallback((filePath: string) => {
        const fileSource = FileSource.getInstance(filePath);
        if (checkIsPdf(fileSource.extension)) {
            return true;
        }
        return false;
    }, [dirSource]);
    const takeDropFileCallback = useCallback((file: DroppedFileType) => {
        if (dirSource === null) {
            return false;
        }
        const fileFullName = getFileFullName(file);
        const ext = extractExtension(fileFullName).toLocaleLowerCase();
        if (supportOfficeFE.includes(ext)) {
            convertOfficeFile(file, dirSource);
            return true;
        }
        return false;
    }, [dirSource]);
    const bodyHandlerCallback = useCallback((filePaths: string[]) => {
        return filePaths.map((filePath, i) => {
            const fileSource = FileSource.getInstance(filePath);
            return <SlideFile key={fileSource.fileFullName}
                index={i}
                filePath={filePath} />;
        });
    }, []);
    if (dirSource === null) {
        return null;
    }
    return (
        <FileListHandler id='slide-list'
            mimetype='slide'
            defaultFolderName={defaultDataDirNames.SLIDE}
            dirSource={dirSource}
            checkExtraFile={checkExtraFileCallback}
            takeDroppedFile={takeDropFileCallback}
            onNewFile={async (dirPath: string, name: string) => {
                return !await Slide.create(dirPath, name);
            }}
            header={<span>Slides</span>}
            bodyHandler={bodyHandlerCallback} />
    );
}
