import { tran } from '../../lang/langHelpers';
import appProvider from '../../server/appProvider';

function DataDirPathComp({ dirPath }: Readonly<{ dirPath: string }>) {
    return (
        <div
            className="app-selectable-text my-1 ms-3"
            style={{ overflowWrap: 'anywhere' }}
        >
            <strong>{dirPath}</strong>
        </div>
    );
}

// Said in the words of the thing that does it on this computer: OneDrive is
// the reported one, and iCloud Drive does the same to a Mac's Desktop.
function DataDirSyncProblemComp() {
    const { isWindows, isMac } = appProvider.systemUtils;
    if (isWindows) {
        return (
            <p>
                {tran(
                    'On Windows, Microsoft OneDrive often backs up the Desktop. While it syncs, OneDrive can replace your files with online-only copies or take them off this computer, so songs, slides and settings can suddenly go missing or come back empty.',
                )}
            </p>
        );
    }
    if (isMac) {
        return (
            <p>
                {tran(
                    'On a Mac, iCloud Drive can keep the Desktop in the cloud. It can take files off this computer and keep them only online, so songs, slides and settings can suddenly go missing.',
                )}
            </p>
        );
    }
    return (
        <p>
            {tran(
                'Backup and sync tools often watch the Desktop, and can change or remove its files while the app is using them.',
            )}
        </p>
    );
}

/**
 * The launch question about a data folder on the Desktop
 * (`askToMoveDesktopDataDir`): where it is, why that is a risk, where it would
 * go, and that nothing is deleted. Plain sentences for a volunteer who never
 * chose the Desktop -- the app did, as its old default.
 */
export default function DataDirMoveBodyComp({
    fromDirPath,
    toDirPath,
}: Readonly<{ fromDirPath: string; toDirPath: string }>) {
    return (
        <div style={{ maxWidth: '600px' }}>
            <p className="mb-1">
                {tran(
                    'Your songs, slides, Bibles and settings are kept in a folder on the Desktop:',
                )}
            </p>
            <DataDirPathComp dirPath={fromDirPath} />
            <DataDirSyncProblemComp />
            <p className="mb-1">
                {tran(
                    'To keep your data safe, the app can move it to a folder these backup tools do not touch:',
                )}
            </p>
            <DataDirPathComp dirPath={toDirPath} />
            <p>
                {tran(
                    'The app closes and opens again to move it. Nothing is deleted: if the folder has to be copied, the old one stays where it is until you move it to the Recycle Bin (Trash) yourself.',
                )}
            </p>
            <p className="mb-0 opacity-75">
                {tran('"Not Now" asks again the next time the app starts.')}
            </p>
        </div>
    );
}

/**
 * The reminder, at launch, that a copy of the data folder is still where it
 * was moved from (`remindOldDataDirCopy`). The app never deletes it; it says
 * where it is and leaves the Recycle Bin to the person.
 */
export function DataDirOldCopyBodyComp({
    dataDirPath,
    oldDirPath,
    movedAt,
}: Readonly<{ dataDirPath: string; oldDirPath: string; movedAt: string }>) {
    return (
        <div style={{ maxWidth: '600px' }}>
            <p className="mb-1">{tran('Your data folder was moved here:')}</p>
            <DataDirPathComp dirPath={dataDirPath} />
            {movedAt === '' ? null : (
                <p className="mb-1">
                    {tran('Moved on:')} <strong>{movedAt}</strong>
                </p>
            )}
            <p className="mb-1">{tran('The old copy is still at:')}</p>
            <DataDirPathComp dirPath={oldDirPath} />
            <p className="mb-0">
                {tran(
                    'The app no longer uses it. When you are sure your songs, slides and settings are all here, move the old folder to the Recycle Bin (Trash) yourself.',
                )}
            </p>
        </div>
    );
}
