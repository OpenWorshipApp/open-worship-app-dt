import {
    use,
    useCallback,
    useState,
    type DragEvent,
    type MouseEvent,
} from 'react';

import ScreenBackgroundManager from '../_screen/managers/ScreenBackgroundManager';
import { showAppContextMenu } from '../context-menu/appContextMenuHelpers';
import { useAppCurrentRef } from '../helper/appHooks';
import { pressElementLikeButton } from '../helper/helpers';
import { handleDragStart } from '../helper/dragHelpers';
import { DragTypeEnum } from '../helper/DragInf';
import { genShowOnScreensContextMenu } from '../others/FileItemHandlerComp';
import { PaintTargetContext } from '../others/color/colorSwatchMenuHelpers';
import AnimationPreviewComp from './AnimationPreviewComp';
import { genAnimationCopyCodeMenuItems } from './animationMenuHelpers';
import { genBackgroundItemTransitionMenuItems } from './backgroundTransitionMenuHelpers';

/** A tile's own width in pixels for a shader's still: small, never blurry. */
const TILE_STILL_WIDTH = 192;

/**
 * One animation of the Animations tab, as a gradient tile is one fill:
 * pressed, it goes up; dragged, it is an animation background; its
 * right-click copies its code, shows it on chosen screens and gives it a
 * transition of its own. Drawn STILL, and moving only while the pointer is
 * on it -- one tile at a time -- so an open panel costs no frame at rest.
 */
export default function AnimationTileComp({
    src,
    label,
    caption,
    isSelected,
    onPick,
}: Readonly<{
    src: string;
    /** Already translated: the tile's whole name. */
    label: string;
    /** The words under the tile, already translated. */
    caption: string;
    isSelected: boolean;
    onPick: (src: string, event: MouseEvent) => void;
}>) {
    const srcRef = useAppCurrentRef(src);
    const onPickRef = useAppCurrentRef(onPick);
    const [isHovered, setIsHovered] = useState(false);
    // In Animation Show the tile's drag and Show on Screens go to the
    // foreground, and its Transition row -- a background's -- is not offered.
    const paintTarget = use(PaintTargetContext);
    const paintTargetRef = useAppCurrentRef(paintTarget);
    const handleDragStarting = useCallback((event: DragEvent) => {
        if (paintTargetRef.current !== null) {
            paintTargetRef.current.handleDragStart(event, srcRef.current);
            return;
        }
        handleDragStart(event, {
            dragSerialize: () => {
                return {
                    type: DragTypeEnum.BACKGROUND_ANIMATION,
                    data: srcRef.current,
                };
            },
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleContextMenu = useCallback((event: MouseEvent) => {
        const animationSrc = srcRef.current;
        const currentTarget = paintTargetRef.current;
        if (currentTarget !== null) {
            showAppContextMenu(event as any, [
                ...genAnimationCopyCodeMenuItems(animationSrc),
                ...currentTarget.genShowOnScreensMenuItems(animationSrc),
            ]);
            return;
        }
        showAppContextMenu(event as any, [
            ...genAnimationCopyCodeMenuItems(animationSrc),
            ...genShowOnScreensContextMenu((menuEvent) => {
                ScreenBackgroundManager.handleBackgroundSelecting(
                    menuEvent,
                    'animation',
                    { src: animationSrc },
                    true,
                );
            }),
            ...genBackgroundItemTransitionMenuItems('animation', animationSrc),
        ]);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleClick = useCallback((event: MouseEvent) => {
        onPickRef.current(srcRef.current, event);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // A div, as a fill tile is, so Enter/Space press it through
    // `pressElementLikeButton`: what follows a press may be the "which
    // screen?" menu, opened at the event's own coordinates.
    const handleKeyDown = useCallback((event: any) => {
        pressElementLikeButton(event);
    }, []);
    return (
        <div className="animation-tile-box">
            <div
                role="button"
                tabIndex={0}
                aria-label={label}
                aria-pressed={isSelected}
                title={label}
                draggable
                onDragStart={handleDragStarting}
                onContextMenu={handleContextMenu}
                onKeyDown={handleKeyDown}
                // Bubbling over/out rather than enter/leave: the same pair
                // every tile here can count on, whatever it draws inside.
                onMouseOver={() => {
                    setIsHovered(true);
                }}
                onMouseOut={(event) => {
                    const related = event.relatedTarget as Node | null;
                    if (
                        related === null ||
                        !event.currentTarget.contains(related)
                    ) {
                        setIsHovered(false);
                    }
                }}
                className={
                    'animation-tile app-caught-hover-pointer' +
                    (isSelected ? ' is-selected' : '')
                }
                onClick={handleClick}
            >
                <AnimationPreviewComp
                    src={src}
                    isMoving={isHovered}
                    stillWidth={TILE_STILL_WIDTH}
                    isDrawnInView
                />
                {isSelected ? (
                    <i
                        className="bi bi-check-lg animation-tile-check"
                        aria-hidden="true"
                    />
                ) : null}
            </div>
            <span className="animation-tile-caption" aria-hidden="true">
                {caption}
            </span>
        </div>
    );
}
