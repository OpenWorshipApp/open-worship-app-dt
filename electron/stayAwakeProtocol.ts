// The stay-awake toggle in the header of the Presenter and of the Screen Mirror
// page. Shared names and pure helpers only: no Electron, renderer or filesystem
// dependency, so the main process, which holds the OS request, and the icon
// that switches it read ONE key and ONE default -- the icon can never say
// something the process is not doing.

// `clientSetting` in `<userData>/setting.json`. Whether THIS computer may
// sleep is a habit of the machine, so it stays out of the data folder, which
// travels between computers.
export const STAY_AWAKE_SETTING_NAME = 'stay-awake';

// On unless switched off. Anything but an explicit `false` -- nothing written
// yet, a value blanked by hand -- keeps the computer awake: a service that
// goes dark because a setting could not be read is the worse of the two
// mistakes.
export function toIsStayAwake(value: string | null) {
    return value !== 'false';
}
