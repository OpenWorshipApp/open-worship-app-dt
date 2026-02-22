import { parsePatch, reversePatch, applyPatch, createPatch } from 'diff';

import { handleError } from '../helper/errorHelpers';
import {
    fsCheckDirExist,
    fsCheckFileExist,
    fsCloneFile,
    fsCreateDir,
    fsDeleteDir,
    fsDeleteFile,
    fsListFiles,
    fsMove,
    pathBasename,
    pathJoin,
} from '../server/fileHelpers';
import GarbageCollectableCacher from '../others/GarbageCollectableCacher';
import FileSource from '../helper/FileSource';
import { unlocking } from '../server/unlockingHelpers';

type HistoryMovementType = 'undo' | 'redo';
const CURRENT_FILE_SIGN = '-head';
export class FileLineHandler {
    filePath: string;
    dirPath: string;

    constructor(filePath: string, dirPath: string) {
        this.filePath = filePath;
        this.dirPath = dirPath;
    }

    get fileSource() {
        return FileSource.getInstance(this.filePath);
    }

    private async getAllHistoryFiles() {
        if (!(await fsCheckDirExist(this.dirPath))) {
            return [];
        }
        try {
            return await fsListFiles(this.dirPath);
        } catch (error) {
            if (await fsCheckDirExist(this.dirPath)) {
                handleError(error);
            }
        }
        return [];
    }

    private toFileIndex(fileFullPath: string) {
        const fileName = pathBasename(fileFullPath);
        const index = Number.parseInt(fileName.split(CURRENT_FILE_SIGN)[0], 10);
        return index;
    }

    private toCurrentFileName(index: number) {
        return `${index}${CURRENT_FILE_SIGN}`;
    }

    private toCurrentFileFullPath(index: number) {
        return pathJoin(this.dirPath, this.toCurrentFileName(index));
    }

    private toFileFullPath(index: number) {
        return pathJoin(this.dirPath, index.toString());
    }

    async getCurrentFileFullPath() {
        const fileNames = await this.getAllHistoryFiles();
        const currentFiles = fileNames.filter((fileFullName) => {
            return fileFullName.endsWith(CURRENT_FILE_SIGN);
        });
        if (currentFiles.length === 1) {
            return pathJoin(this.dirPath, currentFiles[0]);
        }
        return null;
    }

    async getAllFileIndices() {
        const fileNames = await this.getAllHistoryFiles();
        return fileNames
            .map((fileFullName) => {
                return Number.parseInt(fileFullName);
            })
            .filter((fileIndex) => {
                return !Number.isNaN(fileIndex);
            });
    }

    private async getNeighborFileFullPath(isPrevious: boolean) {
        const currentFilePath = await this.getCurrentFileFullPath();
        if (currentFilePath === null) {
            return null;
        }
        const fileIndex = this.toFileIndex(currentFilePath);
        const fileIndices = await this.getAllFileIndices();
        const foundFileIndex = isPrevious
            ? Math.max(
                  ...fileIndices.filter((fileIndex1: number) => {
                      return fileIndex1 < fileIndex;
                  }),
              )
            : Math.min(
                  ...fileIndices.filter((fileIndex1: number) => {
                      return fileIndex1 > fileIndex;
                  }),
              );
        if ([-Infinity, Infinity].includes(foundFileIndex)) {
            return null;
        }
        return this.toFileFullPath(foundFileIndex);
    }

    async getPreviousFileFullPath() {
        return this.getNeighborFileFullPath(true);
    }

    async getNextFileFullPath() {
        return this.getNeighborFileFullPath(false);
    }

    private async moveFile(fileFullPath: string, newFileFullPath: string) {
        await fsMove(fileFullPath, newFileFullPath);
        return newFileFullPath;
    }

