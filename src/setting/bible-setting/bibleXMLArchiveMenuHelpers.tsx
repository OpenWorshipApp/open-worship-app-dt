import { createWorkDir, safeDeleteDir } from '../../helper/appArchiveHelpers';
import { handleError } from '../../helper/errorHelpers';
import { tran } from '../../lang/langHelpers';
import ArchiveItemSelectorComp, {
    type ArchiveItemChoiceType,
} from '../../popup-widget/ArchiveItemSelectorComp';
import {
    ArchivePasswordComp,
    MAX_PASSWORD_ATTEMPTS,
} from '../../popup-widget/ArchivePasswordComp';
import { showAppInput } from '../../popup-widget/popupWidgetHelpers';
import {
    hideProgressBar,
    showProgressBar,
} from '../../progress-bar/progressBarHelpers';
import { showFileOrDirExplorer } from '../../server/appHelpers';
import appProvider from '../../server/appProvider';
import { selectFiles } from '../../server/fileHelpers';
import { showSimpleToast } from '../../toast/toastHelpers';
import type {
    BibleXMLExportEntryType,
    BibleXMLImportEntryType,
} from './bibleXMLArchiveHelpers';
import {
    BIBLE_XML_IMPORT_ISSUE_MESSAGE_MAP,
    createBibleXMLArchive,
    getExportableBibleXMLEntries,
    importBibleXMLEntries,
    openBibleXMLArchive,
    resolveBibleXMLImportEntries,
} from './bibleXMLArchiveHelpers';

/**
 * The **Export Bible Data / Import Bible Data** flows of the Bible settings
 * page. Same shape as `src/setting/data-archive/dataArchiveMenuHelpers.tsx`,
 * which is the flow this one is modelled on — one dialog that both picks the
 * items and (on export) asks for the password, a progress bar around the file
 * work, and one toast at the end under the flow's own title.
 */

export const EXPORT_TITLE = 'Export Bible Data';
export const IMPORT_TITLE = 'Import Bible Data';

/**
 * Ask which bibles to act on, and — on the way out — what to protect the bundle
 * with. Returns null when the operator cancels or unchecks everything;
 * `showAppInput` only resolves Ok/Cancel, so the live answers are captured here.
 *
 * The password fields ride INSIDE this dialog rather than in one of their own:
 * exporting is one action and asking twice for it would be two dialogs for a
 * single click. Importing does not use them — by the time this is reached the
 * archive has already been opened, and any password it needed was asked for
 * against the file itself.
 */
async function askForBibles(
    title: string,
    message: string,
    choices: ArchiveItemChoiceType[],
    isAskingNewPassword = false,
): Promise<{ selectedKeys: string[]; password: string | null } | null> {
    let invalidMessage: string | undefined = undefined;
    // A LOOP, and deliberately not `showAppAlert` + recursion.
    //
    // Ok cannot be vetoed from inside the popup (Enter confirms it outright),
    // so a mistyped confirmation has to be caught out here and the dialog
    // re-opened — a bundle locked behind a password that was typed wrong once
    // is a bundle that is gone. But putting an ALERT between the two
    // `showAppInput` calls unmounts this popup, which throws away the state of
    // both children: the re-ask came back with the password fields blank AND
    // the selection reset to everything. One more Ok then exported the whole
    // list UNPROTECTED, silently, after the operator had asked for a password.
    //
    // Re-rendering the same popup instead keeps `ArchivePasswordComp` and
    // `ArchiveItemSelectorComp` mounted, so they hold what was typed and picked
    // and report it to each new closure (both have `onChange` in their effect
    // deps for exactly this). The complaint rides in as `invalidMessage`.
    for (let attempt = 0; attempt < MAX_PASSWORD_ATTEMPTS; attempt++) {
        let selectedKeys = choices
            .filter((choice) => {
                return !choice.invalidMessage;
            })
            .map((choice) => {
                return choice.key;
            });
        let password = '';
        let confirmedPassword = '';
        const isOk = await showAppInput(
            // The popup renders its title raw, so it is translated here.
            tran(title),
            <>
                <ArchiveItemSelectorComp
                    choices={choices}
                    message={message}
                    onChange={(newSelectedKeys) => {
                        selectedKeys = newSelectedKeys;
                    }}
                />
                {isAskingNewPassword ? (
                    <div className="mt-3 pt-3 border-top">
                        <ArchivePasswordComp
                            isConfirming
                            invalidMessage={invalidMessage}
                            onChange={(newPassword, newConfirmedPassword) => {
                                password = newPassword;
                                confirmedPassword = newConfirmedPassword;
                            }}
                        />
                    </div>
                ) : null}
            </>,
            { escToCancel: true, extraStyles: { maxWidth: '700px' } },
        );
        if (!isOk || selectedKeys.length === 0) {
            return null;
        }
        if (password === confirmedPassword) {
            return { selectedKeys, password: password || null };
        }
        invalidMessage = 'Passwords do not match';
    }
    return null;
}

/**
 * Run one step under the progress bar. Written once because the failure mode of
 * a hand-balanced show/hide pair is a progress bar that never goes away, and it
 * is invisible until it happens.
 */
async function runWithProgress<T>(title: string, run: () => Promise<T>) {
    showProgressBar(title);
    try {
        return await run();
    } finally {
        hideProgressBar(title);
    }
}

/** Both flows end the same way: log it and say so under their own title. */
async function runMenuAction(title: string, run: () => Promise<void>) {
    try {
        await run();
    } catch (error: any) {
        handleError(error);
        showSimpleToast(
            tran(title),
            error?.message ?? `Unable to complete ${title}`,
        );
    }
}

