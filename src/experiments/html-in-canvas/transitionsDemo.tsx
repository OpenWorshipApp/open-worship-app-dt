/**
 * Slide transitions in canvas space.
 */
import { useRef, useState } from 'react';

import { useAppEffect } from '../../helper/appHooks';

import type { ElementImageType } from './htmlInCanvasTypes';
import {
    SLIDE_WIDTH,
    SLIDE_HEIGHT,
    PREVIEW_WIDTH,
    PREVIEW_HEIGHT,
    COLOR,
    getHicContext,
    withSlideSpace,
    easing,
} from './htmlInCanvasHelpers';
import {
    useHicCanvas,
    useAfterRenderingUpdate,
    useAnimationLoop,
} from './htmlInCanvasHooks';
import {
    DemoFrameComp,
    ButtonComp,
    SliderComp,
    CANVAS_STYLE,
    SlideComp,
} from './htmlInCanvasUiComps';
import { TRANSITION_MAP, TRANSITION_NAME_LIST } from './transitionEffects';

export function TransitionsComp() {
    const [canvasRef, setCanvasRef] = useHicCanvas();
    const slideARef = useRef<HTMLDivElement | null>(null);
    const slideBRef = useRef<HTMLDivElement | null>(null);
    const snapshotRef = useRef<ElementImageType | null>(null);
    const progressRef = useRef(0);

    const [effectName, setEffectName] = useState(TRANSITION_NAME_LIST[0]);
    const [durationMillisecond, setDurationMillisecond] = useState(700);
    const [isIncomingB, setIsIncomingB] = useState(true);
    const [isFrozen, setIsFrozen] = useState(true);
    const [isPlaying, setIsPlaying] = useState(false);
    const [scrub, setScrub] = useState(0);

    const renderAt = (progress: number) => {
        const canvas = canvasRef.current;
        const context = getHicContext(canvas);
        if (canvas === null || context === null) {
            return;
        }
        const outgoingElement = isIncomingB
            ? slideARef.current
            : slideBRef.current;
        const incomingElement = isIncomingB
            ? slideBRef.current
            : slideARef.current;
        if (outgoingElement === null || incomingElement === null) {
            return;
        }
        const snapshot = snapshotRef.current;
        const drawOutgoing = () => {
            if (snapshot !== null) {
                // ElementImage is device-pixel sized, so always give an
                // explicit destination size.
                context.drawElementImage(
                    snapshot,
                    0,
                    0,
                    SLIDE_WIDTH,
                    SLIDE_HEIGHT,
                );
                return;
            }
            context.drawElementImage(outgoingElement, 0, 0);
        };
        const drawIncoming = () => {
            context.drawElementImage(incomingElement, 0, 0);
        };
        context.reset();
        withSlideSpace(context, canvas, () => {
            TRANSITION_MAP[effectName](
                context,
                progress,
                drawOutgoing,
                drawIncoming,
            );
        });
    };

    const releaseSnapshot = () => {
        snapshotRef.current?.close();
        snapshotRef.current = null;
    };

    const play = () => {
        const canvas = canvasRef.current;
        if (canvas === null || isPlaying) {
            return;
        }
        releaseSnapshot();
        if (isFrozen) {
            const outgoingElement = isIncomingB
                ? slideARef.current
                : slideBRef.current;
            if (outgoingElement !== null) {
                try {
                    snapshotRef.current =
                        canvas.captureElementImage(outgoingElement);
                } catch {
                    snapshotRef.current = null;
                }
            }
        }
        progressRef.current = 0;
        setIsPlaying(true);
    };

    useAnimationLoop((elapsedMillisecond) => {
        const raw = Math.min(1, elapsedMillisecond / durationMillisecond);
        progressRef.current = raw;
        renderAt(easing.easeInOut(raw));
        setScrub(Math.round(raw * 100));
        if (raw >= 1) {
            setIsPlaying(false);
            setIsIncomingB(!isIncomingB);
            releaseSnapshot();
        }
    }, isPlaying);

    useAfterRenderingUpdate(() => {
        if (!isPlaying) {
            renderAt(easing.easeInOut(scrub / 100));
        }
    }, [isPlaying, scrub, effectName, isIncomingB, isFrozen]);

    useAppEffect(() => {
        return () => {
            releaseSnapshot();
        };
    }, []);

    return (
        <DemoFrameComp
            summary={
                'Ten slide transitions, all of them pure canvas maths over two ' +
                'live DOM subtrees. Scrub the slider to inspect any frame, or ' +
                'press Play. This is the shape a rewritten effect layer takes.'
            }
            controls={
                <>
                    {TRANSITION_NAME_LIST.map((name) => {
                        return (
                            <ButtonComp
                                key={name}
                                label={name}
                                isActive={name === effectName}
                                onClick={() => {
                                    setEffectName(name);
                                }}
                            />
                        );
                    })}
                </>
            }
            notes={
                <>
                    &quot;Freeze outgoing&quot; captures an{' '}
                    <code>ElementImage</code> of the old slide before the
                    animation, so its DOM could be torn down immediately — today{' '}
                    <code>ScreenVaryAppDocumentManager.render()</code> keeps
                    both slide trees (videos, YouTube players and all) mounted
                    for the whole transition instead.
                </>
            }
        >
            <div
                style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                    marginBottom: 8,
                    flexWrap: 'wrap',
                }}
            >
                <ButtonComp label="Play" onClick={play} isActive={isPlaying} />
                <SliderComp
                    label="scrub"
                    value={scrub}
                    min={0}
                    max={100}
                    onChange={(value) => {
                        if (!isPlaying) {
                            setScrub(value);
                        }
                    }}
                />
                <SliderComp
                    label="ms"
                    value={durationMillisecond}
                    min={150}
                    max={2500}
                    step={50}
                    onChange={setDurationMillisecond}
                />
                <label
                    style={{
                        fontSize: 11,
                        color: COLOR.muted,
                        display: 'inline-flex',
                        gap: 4,
                        alignItems: 'center',
                    }}
                >
                    <input
                        type="checkbox"
                        checked={isFrozen}
                        onChange={(event) => {
                            setIsFrozen(event.target.checked);
                        }}
                    />
                    freeze outgoing (captureElementImage)
                </label>
            </div>
            <canvas
                ref={setCanvasRef}
                width={PREVIEW_WIDTH}
                height={PREVIEW_HEIGHT}
                style={CANVAS_STYLE}
            >
                <SlideComp
                    elementRef={slideARef}
                    heading="Slide A"
                    lines={['Amazing grace,', 'how sweet the sound']}
                />
                <SlideComp
                    elementRef={slideBRef}
                    background="linear-gradient(160deg,#3d0b2e,#1a0714)"
                    heading="Slide B"
                    lines={['That saved a wretch', 'like me']}
                />
            </canvas>
        </DemoFrameComp>
    );
}
