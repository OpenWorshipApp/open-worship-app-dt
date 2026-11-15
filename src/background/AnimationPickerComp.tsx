import './FillPickerComp.scss';
import './AnimationPickerComp.scss';

import {
    lazy,
    type MouseEvent,
    type ReactNode,
    useCallback,
    useMemo,
    useRef,
    useState,
} from 'react';

import PresetsRowComp from '../others/PresetsRowComp';
import AppSuspenseComp from '../others/AppSuspenseComp';
import { useAppCurrentRef, useAppEffect } from '../helper/appHooks';
import { genTimeoutAttempt } from '../helper/timeoutHelpers';
import { tran } from '../lang/langHelpers';
import ShowingScreenIcon from '../_screen/preview/ShowingScreenIcon';
import {
    FillCustomizeToggleComp,
    FillPickerFoldComp,
    type FillPickerScreenViewType,
} from './FillPickerComp';
import AnimationTileComp from './AnimationTileComp';
import AnimationPreviewComp from './AnimationPreviewComp';
import AnimationEditorComp from './AnimationEditorComp';
import { genAnimationCopyCodeMenuItems } from './animationMenuHelpers';
import { genAnimationLabel, tranAnimationTheme } from './animationLabelHelpers';
import {
    CSS_ANIMATION_SAMPLE_LIST,
    GLSL_ANIMATION_SAMPLE_LIST,
    type AnimationSampleType,
} from './animationBuiltInHelpers';
import {
    ANIMATION_PRESET_SETTING_NAME,
    type SavedAnimationPresetType,
    toSavedAnimationPreset,
} from './animationPresetHelpers';
import {
    compareAnimationSrc,
    parseAnimation,
    toAnimationSrc,
    toAnimationStillFill,
    type AnimationType,
    type GlslAnimationType,
} from './animationValueHelpers';
import { checkIsFillDark, genFillBackground } from './fillValueHelpers';

const LazyAnimationCodeEditorComp = lazy(() => {
    return import('./AnimationCodeEditorComp');
});

function genSavedMenuItems(preset: SavedAnimationPresetType) {
    return genAnimationCopyCodeMenuItems(preset.src);
}

function genSavedChipColors(preset: SavedAnimationPresetType) {
    const animation = parseAnimation(preset.src);
    if (animation === null) {
        return null;
    }
    const fill = toAnimationStillFill(animation);
    return {
        color: checkIsFillDark(fill) ? '#FFFFFF' : '#000000',
        backgroundColor: genFillBackground(fill),
    };
}

function AnimationTileGridComp({
    iconName,
    label,
    sampleList,
    heldSrc,
    onPick,
    headEnd,
}: Readonly<{
    iconName: string;
    label: string;
    sampleList: AnimationSampleType[];
    heldSrc: string | null;
    onPick: (src: string, event: MouseEvent) => void;
    headEnd?: ReactNode;
}>) {
    return (
        <div className="fill-picker-section" role="group" aria-label={label}>
            <div className="fill-picker-head">
                <i className={`bi bi-${iconName}`} aria-hidden="true" />
                <span>{label}</span>
                {headEnd}
            </div>
            <div className="animation-picker-grid">
                {sampleList.map((sample) => {
                    return (
                        <AnimationTileComp
                            key={sample.src}
                            src={sample.src}
                            label={genAnimationLabel(sample.animation)}
                            caption={tranAnimationTheme(sample.theme)}
                            isSelected={compareAnimationSrc(
                                sample.src,
                                heldSrc,
                            )}
                            onPick={onPick}
                        />
                    );
                })}
            </div>
        </div>
    );
}

/** What a folded picker's screen holds: its colours and its name. */
function AnimationHeldComp({
    animation,
}: Readonly<{ animation: AnimationType }>) {
    const label = genAnimationLabel(animation);
    return (
        <span className="fill-picker-held" title={label}>
            <span
                className="fill-picker-held-tile"
                style={{
                    background: genFillBackground(
                        toAnimationStillFill(animation),
                    ),
                }}
                aria-hidden="true"
            />
            <span className="fill-picker-held-label">{label}</span>
        </span>
    );
}

/**
 * The Background panel's Animations for one screen -- or for whichever
 * screens a press is sent to, while none holds one: the samples in two
 * boxes, CSS Animations and GLSL Shaders, each a season or theme of worship
 * (`animationBuiltInHelpers`), the animations somebody saved under them,
 * and Customize for a held one. One screen's picker folds to its first line,
 * and its Customize closes from the CSS line, as the Fills tab's do.
 *
 * A press (a tile, a saved animation) goes up at once -- pressing what is up
 * takes it down. Customize goes up after a pause (`genTimeoutAttempt`, this
 * picker's own: every screen with an animation has a picker, and each must
 * put up its own last change), so a drag along a slider is one screen
 * change, not one a frame. Edit Code's Apply goes up at once.
 */
