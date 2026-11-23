import {
    CSS_ANIMATION_MOVING_CLASS_NAME,
    CSS_ANIMATION_ON_SCREEN_CLASS_NAME,
    CSS_ANIMATION_ROOT_CLASS_NAME,
    checkIsCssAnimationNodeMoving,
    genCssAnimationNodeStyle,
    genCssAnimationTree,
    toReactStyle,
    type CssAnimationNodeType,
} from '../background/cssAnimationLayerHelpers';
import {
    parseAnimation,
    toAnimationStillFill,
} from '../background/animationValueHelpers';
import { genFillCss } from '../background/fillValueHelpers';

function RenderCssAnimationNodeComp({
    node,
    isMoving,
    className = '',
}: Readonly<{
    node: CssAnimationNodeType;
    isMoving: boolean;
    className?: string;
}>) {
    const movingClassName = checkIsCssAnimationNodeMoving(node, isMoving)
        ? CSS_ANIMATION_MOVING_CLASS_NAME
        : '';
    const fullClassName = `${className} ${movingClassName}`.trim();
    return (
        <div
            className={fullClassName === '' ? undefined : fullClassName}
            style={toReactStyle(genCssAnimationNodeStyle(node, isMoving))}
        >
            {(node.children ?? []).map((child, index) => {
                return (
                    <RenderCssAnimationNodeComp
                        key={index}
                        node={child}
                        isMoving={isMoving}
                    />
                );
            })}
        </div>
    );
}

/**
 * A screen's ANIMATION background drawn as markup (`animationValueHelpers`).
 * A CSS one is its layers (`cssAnimationLayerHelpers`), moving only where it
 * is presented -- `isMoving` is the screen window's -- and still everywhere
 * else: a preview is not worth a frame on an old machine. A shader is never
 * drawn here on a screen (`genHtmlBackground` runs it on a canvas); here it
 * is its still gradient, for a printed page, a run sheet's row or a slide's
 * thumbnail.
 *
 * Drawn through `renderToStaticMarkup`, so it is plain markup: no state, no
 * effect. The keyframes are put in the document by whoever draws it moving
 * (`ensureCssAnimationKeyframes`).
 */
export default function ScreenBackgroundAnimationComp({
    src,
    isMoving,
    isOnScreen = isMoving,
}: Readonly<{
    src: string;
    isMoving: boolean;
    /** Presented: reduced motion does not stop it (a tile it does). */
    isOnScreen?: boolean;
}>) {
    const animation = parseAnimation(src);
    const boxStyle = { width: '100%', height: '100%' };
    if (animation === null) {
        return <div style={boxStyle} />;
    }
    // A shader, and a person's own CSS (drawn from its code in a box of its
    // own, `cssCodeAnimationElementHelpers`): their still gradient here.
    if (animation.engine === 'glsl' || animation.name === 'custom') {
        return (
            <div
                style={{
                    ...boxStyle,
                    ...genFillCss(toAnimationStillFill(animation)),
                    opacity: animation.opacity / 100,
                }}
            />
        );
    }
    const rootClassName =
        CSS_ANIMATION_ROOT_CLASS_NAME +
        (isOnScreen ? ` ${CSS_ANIMATION_ON_SCREEN_CLASS_NAME}` : '');
    return (
        <RenderCssAnimationNodeComp
            node={genCssAnimationTree(animation)}
            isMoving={isMoving}
            className={rootClassName}
        />
    );
}
