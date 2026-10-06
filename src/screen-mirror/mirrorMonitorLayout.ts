type BoundsType = { x: number; y: number; width: number; height: number };

export type MirrorMonitorBoxType = {
    id: number;
    left: number;
    top: number;
    width: number;
    height: number;
    resolution: string;
    isPrimary: boolean;
};

/**
 * This computer's monitors drawn to scale, arranged the way the operating
 * system arranges them, inside a `maxWidth` x `maxHeight` box. The host lists
 * each of them by the same resolution in its display picker.
 */
export function layoutMirrorMonitors(
    displays: { id: number; bounds: BoundsType }[],
    primaryId: number | null,
    maxWidth: number,
    maxHeight: number,
) {
    if (displays.length === 0) {
        return { width: 0, height: 0, boxes: [] as MirrorMonitorBoxType[] };
    }
    const minX = Math.min(...displays.map(({ bounds }) => bounds.x));
    const minY = Math.min(...displays.map(({ bounds }) => bounds.y));
    const maxX = Math.max(
        ...displays.map(({ bounds }) => bounds.x + bounds.width),
    );
    const maxY = Math.max(
        ...displays.map(({ bounds }) => bounds.y + bounds.height),
    );
    const scale = Math.min(maxWidth / (maxX - minX), maxHeight / (maxY - minY));
    const boxes = displays.map(({ id, bounds }) => ({
        id,
        left: Math.round((bounds.x - minX) * scale),
        top: Math.round((bounds.y - minY) * scale),
        width: Math.round(bounds.width * scale),
        height: Math.round(bounds.height * scale),
        resolution: `${bounds.width}×${bounds.height}`,
        isPrimary: id === primaryId,
    }));
    return {
        width: Math.round((maxX - minX) * scale),
        height: Math.round((maxY - minY) * scale),
        boxes,
    };
}
