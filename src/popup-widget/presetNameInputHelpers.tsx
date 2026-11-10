import { showAppInput } from './popupWidgetHelpers';

function genPresetNameInput(name: string, onChange: (name: string) => void) {
    return (
        <input
            type="text"
            autoFocus
            className="form-control"
            defaultValue={name}
            onFocus={(event) => {
                event.currentTarget.select();
            }}
            onChange={(event) => {
                onChange(event.target.value);
            }}
        />
    );
}

/**
 * A preset's name, asked in the app's own input popup with a name already
 * filled in and selected: null when it is cancelled or left empty. Shared by
 * every panel that saves looks (Bible/LongText Properties, a foreground
 * component's Properties).
 */
export async function askPresetName(title: string, suggestedName: string) {
    let name = suggestedName;
    const isOk = await showAppInput(
        title,
        genPresetNameInput(name, (newName) => {
            name = newName;
        }),
    );
    return isOk && name.trim() !== '' ? name : null;
}
