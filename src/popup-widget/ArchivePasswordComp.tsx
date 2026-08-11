import { type ChangeEvent, useCallback, useState } from 'react';

import { useAppEffect } from '../helper/appHooks';
import { tran } from '../lang/langHelpers';
import { showAppInput } from './popupWidgetHelpers';

/**
 * The dialog every export and import asks its password through.
 *
 * Every export asks — one dialog, both fields optional, empty means the bundle
 * is written exactly as it always was. Nothing about the archive formats changes
 * when a password IS given either: the finished `.tar`/`.tar.gz` is wrapped
 * whole (`electron/archiveCryptoHelpers.ts`), so an unprotected export and every
 * bundle already on someone's disk keep working untouched.
 *
 * Kept apart from `src/helper/archivePasswordHelpers.ts`, which is what the
 * archive code imports: this file reaches React and `tran` (and through `tran`,
 * the whole loaded language pack), and none of that should ride along in the
 * five archive modules that merely need to be ABLE to ask. They load it on
 * demand instead — a password dialog is only ever needed after a click.
 */

/**
 * How many times a wrong password may be retyped before the flow gives up. The
 * container's key check makes each rejection cost one derivation and no file
 * I/O, so retrying is cheap even against a multi-gigabyte archive.
 *
 * Exported because the two flows that render `ArchivePasswordComp` INSIDE their
 * own picker (Export Data, Export Bible Data) run the same retry loop rather
 * than calling `askForNewArchivePassword`, and three flows disagreeing about how
 * many tries an operator gets would be the kind of difference nobody notices.
 */
export const MAX_PASSWORD_ATTEMPTS = 3;

function PasswordFieldComp({
    label,
    value,
    isRevealed,
    onChange,
}: Readonly<{
    label: string;
    value: string;
    isRevealed: boolean;
    onChange: (newValue: string) => void;
}>) {
    // No `useCallback` here on purpose: the field re-renders on every keystroke
    // regardless, so a stable identity would buy nothing and only add a ref.
    return (
        <div className="input-group mt-1">
            <div className="input-group-text">{tran(label)}</div>
            <input
                className="form-control form-control-sm"
                type={isRevealed ? 'text' : 'password'}
                value={value}
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                    onChange(event.target.value);
                }}
            />
        </div>
    );
}

/**
 * The fields themselves, exported because the Export Data flow renders them
 * INSIDE its folder-picking popup — asking for the folders and then asking for a
 * password would be two dialogs for one action.
 *
 * The value leaves through `onChange` rather than being read from here:
 * `showAppInput` resolves only Ok/Cancel, so the caller holds the answer. Same
 * arrangement as `ArchiveItemSelectorComp`.
 */
