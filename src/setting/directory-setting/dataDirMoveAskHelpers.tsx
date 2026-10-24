import { escapeHtmlText } from '../../helper/sanitizeHelpers';
import {
    getCurrentLocale,
    getLangData,
    toStringNum,
    tran,
} from '../../lang/langHelpers';
import {
    showAppAlert,
    showAppConfirm,
} from '../../popup-widget/popupWidgetHelpers';
import { showFileOrDirExplorer } from '../../server/appHelpers';
import {
    fsCheckDirExist,
    getDefaultDataDirPath,
} from '../../server/fileHelpers';
import { handleError } from '../../helper/errorHelpers';
import DataDirMoveBodyComp, {
    DataDirOldCopyBodyComp,
} from './DataDirMoveBodyComp';
import {
    checkIsDataDirMoveHidden,
    type DataDirMoveResultType,
    genDataDirMoveTargetPath,
    hideDataDirMoveForAWhile,
    readDataDirMovedFromFlag,
    readDataDirMovedToFlag,
    requestDataDirMove,
} from './dataDirMoveHelpers';

/**
 * The launch question for a data folder on the Desktop. **Not Now** asks again
 * at the next launch; **Hide for 30 days** puts it away for that long;
 * **Move Now** relaunches, and the move happens as the app starts again
 * (`runPendingDataDirMove`). Enter does not answer it: it moves every file
 * the person has.
 */
/**
 * `isAskedFor`: pressed in Path Settings, not asked at a start. A question
 * put away for 30 days stays away from the start, never from a press that
 * asks for it.
 */
export async function askToMoveDesktopDataDir(
    dataDirPath: string,
    isAskedFor = false,
) {
    if (!isAskedFor && checkIsDataDirMoveHidden()) {
        return;
    }
    let isHiding = false;
    // The folder the move will make, named in the question. A default folder
    // that cannot be read must not keep the question from being asked at all:
    // it names the default, and the move itself reports what it meets.
    let toDirPath: string;
    try {
        toDirPath = await genDataDirMoveTargetPath();
    } catch (error) {
        handleError(error);
        toDirPath = getDefaultDataDirPath();
    }
    const isMoving = await showAppConfirm(
        tran('Move Your Data Folder Off the Desktop'),
        <DataDirMoveBodyComp fromDirPath={dataDirPath} toDirPath={toDirPath} />,
        {
            enterToOk: false,
            confirmButtonLabel: 'Move Now',
            cancelButtonLabel: 'Not Now',
            extraButtonLabel: 'Hide for 30 days',
            onExtraButtonClick: () => {
                isHiding = true;
            },
        },
    );
    if (isHiding) {
        hideDataDirMoveForAWhile();
    } else if (isMoving) {
        requestDataDirMove(dataDirPath);
    }
}

function toParagraph(text: string) {
    return `<p>${text}</p>`;
}

function toPathParagraph(dirPath: string) {
    return toParagraph(`<strong>${escapeHtmlText(dirPath)}</strong>`);
}

function readMoveResult(resultText: string): DataDirMoveResultType | null {
    try {
        const result = JSON.parse(resultText);
        if (
            typeof result?.fromDirPath === 'string' &&
            typeof result?.toDirPath === 'string'
        ) {
            return result;
        }
    } catch (_error) {}
    return null;
}

/** What the move at this start did, said once the window has rendered. */
export async function showDataDirMoveResult(resultText: string) {
    const result = readMoveResult(resultText);
    if (result === null) {
        return;
    }
    if (!result.isMoved) {
        await showAppAlert(
            tran('Data Folder Not Moved'),
            toParagraph(
                tran(
                    'The data folder could not be moved, so the app keeps using it where it is. Nothing was changed.',
                ),
            ) +
                toPathParagraph(result.fromDirPath) +
                (result.errorMessage
                    ? toParagraph(escapeHtmlText(result.errorMessage))
                    : '') +
                toParagraph(
                    tran('The app asks again the next time it starts.'),
                ),
        );
        return;
    }
    let message =
        toParagraph(tran('Your data folder is now in a safe place:')) +
        toPathParagraph(result.toDirPath);
    if (result.isCopied) {
        message +=
            toParagraph(tran('The old copy is still at:')) +
            toPathParagraph(result.fromDirPath) +
            toParagraph(
                tran(
                    'The app no longer uses it. When you are sure your songs, slides and settings are all here, move the old folder to the Recycle Bin (Trash) yourself.',
                ),
            );
    }
    await showAppAlert(tran('Data Folder Moved'), message);
}

function formatMovedAt(movedAt: string | null) {
    if (movedAt === null) {
        return '';
    }
    const date = new Date(movedAt);
    if (Number.isNaN(date.getTime())) {
        return '';
    }
    // Year first and a 24-hour clock, the one order no reader takes the wrong
    // way round: Electron's Chromium has no Khmer date format and wrote a
    // Khmer window's date as `10/17/2026, 9:56 PM`. In the app's own digits,
    // the way it writes every number (`toStringNum`).
    const toTwoDigits = (n: number) => {
        return `${n}`.padStart(2, '0');
    };
    const text =
        `${date.getFullYear()}-${toTwoDigits(date.getMonth() + 1)}-` +
        `${toTwoDigits(date.getDate())} ${toTwoDigits(date.getHours())}:` +
        toTwoDigits(date.getMinutes());
    const numList = getLangData(getCurrentLocale())?.numList;
    if (!numList) {
        return text;
    }
    return text.replaceAll(/\d/g, (digit) => {
        return toStringNum(numList, Number(digit));
    });
}

/**
 * At launch, while the folder this one was copied from is still there and
 * still marked as moved: say so, and offer to show it. Deleting it is the
 * person's to do -- the app never does.
 */
export async function remindOldDataDirCopy(dataDirPath: string) {
    const movedFrom = await readDataDirMovedFromFlag(dataDirPath);
    if (movedFrom === null || !(await fsCheckDirExist(movedFrom.dirPath))) {
        return;
    }
    // Only a folder that says it was moved: one put back there by hand, or
    // another folder made at that path since, is not the old copy.
    if ((await readDataDirMovedToFlag(movedFrom.dirPath)) === null) {
        return;
    }
    const isShowing = await showAppConfirm(
        tran('Old Copy of Your Data Folder'),
        <DataDirOldCopyBodyComp
            dataDirPath={dataDirPath}
            oldDirPath={movedFrom.dirPath}
            movedAt={formatMovedAt(movedFrom.movedAt)}
        />,
        {
            enterToOk: false,
            confirmButtonLabel: 'Show Folder',
            cancelButtonLabel: 'Ok',
        },
    );
    if (isShowing) {
        showFileOrDirExplorer(movedFrom.dirPath);
    }
}
