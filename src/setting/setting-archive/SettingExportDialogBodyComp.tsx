import { useCallback, useMemo, useState } from 'react';

import { useAppEffect } from '../../helper/appHooks';
import { ArchivePasswordComp } from '../../popup-widget/ArchivePasswordComp';
import ArchiveTreeSelectorComp from '../../popup-widget/ArchiveTreeSelectorComp';
import { genSettingTreeChoices } from './settingArchiveChoiceHelpers';

export type SettingExportAnswerType = {
    leafIds: string[];
    password: string;
    confirmedPassword: string;
};

const PASSWORD_NEEDED_MESSAGE = 'Type a password below to include these';

/**
 * The one Export Settings dialog: which sections, and what to protect the
 * file with. One body rather than two dialogs because the credentials depend
 * on the password -- they are written only into a protected file, so their
 * rows are red and cannot be ticked until a password has been typed, and
 * clearing the password unticks them again (`ArchiveTreeSelectorComp` drops a
 * leaf from the selection the moment it becomes unusable).
 *
 * The answer leaves through `onChange`, from an effect with `onChange` in its
 * dependencies -- see `ArchivePasswordComp` for why a re-opened dialog needs
 * that.
 */
export default function SettingExportDialogBodyComp({
    countByLeafId,
    onChange,
}: Readonly<{
    countByLeafId: Map<string, number>;
    onChange: (answer: SettingExportAnswerType) => void;
}>) {
    const [passwords, setPasswords] = useState({
        password: '',
        confirmedPassword: '',
    });
    const [leafIds, setLeafIds] = useState<string[]>([]);
    const hasPassword = passwords.password !== '';
    const choices = useMemo(() => {
        return genSettingTreeChoices(countByLeafId, (leaf) => {
            if (!leaf.needsPassword) {
                return {};
            }
            return {
                invalidMessage: hasPassword
                    ? undefined
                    : PASSWORD_NEEDED_MESSAGE,
                isDefaultUnchecked: true,
                // The credentials are not read until the file is written --
                // reading one can raise the OS keychain prompt.
                isCountHidden: true,
            };
        });
    }, [countByLeafId, hasPassword]);
    const handlePasswordChanging = useCallback(
        (password: string, confirmedPassword: string) => {
            setPasswords((currentPasswords) => {
                return currentPasswords.password === password &&
                    currentPasswords.confirmedPassword === confirmedPassword
                    ? currentPasswords
                    : { password, confirmedPassword };
            });
        },
        [],
    );
    useAppEffect(() => {
        onChange({ leafIds, ...passwords });
    }, [onChange, leafIds, passwords]);
    return (
        <>
            <ArchiveTreeSelectorComp
                choices={choices}
                message="Choose the settings to export"
                onChange={setLeafIds}
            />
            <div className="mt-3 pt-3 border-top">
                <ArchivePasswordComp
                    isConfirming
                    onChange={handlePasswordChanging}
                />
            </div>
        </>
    );
}
