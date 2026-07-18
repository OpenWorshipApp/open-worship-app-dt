import type { GuideLineType, SnapLinesType } from './canvasSnapGuideHelpers';

export function CanvasGuideLineComp({
    guide,
    onPointerDown,
    onRemove,
}: Readonly<{
    guide: GuideLineType;
    onPointerDown: (event: any) => void;
    onRemove: () => void;
}>) {
    const isH = guide.axis === 'h';
    return (
        <div
            onPointerDown={onPointerDown}
            onDoubleClick={onRemove}
            title="Drag to move, double-click to remove"
            style={{
                position: 'absolute',
                left: isH ? 0 : guide.pos - 3,
                top: isH ? guide.pos - 3 : 0,
                width: isH ? '100%' : 6,
                height: isH ? 6 : '100%',
                cursor: isH ? 'row-resize' : 'col-resize',
                // Let a finger drag the guide rather than scroll the canvas.
                touchAction: 'none',
                zIndex: 9998,
            }}
        >
            <div
                style={{
                    position: 'absolute',
                    left: isH ? 0 : 3,
                    top: isH ? 3 : 0,
                    width: isH ? '100%' : 1,
                    height: isH ? 1 : '100%',
                    background: '#ff2fa0',
                    pointerEvents: 'none',
                }}
            />
        </div>
    );
}

function renderSnapLine(axis: 'v' | 'h', pos: number, index: number) {
    const isH = axis === 'h';
    return (
        <div
            key={`snap-${axis}-${index}-${pos}`}
            style={{
                position: 'absolute',
                left: isH ? 0 : pos,
                top: isH ? pos : 0,
                width: isH ? '100%' : 1,
                height: isH ? 1 : '100%',
                background: '#00c8ff',
                pointerEvents: 'none',
                zIndex: 9997,
            }}
        />
    );
}

export function CanvasSnapLinesComp({
    vertical,
    horizontal,
}: Readonly<SnapLinesType>) {
    return (
        <>
            {vertical.map((pos, index) => renderSnapLine('v', pos, index))}
            {horizontal.map((pos, index) => renderSnapLine('h', pos, index))}
        </>
    );
}