    async rollback(filePath: string) {
        const currentFilePath = await this.getCurrentFileFullPath();
        if (currentFilePath === null) {
            return false;
        }
        const currentContent = await FileSource.readFileData(currentFilePath);
        if (currentContent === null) {
            return false;
        }
        const patchedText = await FileSource.readFileData(filePath);
        if (patchedText === null) {
            return false;
        }
        const patcher = parsePatch(patchedText);
        const reversePatcher = reversePatch(patcher);
        const originalContent = applyPatch(
            currentContent,
            Array.isArray(reversePatcher) ? reversePatcher[0] : reversePatcher,
        );
        if (originalContent === false) {
            return false;
        }
        return await FileSource.writeFilePlainText(filePath, originalContent);
    }

    async changeCurrent(fileFullPath: string) {
        return await unlocking(`change-current-${this.filePath}`, async () => {
            let lastFilePath = await this.getCurrentFileFullPath();
            if (lastFilePath !== null) {
                const lastFileIndex = this.toFileIndex(lastFilePath);
                lastFilePath = await this.moveFile(
                    lastFilePath,
                    this.toFileFullPath(lastFileIndex),
                );
            }
            const fileIndex = this.toFileIndex(fileFullPath);
            const currentFilePath = await this.moveFile(
                fileFullPath,
                this.toCurrentFileFullPath(fileIndex),
            );
            if (lastFilePath === null) {
                return false;
            }
            const lastContent = await FileSource.readFileData(lastFilePath);
            if (lastContent === null) {
                return false;
            }
            const currentContent =
                await FileSource.readFileData(currentFilePath);
            if (currentContent === null) {
                return false;
            }
            const patchedText = createPatch(
                this.filePath,
                lastContent,
                currentContent,
            );
            return await FileSource.writeFilePlainText(
                lastFilePath,
                patchedText,
            );
        });
    }

    async appendHistory(dataText: string) {
        return await unlocking(`append-history-${this.filePath}`, async () => {
            try {
                let currentFilePath = await this.getCurrentFileFullPath();
                if (currentFilePath === null) {
                    return false;
                }
                const currentFileIndex = this.toFileIndex(currentFilePath);
                await this.clearNextHistories(currentFileIndex);
                currentFilePath = this.toFileFullPath(currentFileIndex + 1);
                const isSuccess = await FileSource.writeFilePlainText(
                    currentFilePath,
                    dataText,
                );
                if (isSuccess) {
                    await this.changeCurrent(currentFilePath);
                    return true;
                }
            } catch (error) {
                handleError(error);
            }
            return false;
        });
    }

    async ensureHistoriesDir() {
        if (!(await fsCheckDirExist(this.dirPath))) {
            await fsCreateDir(this.dirPath);
        }
        let currentFilePath = await this.getCurrentFileFullPath();
        if (currentFilePath !== null) {
            return;
        }
        await this.clearHistories();
        await fsCreateDir(this.dirPath);
        if (!(await fsCheckFileExist(this.filePath))) {
            throw new Error(`File ${this.filePath} does not exist`);
        }
        currentFilePath = this.toCurrentFileFullPath(0);
        await fsCloneFile(this.filePath, currentFilePath);
    }

    clearHistories() {
        return fsDeleteDir(this.dirPath);
    }

    async clearNextHistories(index: number) {
        const fileIndices = await this.getAllFileIndices();
        const promises = fileIndices
            .filter((fileIndex) => {
                return fileIndex > index;
            })
            .map((fileIndex) => {
                return fsDeleteFile(this.toFileFullPath(fileIndex));
            });
        await Promise.all(promises);
    }
}

const cache = new Map<string, EditingHistoryManager>();
export default class EditingHistoryManager {
    filePath: string;
    fileLineHandler: FileLineHandler;
    private static readonly garbageCacher =
        new GarbageCollectableCacher<string>(3);

    constructor(filePath: string) {
        this.filePath = filePath;
        const dirPath = EditingHistoryManager.genFolderPath(this.filePath);
        this.fileLineHandler = new FileLineHandler(this.filePath, dirPath);
    }

