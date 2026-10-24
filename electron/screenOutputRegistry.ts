import ElectronScreenController from './ElectronScreenController';

// What the rest of main needs from a screen being shown on this computer,
// whether it is a window on a monitor (`ElectronScreenController`) or a page
// inside a virtual display's compositor (`VirtualScreenController`).
export type ScreenOutputType = {
    screenId: number;
    isMoving: boolean;
    sendData: (channel: string, data: any) => void;
    sendMessage: (type: string, data: any) => void;
    close: () => void;
};

const virtualOutputs = new Map<number, ScreenOutputType>();

export function setVirtualScreenOutput(
    screenId: number,
    output: ScreenOutputType,
) {
    virtualOutputs.set(screenId, output);
}

// Only the output that is registered: a screen shown again has a new one.
export function removeVirtualScreenOutput(
    screenId: number,
    output: ScreenOutputType,
) {
    if (virtualOutputs.get(screenId) === output) {
        virtualOutputs.delete(screenId);
    }
}

export function getVirtualScreenOutput(screenId: number) {
    return virtualOutputs.get(screenId) ?? null;
}

export function getVirtualScreenOutputIds() {
    return [...virtualOutputs.keys()];
}

export function getScreenOutput(screenId: number): ScreenOutputType | null {
    return (
        virtualOutputs.get(screenId) ??
        ElectronScreenController.getInstance(screenId)
    );
}
