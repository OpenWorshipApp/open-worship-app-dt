import { createWorkDir, safeDeleteDir } from '../../helper/appArchiveHelpers';
import {
    runMenuAction,
    runWithProgress,
} from '../../helper/archiveFlowHelpers';
import { tran } from '../../lang/langHelpers';
import { MAX_PASSWORD_ATTEMPTS } from '../../popup-widget/ArchivePasswordComp';
import ArchiveTreeSelectorComp from '../../popup-widget/ArchiveTreeSelectorComp';
import {
    showAppConfirm,
    showAppInput,
} from '../../popup-widget/popupWidgetHelpers';
import { showFileOrDirExplorer } from '../../server/appHelpers';
import { appSecureStorage } from '../../server/appSecureStorage';
import { selectFiles } from '../../server/fileHelpers';
import { showSimpleToast } from '../../toast/toastHelpers';
import { warnIfAnyBibleEditorDirty } from '../bible-setting/bibleEditorDirtyHelpers';
import { applyStore } from '../SettingApplyComp';
import { forceReloadAppWindows, relaunchApp } from '../settingHelpers';
import { genSettingTreeChoices } from './settingArchiveChoiceHelpers';
import {
    type SettingArchiveManifestType,
    countManifestByLeaf,
    createSettingArchive,
    importSettingSections,
    listExportableSettingKeys,
    openSettingArchive,
} from './settingArchiveHelpers';
import SettingExportDialogBodyComp, {
    type SettingExportAnswerType,
} from './SettingExportDialogBodyComp';

/**
 * The **Export Settings / Import Settings** flows of the Settings window's
 * sidebar. Same shape as `bibleXMLArchiveMenuHelpers.tsx`: one dialog that
 * picks what to carry (and, on export, asks for the password), the file work
 * under the progress bar, one toast at the end under the flow's own title.
 */

export const EXPORT_TITLE = 'Export Settings';
export const IMPORT_TITLE = 'Import Settings';

/**
 * Ask which sections to export and what to protect the file with. Returns
 * null when the operator cancels or unticks everything.
 *
 * A LOOP, re-opening the same popup, and never an alert in between -- see
 * `askForBibles` in `bibleXMLArchiveMenuHelpers.tsx`: an alert unmounts the
 * dialog, and the next Ok then exported every default section UNPROTECTED
 * after the operator had asked for a password. Re-rendering the same popup
 * keeps both the tree and the password fields as they were left, and the
 * password component shows the mismatch itself.
 */
async function askForExportSections(countByLeafId: Map<string, number>) {
    for (let attempt = 0; attempt < MAX_PASSWORD_ATTEMPTS; attempt++) {
        let answer: SettingExportAnswerType = {
            leafIds: [],
            password: '',
            confirmedPassword: '',
        };
        const isOk = await showAppInput(
            // The popup renders its title raw.
            tran(EXPORT_TITLE),
            <SettingExportDialogBodyComp
                countByLeafId={countByLeafId}
                onChange={(newAnswer) => {
                    answer = newAnswer;
                }}
            />,
            { escToCancel: true, extraStyles: { maxWidth: '700px' } },
        );
        if (!isOk || answer.leafIds.length === 0) {
            return null;
        }
        if (answer.password === answer.confirmedPassword) {
            return {
                leafIds: answer.leafIds,
                password: answer.password || null,
            };
        }
    }
    return null;
}

export async function handleSettingsExporting() {
    return await runMenuAction(EXPORT_TITLE, async () => {
        const { refs, countByLeafId } = await runWithProgress(
            EXPORT_TITLE,
            () => {
                return listExportableSettingKeys();
            },
        );
        const answer = await askForExportSections(countByLeafId);
        if (answer === null) {
            return;
        }
        const archiveFilePath = await runWithProgress(EXPORT_TITLE, () => {
            return createSettingArchive(refs, answer.leafIds, answer.password);
        });
        // Toast bodies stay plain English in the archive flows; the path goes
        // on AFTER the translation, never into the key.
        showSimpleToast(
            tran(EXPORT_TITLE),
            `${tran('Exported to')} ${archiveFilePath}`,
        );
        showFileOrDirExplorer(archiveFilePath);
    });
}

// One literal, so the translation-coverage sweep can read it.
const IMPORT_REPLACE_MESSAGE =
    'Each ticked section replaces the same section on this computer; what the file leaves out goes back to its default';