export default function AnimationPickerComp({
    screenView,
    heldSrc,
    onPick,
    onEdit,
}: Readonly<{
    screenView?: FillPickerScreenViewType;
    /** The animation this picker's screen holds; null when it holds none. */
    heldSrc: string | null;
    onPick: (src: string, event: MouseEvent) => void;
    /** A change made in Customize; without it there is nothing to change. */
    onEdit?: (src: string) => void;
}>) {
    const heldAnimation = useMemo(() => {
        return parseAnimation(heldSrc);
    }, [heldSrc]);
    const [draft, setDraft] = useState<AnimationType | null>(heldAnimation);
    const [isCodeOpen, setIsCodeOpen] = useState(false);
    const pendingSrcRef = useRef<string | null>(null);
    const attemptTimeout = useMemo(() => {
        return genTimeoutAttempt(500);
    }, []);
    const onEditRef = useAppCurrentRef(onEdit);
    const onPickRef = useAppCurrentRef(onPick);
    const flushEdit = useCallback(() => {
        const src = pendingSrcRef.current;
        pendingSrcRef.current = null;
        if (src !== null) {
            onEditRef.current?.(src);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    // What the screen holds now is what Customize shows -- unless a change
    // is still on its way up, which that would undo under the pointer.
    useAppEffect(() => {
        if (pendingSrcRef.current === null) {
            setDraft(heldAnimation);
        }
    }, [heldAnimation]);
    // A shader's code is edited for the shader held: another one put up,
    // or none, closes it.
    useAppEffect(() => {
        if (heldAnimation?.engine !== 'glsl') {
            setIsCodeOpen(false);
        }
    }, [heldAnimation?.engine]);
    // A change still waiting when the picker goes (the tab closed) goes up
    // now rather than never; `onEdit` itself decides whether it still can.
    useAppEffect(() => {
        return () => {
            attemptTimeout(flushEdit, true);
        };
    }, []);
    const handleEditing = useCallback((animation: AnimationType) => {
        setDraft(animation);
        pendingSrcRef.current = toAnimationSrc(animation);
        attemptTimeout(flushEdit);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleCodeApplying = useCallback((animation: GlslAnimationType) => {
        setDraft(animation);
        pendingSrcRef.current = toAnimationSrc(animation);
        attemptTimeout(flushEdit, true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handlePicking = useCallback(
        (src: string, event: MouseEvent) => {
            // A press wins over a change still waiting: put up later, the
            // change would take the press's animation straight back down.
            pendingSrcRef.current = null;
            attemptTimeout(() => {}, true);
            onPickRef.current(src, event);
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const currentSrc = draft === null ? null : toAnimationSrc(draft);
    const currentSrcRef = useAppCurrentRef(currentSrc);
    const readCurrent = useCallback(() => {
        return { src: currentSrcRef.current ?? '' };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const isEditable = onEdit !== undefined;
    const isFolded = screenView?.isFolded === true;
    const isCustomizeOffered = isEditable && draft !== null;
    const isCustomizeOpen =
        isCustomizeOffered && screenView?.isCustomizeClosed !== true;
    return (
        <div className="fill-picker animation-picker">
            <div className="fill-picker-bar">
                {screenView === undefined ? null : (
                    <FillPickerFoldComp screenView={screenView} />
                )}
                {screenView === undefined ? null : (
                    <ShowingScreenIcon screenId={screenView.screenId} />
                )}
                {isFolded && heldAnimation !== null ? (
                    <AnimationHeldComp animation={heldAnimation} />
                ) : null}
            </div>
            {isFolded ? null : (
                <>
                    <div className="fill-picker-box">
                        <AnimationTileGridComp
                            iconName="filetype-css"
                            label={tran('CSS Animations')}
                            sampleList={CSS_ANIMATION_SAMPLE_LIST}
                            heldSrc={heldSrc}
                            onPick={handlePicking}
                            headEnd={
                                isCustomizeOffered &&
                                screenView !== undefined ? (
                                    <FillCustomizeToggleComp
                                        isOpen={isCustomizeOpen}
                                        onToggle={screenView.onCustomizeToggle}
                                    />
                                ) : null
                            }
                        />
                        <AnimationTileGridComp
                            iconName="gpu-card"
                            label={tran('GLSL Shaders')}
                            sampleList={GLSL_ANIMATION_SAMPLE_LIST}
                            heldSrc={heldSrc}
                            onPick={handlePicking}
                        />
                        <PresetsRowComp<SavedAnimationPresetType>
                            savedSettingName={ANIMATION_PRESET_SETTING_NAME}
                            toSavedPreset={toSavedAnimationPreset}
                            builtIns={[]}
                            readCurrent={readCurrent}
                            onSavedPick={(preset, event) => {
                                handlePicking(preset.src, event);
                            }}
                            genSavedChipColors={genSavedChipColors}
                            genSavedMenuItems={genSavedMenuItems}
                            canSave={currentSrc !== null}
                        />
                    </div>
                    {isCustomizeOpen && draft !== null ? (
                        <div className="fill-picker-box animation-picker-editor">
                            {currentSrc === null ? null : (
                                <AnimationDraftPreviewComp src={currentSrc} />
                            )}
                            <AnimationEditorComp
                                animation={draft}
                                onChange={handleEditing}
                                onCodeEditing={
                                    draft.engine === 'glsl'
                                        ? () => {
                                              setIsCodeOpen(true);
                                          }
                                        : undefined
                                }
                            />
                        </div>
                    ) : null}
                </>
            )}
            {isCodeOpen && draft?.engine === 'glsl' ? (
                <AppSuspenseComp>
                    <LazyAnimationCodeEditorComp
                        animation={draft}
                        onApply={handleCodeApplying}
                        onClose={() => {
                            setIsCodeOpen(false);
                        }}
                    />
                </AppSuspenseComp>
            ) : null}
        </div>
    );
}

/**
 * Customize's own picture of the draft: still, and moving while the pointer
 * is on it, as a tile.
 */
function AnimationDraftPreviewComp({ src }: Readonly<{ src: string }>) {
    const [isHovered, setIsHovered] = useState(false);
    return (
        <div
            className="animation-tile is-preview"
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
        >
            <AnimationPreviewComp
                src={src}
                isMoving={isHovered}
                stillWidth={240}
            />
        </div>
    );
}
