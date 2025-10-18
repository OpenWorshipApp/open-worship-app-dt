import { use, useState } from 'react';

import Lyric from './Lyric';
import FileItemHandlerComp from '../others/FileItemHandlerComp';
import FileSource from '../helper/FileSource';
import { AppDocumentSourceAbs } from '../helper/AppEditableDocumentSourceAbs';
import { previewingEventListener } from '../event/PreviewingEventListener';
import { useFileSourceEvents } from '../helper/dirSourceHelpers';
import { useAppEffect } from '../helper/debuggerHelpers';
import {
    SelectedLyricContext,
    useSelectedLyricSetterContext,
} from './lyricHelpers';
import { getIsShowingLyricPreviewer } from '../app-document-presenter/PresenterComp';
import { useEditingHistoryStatus } from '../editing-manager/editingHelpers';
import { checkIsVaryAppDocumentOnScreen } from '../app-document-list/appDocumentHelpers';
import LyricAppDocument from './LyricAppDocument';

function LyricFilePreview({ lyric }: Readonly<{ lyric: Lyric }>) {
    const fileSource = FileSource.getInstance(lyric.filePath);
    const { canSave } = useEditingHistoryStatus(lyric.filePath);
    return (
        <>
            <i className="bi bi-music-note" />
            {fileSource.name}
            {canSave && <span style={{ color: 'red' }}>*</span>}
        </>
    );
}

async function checkIsOnScreen(filePath: string) {
    const lyricAppDocument =
        LyricAppDocument.getInstanceFromLyricFilePath(filePath);
    if (lyricAppDocument === null) {
        return false;
    }
    const isOnScreen = await checkIsVaryAppDocumentOnScreen(lyricAppDocument);
    return isOnScreen;
}

export default function LyricFileComp({
    index,
    filePath,
}: Readonly<{
    index: number;
    filePath: string;
}>) {
    const selectedContext = use(SelectedLyricContext);
    const isSelected =
        selectedContext !== null &&
        selectedContext.selectedLyric?.filePath === filePath;
    const setSelectedLyric = useSelectedLyricSetterContext();
    const [lyric, setLyric] = useState<Lyric | null | undefined>(null);
    useAppEffect(() => {
        if (lyric === null) {
            const data = Lyric.getInstance(filePath);
            setLyric(data);
        }
    }, [lyric]);
    useFileSourceEvents(
        ['update'],
        () => {
            setLyric(null);
        },
        [lyric],
        filePath,
    );
    const handleReloading = () => {
        setLyric(null);
    };
    const handleClicking = () => {
        if (!lyric) {
            return;
        }
        setSelectedLyric(lyric);
        if (!getIsShowingLyricPreviewer()) {
            previewingEventListener.showLyric(lyric);
        }
    };
    const handleChildRendering = (lyric: AppDocumentSourceAbs) => {
        return <LyricFilePreview lyric={lyric as Lyric} />;
    };
    const handleRenaming = async (newFileSource: FileSource) => {
        if (isSelected) {
            const newLyric = Lyric.getInstance(newFileSource.filePath);
            setSelectedLyric(newLyric);
        }
    };
    return (
        <FileItemHandlerComp
            index={index}
            data={lyric}
            reload={handleReloading}
            filePath={filePath}
            onClick={handleClicking}
            renderChild={handleChildRendering}
            isSelected={isSelected}
            checkIsOnScreen={checkIsOnScreen}
            renamedCallback={handleRenaming}
        />
    );
}