async function askForImportSections(
    manifest: SettingArchiveManifestType,
    isProtected: boolean,
) {
    const fileSectionSet = new Set(manifest.sections);
    const isSecureStorageAvailable = appSecureStorage.checkIsAvailable();
    const choices = genSettingTreeChoices(
        countManifestByLeaf(manifest),
        (leaf) => {
            if (!fileSectionSet.has(leaf.id)) {
                return { isHidden: true };
            }
            return {
                isDefaultUnchecked: leaf.isOptInOnImport,
                invalidMessage:
                    leaf.needsPassword &&
                    (!isProtected || !isSecureStorageAvailable)
                        ? 'This computer cannot keep them safely'
                        : undefined,
            };
        },
    );
    let selectedLeafIds: string[] = [];
    const isOk = await showAppInput(
        tran(IMPORT_TITLE),
        <>
            <div className="mb-2" style={{ color: 'var(--bs-warning)' }}>
                <i className="bi bi-exclamation-triangle-fill me-1" />
                {tran(IMPORT_REPLACE_MESSAGE)}
            </div>
            <ArchiveTreeSelectorComp
                choices={choices}
                message="Choose the settings to import"
                onChange={(newSelectedLeafIds) => {
                    selectedLeafIds = newSelectedLeafIds;
                }}
            />
        </>,
        { escToCancel: true, extraStyles: { maxWidth: '700px' } },
    );
    if (!isOk || selectedLeafIds.length === 0) {
        return null;
    }
    return selectedLeafIds;
}

/**
 * Everything the import changed is read again: a reload for most sections, a
 * restart for the ones the main process reads at launch. Asked rather than
 * done, because both close what is open -- a half-typed slide, a screen on
 * the projector -- and Apply Settings stays amber for a later moment.
 */
async function askToApplyImportedSettings(needsRelaunch: boolean) {
    applyStore.pendingApply();
    if (needsRelaunch) {
        const isOk = await showAppConfirm(
            tran('Restart the app to apply'),
            tran('The app will close and open again. Save your work first.'),
            { cancelButtonLabel: 'No', confirmButtonLabel: 'Yes' },
        );
        if (isOk) {
            relaunchApp();
        }
        return;
    }
    const isOk = await showAppConfirm(
        tran('Apply Settings'),
        tran('Will reload the app to apply settings'),
        { cancelButtonLabel: 'No', confirmButtonLabel: 'Yes' },
    );
    if (isOk) {
        forceReloadAppWindows();
    }
}

/**
 * `archiveFilePath` skips the file picker when the file is already known --
 * an automated run that cannot drive a native dialog.
 */
export async function handleSettingsImporting(archiveFilePath?: string) {
    // The reload at the end unmounts the Bible editors, which would discard
    // what is unsaved in them.
    if (
        warnIfAnyBibleEditorDirty(
            'Save or discard unsaved Bible changes before importing settings.',
        )
    ) {
        return;
    }
    return await runMenuAction(IMPORT_TITLE, async () => {
        if (archiveFilePath === undefined) {
            const filePaths = await selectFiles([
                {
                    name: 'Open Worship Settings',
                    // `enc` is the password protected shape of the same file.
                    extensions: ['gz', 'tgz', 'tar', 'enc'],
                },
            ]);
            archiveFilePath = filePaths[0];
        }
        if (!archiveFilePath) {
            return;
        }
        const extractDir = await createWorkDir('owasetting-import');
        try {
            const opened = await runWithProgress(IMPORT_TITLE, () => {
                return openSettingArchive(
                    archiveFilePath as string,
                    extractDir,
                    IMPORT_TITLE,
                );
            });
            // `null` is the password prompt being cancelled -- no toast.
            if (opened === null) {
                return;
            }
            const { manifest, isProtected } = opened;
            if (manifest.sections.length === 0) {
                showSimpleToast(
                    tran(IMPORT_TITLE),
                    'This file holds no settings this version can import',
                );
                return;
            }
            const leafIds = await askForImportSections(manifest, isProtected);
            if (leafIds === null) {
                return;
            }
            const result = await runWithProgress(IMPORT_TITLE, () => {
                return importSettingSections(manifest, leafIds, isProtected);
            });
            showSimpleToast(
                tran(IMPORT_TITLE),
                `Imported ${result.writtenCount} setting(s);` +
                    ` ${result.removedCount} reset to default`,
            );
            await askToApplyImportedSettings(result.needsRelaunch);
        } finally {
            // Also carries away the decrypted copy and the manifest, which
            // can hold credentials in plain text.
            await safeDeleteDir(extractDir);
        }
    });
}