function toExportChoices(entries: BibleXMLExportEntryType[]) {
    return entries.map((entry): ArchiveItemChoiceType => {
        return {
            key: entry.bibleKey,
            title: entry.bibleKey,
            iconClassName: 'bi-filetype-xml',
            detail: entry.title || undefined,
        };
    });
}

export async function handleBibleXMLExporting() {
    return await runMenuAction(EXPORT_TITLE, async () => {
        const entries = await runWithProgress(EXPORT_TITLE, () => {
            return getExportableBibleXMLEntries();
        });
        if (entries.length === 0) {
            // Toast BODIES stay plain English here, as they do in the data
            // archive next door: they carry paths and counts, and half a
            // sentence through `tran` reads worse than none of it.
            showSimpleToast(
                tran(EXPORT_TITLE),
                'There is no Bible XML file to export yet — import one first',
            );
            return;
        }
        const answer = await askForBibles(
            EXPORT_TITLE,
            'Choose the bibles to export',
            toExportChoices(entries),
            true,
        );
        if (answer === null) {
            return;
        }
        const { selectedKeys, password } = answer;
        const selectedEntries = entries.filter((entry) => {
            return selectedKeys.includes(entry.bibleKey);
        });
        const archiveFilePath = await runWithProgress(EXPORT_TITLE, () => {
            return createBibleXMLArchive(selectedEntries, password);
        });
        // `showSimpleToast` does not translate; the path goes on AFTER the
        // translation, never into the key.
        showSimpleToast(
            tran(EXPORT_TITLE),
            `${tran('Exported to')} ${archiveFilePath}`,
        );
        showFileOrDirExplorer(archiveFilePath);
    });
}

function toImportChoices(entries: BibleXMLImportEntryType[]) {
    return entries.map((entry): ArchiveItemChoiceType => {
        return {
            key: entry.archivePath,
            title: entry.bibleKey,
            iconClassName: 'bi-filetype-xml',
            detail: entry.title || undefined,
            // The selector renders these raw; see `ArchiveItemChoiceType`.
            invalidMessage:
                entry.issue === null
                    ? undefined
                    : tran(BIBLE_XML_IMPORT_ISSUE_MESSAGE_MAP[entry.issue]),
        };
    });
}

/**
 * `archiveFilePath` skips the file picker when the bundle is already known — a
 * dropped file, or an automated run that cannot drive a native dialog.
 */
export async function handleBibleXMLImporting(
    archiveFilePath?: string,
    onImported?: () => void,
) {
    return await runMenuAction(IMPORT_TITLE, async () => {
        if (archiveFilePath === undefined) {
            const filePaths = await selectFiles([
                {
                    name: 'Open Worship Bible Data Archive',
                    // `enc` is the password protected shape of the same bundle.
                    extensions: ['gz', 'tgz', 'tar', 'enc'],
                },
            ]);
            archiveFilePath = filePaths[0];
        }
        if (!archiveFilePath) {
            return;
        }
        const extractDir = await createWorkDir('owabdata-import');
        try {
            // Opened and unpacked ONCE, then both listed and imported against
            // the extract dir. A protected bundle has to be decrypted whole
            // before anything inside it can be read, and doing that twice is
            // what the whole-data archive records as the mistake not to repeat.
            const manifest = await runWithProgress(IMPORT_TITLE, () => {
                return openBibleXMLArchive(
                    archiveFilePath as string,
                    extractDir,
                    IMPORT_TITLE,
                );
            });
            // `null` is the password prompt being cancelled — the operator
            // already knows they backed out, so it gets no toast.
            if (manifest === null) {
                return;
            }
            const entries = await runWithProgress(IMPORT_TITLE, () => {
                return resolveBibleXMLImportEntries(extractDir, manifest);
            });
            if (entries.length === 0) {
                showSimpleToast(
                    tran(IMPORT_TITLE),
                    'This archive holds no bible',
                );
                return;
            }
            const answer = await askForBibles(
                IMPORT_TITLE,
                'Choose the bibles to import',
                toImportChoices(entries),
            );
            if (answer === null) {
                return;
            }
            const selectedEntries = entries.filter((entry) => {
                return answer.selectedKeys.includes(entry.archivePath);
            });
            const { importedBibleKeys } = await runWithProgress(
                IMPORT_TITLE,
                () => {
                    return importBibleXMLEntries(selectedEntries);
                },
            );
            if (importedBibleKeys.length > 0) {
                onImported?.();
            }
            // Counted against everything the BUNDLE held, not against what was
            // handed to the importer. The red rows can never be selected, so
            // counting only the importer's own skips reported "0 skipped" for
            // an archive whose refusals the operator had just been reading.
            const skippedCount = entries.length - importedBibleKeys.length;
            showSimpleToast(
                tran(IMPORT_TITLE),
                `Imported ${importedBibleKeys.length} bible(s);` +
                    ` ${skippedCount} skipped`,
            );
        } finally {
            await safeDeleteDir(extractDir);
        }
    });
}

// Same dev-only pattern as `tryDataExport` / `tryDataImport`: it gives an
// automated QA run (and a developer) a way to drive both flows without a native
// file dialog, which CDP cannot reach.
if (appProvider.systemUtils.isDev) {
    (globalThis as any).tryBibleXMLExport = handleBibleXMLExporting;
    (globalThis as any).tryBibleXMLImport = handleBibleXMLImporting;
}
