import { useCallback } from 'react';

import AskingNewNameComp from './AskingNewNameComp';
import FileSource from '../helper/FileSource';
import { renameAllMaterialFiles } from '../server/appHelpers';
import EditingHistoryManager from '../editing-manager/EditingHistoryManager';
import { useAppCurrentRef } from '../helper/appHooks';

export default function RenderRenamingComp({
    setIsRenaming,
    filePath,
    renamedCallback,
}: Readonly<{
    setIsRenaming: (value: boolean) => void;
    filePath: string;
    renamedCallback?: (newFileSource: FileSource) => void;
}>) {
    const filePathRef = useAppCurrentRef(filePath);
    const setIsRenamingRef = useAppCurrentRef(setIsRenaming);
    const renamedCallbackRef = useAppCurrentRef(renamedCallback);
    const handleNameApplying = useCallback(async (newName: string | null) => {
        if (newName === null) {
            setIsRenamingRef.current(false);
            return;
        }
        const fileSource = FileSource.getInstance(filePathRef.current);
        const newFileSource = await fileSource.renameTo(newName);
        if (newFileSource !== null) {
            await renameAllMaterialFiles(fileSource, newName);
            await EditingHistoryManager.moveFilePath(
                filePathRef.current,
                newFileSource.filePath,
            );
            renamedCallbackRef.current?.(newFileSource);
        }
        setIsRenamingRef.current(!newFileSource);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const fileSource = FileSource.getInstance(filePath);
    return (
        <AskingNewNameComp
            defaultName={fileSource.name}
            applyName={handleNameApplying}
        />
    );
}
