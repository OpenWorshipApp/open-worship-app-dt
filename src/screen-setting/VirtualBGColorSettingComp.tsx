import {
    type ChangeEvent,
    type MouseEvent as ReactMouseEvent,
    useCallback,
    useRef,
} from 'react';

import { tran } from '../lang/langHelpers';

const DEFAULT_DOCX_PREVIEW_BACKGROUND_COLOR = '#FFFFFF';
const EMPTY_DOCX_PREVIEW_ICON_COLOR = '#adb5bd30';

export default function VirtualBGColorSettingComp({
    docxPreviewBackgroundColor = null,
    onDocxPreviewBackgroundColorChange,
}: Readonly<{
    docxPreviewBackgroundColor?: string | null;
    onDocxPreviewBackgroundColorChange?: (color: string) => void;
}>) {
    const colorInputRef = useRef<HTMLInputElement>(null);
    const handleDocxPreviewBackgroundOpening = useCallback(
        (event: ReactMouseEvent<HTMLElement>) => {
            event.preventDefault();
            event.stopPropagation();
            colorInputRef.current?.click();
        },
        [],
    );
    const handleDocxPreviewBackgroundChanging = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            onDocxPreviewBackgroundColorChange?.(
                event.target.value.toUpperCase(),
            );
        },
        [onDocxPreviewBackgroundColorChange],
    );
    const handleDocxPreviewBackgroundClearing = useCallback(
        (event: ReactMouseEvent<HTMLElement>) => {
            event.preventDefault();
            event.stopPropagation();
            onDocxPreviewBackgroundColorChange?.('');
        },
        [onDocxPreviewBackgroundColorChange],
    );
    return (
        <div className="d-flex align-items-center">
            <input
                ref={colorInputRef}
                className="visually-hidden position-absolute"
                type="color"
                value={
                    docxPreviewBackgroundColor ??
                    DEFAULT_DOCX_PREVIEW_BACKGROUND_COLOR
                }
                onChange={handleDocxPreviewBackgroundChanging}
            />
            <button
                type="button"
                className="btn btn-sm p-0 ms-1 border-0"
                title={tran(
                    'Choose DOCX Preview Background (right click to clear)',
                )}
                onClick={handleDocxPreviewBackgroundOpening}
                onContextMenu={handleDocxPreviewBackgroundClearing}
                style={{ color: 'inherit' }}
            >
                <i
                    className="bi bi-record-circle app-caught-hover-pointer"
                    style={{
                        color:
                            docxPreviewBackgroundColor ||
                            EMPTY_DOCX_PREVIEW_ICON_COLOR,
                    }}
                />
                {docxPreviewBackgroundColor ? (
                    <i
                        className="bi bi-x-lg app-caught-hover-pointer mx-1"
                        title={
                            'Clear DOCX Preview Background, or ' +
                            'right click the color picker'
                        }
                        onClick={handleDocxPreviewBackgroundClearing}
                        style={{
                            color: 'red',
                        }}
                    />
                ) : null}
            </button>
        </div>
    );
}