    fireEvent(eventType?: HistoryMovementType) {
        EditingHistoryManager.garbageCacher.delete(this.filePath);
        this.fileLineHandler.fileSource.fireUpdateEvent({
            isHistoryEditing: true,
            eventType,
        });
    }

    async checkCanUndo() {
        const previousFilePath =
            await this.fileLineHandler.getPreviousFileFullPath();
        return previousFilePath !== null;
    }

    async checkCanRedo() {
        const nextFilePath = await this.fileLineHandler.getNextFileFullPath();
        return nextFilePath !== null;
    }

    private async moveHistory(
        filePath: string | null,
        eventType: HistoryMovementType,
    ) {
        if (filePath === null) {
            return false;
        }
        const isRollbackSuccess = await this.fileLineHandler.rollback(filePath);
        if (!isRollbackSuccess) {
            return false;
        }
        await this.fileLineHandler.changeCurrent(filePath);
        this.fireEvent(eventType);
        return true;
    }

    async undo() {
        const filePath = await this.fileLineHandler.getPreviousFileFullPath();
        return await this.moveHistory(filePath, 'undo');
    }

    async redo() {
        const filePath = await this.fileLineHandler.getNextFileFullPath();
        return await this.moveHistory(filePath, 'redo');
    }

    async addHistory(dataText: string) {
        await this.fileLineHandler.ensureHistoriesDir();
        await this.fileLineHandler.appendHistory(dataText);
        this.fireEvent();
    }

    async getOriginalData() {
        return await this.fileLineHandler.fileSource.readFileData();
    }

    async getCurrentHistory() {
        const dataText = EditingHistoryManager.garbageCacher.get(this.filePath);
        if (dataText !== null) {
            return dataText;
        }
        return await unlocking(
            `get-current-history-${this.filePath}`,
            async () => {
                let dataText = EditingHistoryManager.garbageCacher.get(
                    this.filePath,
                );
                if (dataText !== null) {
                    return dataText;
                }
                const currentFilePath =
                    await this.fileLineHandler.getCurrentFileFullPath();
                dataText =
                    currentFilePath !== null
                        ? await FileSource.readFileData(currentFilePath)
                        : await this.getOriginalData();
                if (dataText === null) {
                    return null;
                }

                EditingHistoryManager.garbageCacher.set(
                    this.filePath,
                    dataText,
                );
                return dataText;
            },
        );
    }

    async discard() {
        try {
            await this.fileLineHandler.clearHistories();
            this.fireEvent();
            return true;
        } catch (error) {
            handleError(error);
        }
        return false;
    }

    async save(sanitizeData?: (data: string) => string | null) {
        let lastHistory = await this.getCurrentHistory();
        if (lastHistory === null) {
            return false;
        }
        if (sanitizeData !== undefined) {
            lastHistory = sanitizeData(lastHistory);
        }
        if (lastHistory === null) {
            return false;
        }
        const isSuccess =
            await this.fileLineHandler.fileSource.writeFileData(lastHistory);
        if (!isSuccess) {
            return false;
        }
        this.fireEvent();
        return true;
    }

    static getInstance(filePath: string) {
        if (!cache.has(filePath)) {
            cache.set(filePath, new EditingHistoryManager(filePath));
        }
        return cache.get(filePath) as EditingHistoryManager;
    }

    static async moveFilePath(oldFilePath: string, newFilePath: string) {
        const dirPath = EditingHistoryManager.genFolderPath(oldFilePath);
        const newDirPath = EditingHistoryManager.genFolderPath(newFilePath);
        if (!(await fsCheckDirExist(dirPath))) {
            return;
        }
        if (await fsCheckDirExist(newDirPath)) {
            await fsDeleteDir(newDirPath);
        }
        return await fsMove(dirPath, newDirPath);
    }

    static genFolderPath(filePath: string) {
        return `${filePath}.histories`;
    }
}