export function ArchivePasswordComp({
    isConfirming,
    invalidMessage,
    onChange,
}: Readonly<{
    /** Export asks twice; import asks once, against a bundle already written. */
    isConfirming: boolean;
    invalidMessage?: string;
    onChange: (password: string, confirmedPassword: string) => void;
}>) {
    // Both fields in one piece of state: they are reported together, and two
    // separate ones would need a handler to read the other's rendered value —
    // which is the stale value when both change in the same tick.
    const [passwords, setPasswords] = useState({
        password: '',
        confirmedPassword: '',
    });
    const { password, confirmedPassword } = passwords;
    const [isRevealed, setIsRevealed] = useState(false);
    const handlePasswordChanging = useCallback((newPassword: string) => {
        setPasswords((currentPasswords) => {
            return { ...currentPasswords, password: newPassword };
        });
    }, []);
    const handleConfirmedPasswordChanging = useCallback(
        (newConfirmedPassword: string) => {
            setPasswords((currentPasswords) => {
                return {
                    ...currentPasswords,
                    confirmedPassword: newConfirmedPassword,
                };
            });
        },
        [],
    );
    // Reported from an effect rather than from each handler: one place the
    // answer leaves the component, and the caller is told the starting value
    // too.
    //
    // `onChange` is IN the dependency list, and must stay there. A mismatched
    // confirmation re-opens this dialog, which hands over a fresh closure while
    // React keeps the mounted component and its state — so an effect that only
    // watched the values would never fire again, the new closure would never be
    // told anything, and pressing Ok a second time read the password as empty
    // and exported the bundle UNPROTECTED. Silently: the operator asked for a
    // password and got none.
    useAppEffect(() => {
        onChange(password, confirmedPassword);
    }, [onChange, password, confirmedPassword]);
    const handleRevealingToggling = useCallback(() => {
        setIsRevealed((isCurrentlyRevealed) => {
            return !isCurrentlyRevealed;
        });
    }, []);
    // The two fields simply have to AGREE — including when both are empty,
    // which is the "no password" answer the hint below invites.
    //
    // Demanding a non-empty password to settle the complaint left the re-ask's
    // `invalidMessage` showing after the operator cleared both fields: the
    // dialog said the input was wrong while Ok would have accepted it. The same
    // gap let a password typed into the CONFIRMATION alone read as "no
    // password" and export unprotected without a word; now the two disagree, so
    // it is flagged and the callers below refuse it.
    const isMismatched = isConfirming && password !== confirmedPassword;
    // Only the confirming dialog can settle its own complaint that way: an
    // import has nothing to compare against, so its "Wrong password, try again"
    // must stay up while the password is retyped and only a fresh attempt can
    // clear it.
    const message = isMismatched
        ? 'Passwords do not match'
        : isConfirming
          ? undefined
          : invalidMessage;
    return (
        <div className="app-archive-password d-flex flex-column">
            <PasswordFieldComp
                label="Password"
                value={password}
                isRevealed={isRevealed}
                onChange={handlePasswordChanging}
            />
            {isConfirming ? (
                <PasswordFieldComp
                    label="Confirm Password"
                    value={confirmedPassword}
                    isRevealed={isRevealed}
                    onChange={handleConfirmedPasswordChanging}
                />
            ) : null}
            <div className="d-flex align-items-center mt-1">
                <button
                    className="btn btn-sm btn-outline-secondary"
                    type="button"
                    onClick={handleRevealingToggling}
                >
                    <i className={`bi bi-eye${isRevealed ? '-slash' : ''}`} />
                    {tran(isRevealed ? 'Hide Password' : 'Show Password')}
                </button>
                <small className="flex-grow-1 ms-2">
                    {isConfirming
                        ? tran('Leave empty to export without a password')
                        : null}
                </small>
            </div>
            {message ? (
                <div className="mt-1" style={{ color: 'var(--bs-warning)' }}>
                    {tran(message)}
                </div>
            ) : null}
        </div>
    );
}

/**
 * Ask what to protect an export with. `''` means "no password" — the common
 * answer, and the one that leaves the bundle byte for byte what it has always
 * been. `null` means the operator cancelled the whole export.
 *
 * A mismatched confirmation re-opens the dialog instead of exporting: a backup
 * locked behind a password that was mistyped once is a backup that is gone.
 */
export async function askForNewArchivePassword(
    title: string,
): Promise<string | null> {
    let invalidMessage: string | undefined = undefined;
    for (let attempt = 0; attempt < MAX_PASSWORD_ATTEMPTS; attempt++) {
        let password = '';
        let confirmedPassword = '';
        const isOk = await showAppInput(
            // The popup renders its title raw — `askForURL` translates its own
            // for the same reason.
            tran(title),
            <ArchivePasswordComp
                isConfirming
                invalidMessage={invalidMessage}
                onChange={(newPassword, newConfirmedPassword) => {
                    password = newPassword;
                    confirmedPassword = newConfirmedPassword;
                }}
            />,
            { escToCancel: true },
        );
        if (!isOk) {
            return null;
        }
        // Agreement is the whole test, empty included — `''` on both sides is
        // the "no password" answer. Accepting a `''` password against a filled
        // confirmation, as this used to, exported unprotected while the dialog
        // was showing the operator a mismatch.
        if (password === confirmedPassword) {
            return password;
        }
        invalidMessage = 'Passwords do not match';
    }
    return null;
}

/** Ask for the password of an archive being read. `null` means cancelled. */
export async function askForArchivePassword(
    title: string,
    invalidMessage?: string,
): Promise<string | null> {
    let password = '';
    const isOk = await showAppInput(
        tran(title),
        <ArchivePasswordComp
            isConfirming={false}
            invalidMessage={
                invalidMessage ?? 'This archive is password protected'
            }
            onChange={(newPassword) => {
                password = newPassword;
            }}
        />,
        { escToCancel: true },
    );
    if (!isOk || password === '') {
        return null;
    }
    return password;
}
