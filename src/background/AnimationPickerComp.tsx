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
import ColorModeSwitchComp from '../others/ColorModeSwitchComp';
import type { ColorModeType } from '../others/color/colorContrastHelpers';
import AppSuspenseComp from '../others/AppSuspenseComp';
import { useAppCurrentRef, useAppEffect } from '../helper/appHooks';
import { genTimeoutAttempt } from '../helper/timeoutHelpers';
import { tran } from '../lang/langHelpers';
import ShowingScreenIcon from '../_screen/preview/ShowingScreenIcon';
import {
    FillCustomizeToggleComp,
    FillPickerFoldComp,
    type FillPickerCustomizeViewType,
    type FillPickerScreenViewType,
} from './FillPickerComp';
import AnimationTileComp from './AnimationTileComp';
import AnimationPreviewComp from './AnimationPreviewComp';
import AnimationEditorComp from './AnimationEditorComp';
import AnimationExportButtonsComp from './AnimationExportButtonsComp';
import { genAnimationCopyCodeMenuItems } from './animationMenuHelpers';
import {
    genAnimationCategoryLabel,
    genAnimationLabel,
    genAnimationSampleCaption,
    tranAnimationCategory,
    tranAnimationCategoryGroup,
} from './animationLabelHelpers';
import {
    ANIMATION_CATEGORY_GROUP_LIST,
    ANIMATION_CATEGORY_LIST,
    DEFAULT_ANIMATION_CATEGORY,
    findAnimationSampleCategory,
    findAnimationTone,
    listAnimationCategorySamples,
    toInitialAnimationTone,
    type AnimationCategoryType,
    type AnimationSampleType,
} from './animationBuiltInHelpers';
import {
    ANIMATION_PRESET_SETTING_NAME,
    type SavedAnimationPresetType,
    toAnimationCategorySettingName,
    toSavedAnimationPreset,
} from './animationPresetHelpers';
import {
    ANIMATION_PIN_SETTING_NAME,
    checkIsAnimationPinListFull,
    checkIsAnimationPinned,
    readAnimationPins,
    toggleAnimationPin,
} from './animationPinHelpers';
import { subscribeSavedPresets } from '../others/savedPresetHelpers';
import { getSetting, setSetting } from '../helper/settingHelpers';
import {
    compareAnimationSrc,
    parseAnimation,
    toAnimationSrc,
    toAnimationStillFill,
    type AnimationType,
} from './animationValueHelpers';
import { checkIsFillDark, genFillBackground } from './fillValueHelpers';
import {
    genAnimationAgentEditorId,
    registerAnimationAgentEditor,
    type AnimationAgentPlaceType,
} from './animationAgentEditorRegistry';

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

/** One tile of a grid: its animation and the words it is shown with. */
type AnimationTileItemType = {
    src: string;
    /** The tile's own name, already translated. */
    label: string;
    /** The words under it, already translated. */
    caption: string;
    /** The animation's name, for its pin's words. */
    name: string;
};

type AnimationPinViewType = {
    pins: readonly SavedAnimationPresetType[];
    onToggle: (src: string, name: string) => void;
};

function AnimationTileGridComp({
    iconName,
    label,
    items,
    heldSrc,
    onPick,
    pinView,
    headEnd,
}: Readonly<{
    iconName: string;
    label: string;
    items: AnimationTileItemType[];
    heldSrc: string | null;
    onPick: (src: string, event: MouseEvent) => void;
    pinView: AnimationPinViewType;
    headEnd?: ReactNode;
}>) {
    const isPinListFull = checkIsAnimationPinListFull(pinView.pins);
    return (
        <div className="fill-picker-section" role="group" aria-label={label}>
            <div className="fill-picker-head">
                <i className={`bi bi-${iconName}`} aria-hidden="true" />
                <span>{label}</span>
                {headEnd}
            </div>
            <div className="animation-picker-grid">
                {items.map((item) => {
                    return (
                        <AnimationTileComp
                            key={item.src}
                            src={item.src}
                            label={item.label}
                            caption={item.caption}
                            isSelected={compareAnimationSrc(item.src, heldSrc)}
                            onPick={onPick}
                            pin={{
                                name: item.name,
                                isPinned: checkIsAnimationPinned(
                                    pinView.pins,
                                    item.src,
                                ),
                                isPinListFull,
                                onToggle: pinView.onToggle,
                            }}
                        />
                    );
                })}
            </div>
        </div>
    );
}

/**
 * A category's tiles of one kind: each captioned with its effect alone,
 * numbered from its second look on -- the Category list and the switch
 * already say the occasion and the side.
 */
function toCategoryTileItems(
    category: AnimationCategoryType,
    sampleList: AnimationSampleType[],
): AnimationTileItemType[] {
    return sampleList.map((sample) => {
        const name = genAnimationCategoryLabel(
            category,
            sample.animation,
            sample.number,
            sample.tone,
        );
        return {
            src: sample.src,
            label: name,
            caption: genAnimationSampleCaption(sample.animation, sample.number),
            name,
        };
    });
}

function checkIsAnimationCategory(
    value: unknown,
): value is AnimationCategoryType {
    return (ANIMATION_CATEGORY_LIST as readonly unknown[]).includes(value);
}

/**
 * The category a picker shows (2026-11-19, the user: _I want to swhich
 * category_): the one last chosen in this place -- a Background session's
 * pickers, or Animation Show's --, else the held sample's own, else Sunday
 * Worship. It changes only when the person changes it: a press keeps it
 * (`keepCategory`), so the picker a first press swaps in, one per screen,
 * opens on it too, and a pinned tile of another category leaves it be.
 */
function useAnimationCategory(settingName: string, heldSrc: string | null) {
    const [category, setCategory] = useState<AnimationCategoryType>(() => {
        const saved = getSetting(settingName);
        if (checkIsAnimationCategory(saved)) {
            return saved;
        }
        const held = parseAnimation(heldSrc);
        return (
            (held === null ? null : findAnimationSampleCategory(held)) ??
            DEFAULT_ANIMATION_CATEGORY
        );
    });
    const settingNameRef = useAppCurrentRef(settingName);
    const categoryRef = useAppCurrentRef(category);
    const changeCategory = useCallback((value: string) => {
        if (!checkIsAnimationCategory(value)) {
            return;
        }
        setCategory(value);
        setSetting(settingNameRef.current, value);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const keepCategory = useCallback(() => {
        if (getSetting(settingNameRef.current) !== categoryRef.current) {
            setSetting(settingNameRef.current, categoryRef.current);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return { category, changeCategory, keepCategory };
}

/**
 * The side of the Dark / Light switch a picker shows, as the Fills tab's
 * (`FillPickerComp`): it opens on the held animation's side and moves only
 * when what is held is a sample of the OTHER side -- a press on it is never
 * undone by a re-render. The pinned ones stay above whichever side is shown.
 */
function useAnimationTone(heldSrc: string | null) {
    const [tone, setTone] = useState<ColorModeType>(() => {
        return toInitialAnimationTone(heldSrc);
    });
    const heldTone = useMemo(() => {
        return findAnimationTone(heldSrc);
    }, [heldSrc]);
    useAppEffect(() => {
        if (heldTone !== null) {
            setTone(heldTone);
        }
    }, [heldTone]);
    return { tone, setTone };
}

/**
 * The pinned animations, as every mounted picker shows them: a pin made in
 * one -- the Background tab's, Animation Show's -- shows in the others at
 * once, and each stops listening when it goes.
 */
function useAnimationPinList() {
    const [pins, setPins] = useState(readAnimationPins);
    useAppEffect(() => {
        return subscribeSavedPresets(ANIMATION_PIN_SETTING_NAME, (list) => {
            setPins(list as SavedAnimationPresetType[]);
        });
    }, []);
    return pins;
}

function AnimationCategorySelectComp({
    category,
    onChange,
}: Readonly<{
    category: AnimationCategoryType;
    onChange: (value: string) => void;
}>) {
    // Named on the select itself too, as the Effect select is: an agent
    // finds a control by its own title or aria-label, not a wrapping label.
    const label = tran('Category');
    return (
        <label className="animation-picker-category">
            <i className="bi bi-tags" aria-hidden="true" />
            <span>{label}</span>
            <select
                className="form-select form-select-sm"
                aria-label={label}
                title={label}
                value={category}
                onChange={(event) => {
                    onChange(event.target.value);
                }}
            >
                {ANIMATION_CATEGORY_GROUP_LIST.map((item) => {
                    return (
                        <optgroup
                            key={item.group}
                            label={tranAnimationCategoryGroup(item.group)}
                        >
                            {item.categories.map((value) => {
                                return (
                                    <option key={value} value={value}>
                                        {tranAnimationCategory(value)}
                                    </option>
                                );
                            })}
                        </optgroup>
                    );
                })}
            </select>
        </label>
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
 * screens a press is sent to, while none holds one: a Dark / Light switch
 * (2026-11-19, the user: _`Animations` of background and foreground should
 * support dark/light mode, keep the pin_), the pinned ones of either side,
 * then a Category and its samples of the side shown in two boxes, GLSL
 * Shaders above CSS Animations (2026-11-19, the user: _move the css top
 * section to the bottom_;
 * `animationBuiltInHelpers`), the animations somebody saved under them,
 * and Customize for a held one. One screen's picker folds to its first line,
 * and its Customize closes from the first box's line, as the Fills tab's
 * from its Gradients line -- it stays at the top of the tiles.
 *
 * A press (a tile, a saved animation) goes up at once -- pressing what is up
 * takes it down. Customize goes up after a pause (`genTimeoutAttempt`, this
 * picker's own: every screen with an animation has a picker, and each must
 * put up its own last change), so a drag along a slider is one screen
 * change, not one a frame. Edit Code's Apply goes up at once -- Shader Code
 * for a shader, CSS Code for a CSS animation (2026-11-19).
 */
export default function AnimationPickerComp({
    screenView,
    customizeView: customizeViewProp,
    heldSrc,
    onPick,
    onEdit,
    presetSettingName = ANIMATION_PRESET_SETTING_NAME,
    agentPlace = 'background',
}: Readonly<{
    screenView?: FillPickerScreenViewType;
    /** Customize's own toggle, for a picker that is not one screen's. */
    customizeView?: FillPickerCustomizeViewType;
    /** The animation this picker's screen holds; null when it holds none. */
    heldSrc: string | null;
    onPick: (src: string, event: MouseEvent) => void;
    /** A change made in Customize; without it there is nothing to change. */
    onEdit?: (src: string) => void;
    /**
     * Where the saved ones are kept: a Background tab's session keeps its
     * own (`toPaintPresetSettingName`); left out, the one list there has
     * always been.
     */
    presetSettingName?: string;
    /**
     * Which panel this is, for the help window's assistant
     * (`animationAgentEditorRegistry`): the Background panel's, or
     * Animation Show's.
     */
    agentPlace?: AnimationAgentPlaceType;
}>) {
    const heldAnimation = useMemo(() => {
        return parseAnimation(heldSrc);
    }, [heldSrc]);
    const { category, changeCategory, keepCategory } = useAnimationCategory(
        toAnimationCategorySettingName(presetSettingName, agentPlace),
        heldSrc,
    );
    const { tone, setTone } = useAnimationTone(heldSrc);
    const samples = useMemo(() => {
        return listAnimationCategorySamples(category, tone);
    }, [category, tone]);
    const pins = useAnimationPinList();
    // A pinned tile is named from its animation, with its category: it may
    // be of any. Named apart from the category's own tile, so a focus put
    // back after a press (`BackgroundAnimationsComp`) finds the one pressed.
    const pinItems = useMemo(() => {
        return pins.flatMap((pin): AnimationTileItemType[] => {
            const animation = parseAnimation(pin.src);
            if (animation === null) {
                return [];
            }
            const name = genAnimationLabel(animation);
            return [
                {
                    src: pin.src,
                    label: `${tran('Pinned')}: ${name}`,
                    caption: name,
                    name,
                },
            ];
        });
    }, [pins]);
    const pinView = useMemo<AnimationPinViewType>(() => {
        return {
            pins,
            onToggle: (src, name) => {
                toggleAnimationPin(src, name);
            },
        };
    }, [pins]);
    const [draft, setDraft] = useState<AnimationType | null>(heldAnimation);
    // Which code is open, Shader Code or CSS Code; null when none is.
    const [codeEngine, setCodeEngine] = useState<
        AnimationType['engine'] | null
    >(null);
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
    // Code is edited for the animation held: one of the other kind put up,
    // or none, closes it.
    const heldEngine = heldAnimation?.engine ?? null;
    useAppEffect(() => {
        setCodeEngine((engine) => {
            return engine === heldEngine ? engine : null;
        });
    }, [heldEngine]);
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
    const handleCodeApplying = useCallback((animation: AnimationType) => {
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
            keepCategory();
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
    // The help window's assistant changes this animation the way a press in
    // Customize does, and opens its code the way Edit Code does
    // (`owa_animation_edit`). One handle for the picker's life: its
    // functions read the picker as it is at the call.
    const agentEditorId = genAnimationAgentEditorId(
        agentPlace,
        screenView?.screenId ?? null,
    );
    const draftRef = useAppCurrentRef(draft);
    useAppEffect(() => {
        if (!isEditable) {
            return;
        }
        return registerAnimationAgentEditor({
            id: agentEditorId,
            place: agentPlace,
            screenId: screenView?.screenId ?? null,
            getDraftSrc: () => {
                return currentSrcRef.current;
            },
            setDraftSrc: (src) => {
                const animation = parseAnimation(src);
                if (animation === null) {
                    return false;
                }
                handleEditing(animation);
                return true;
            },
            openCode: () => {
                const engine = draftRef.current?.engine;
                if (engine === undefined) {
                    return false;
                }
                setCodeEngine(engine);
                return true;
            },
        });
    }, [agentEditorId, isEditable]);
    const isFolded = screenView?.isFolded === true;
    const isCustomizeOffered = isEditable && draft !== null;
    const customizeView = screenView ?? customizeViewProp;
    const isCustomizeOpen =
        isCustomizeOffered && customizeView?.isCustomizeClosed !== true;
    return (
        <div className="fill-picker animation-picker">
            <div className="fill-picker-bar">
                {screenView === undefined ? null : (
                    <FillPickerFoldComp screenView={screenView} />
                )}
                {isFolded ? null : (
                    <ColorModeSwitchComp
                        mode={tone}
                        onChange={setTone}
                        groupLabel={tran('Animations')}
                        darkTitle={tran('Dark')}
                        lightTitle={tran('Light')}
                    />
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
                        {pinItems.length === 0 ? null : (
                            <AnimationTileGridComp
                                iconName="pin-angle-fill"
                                label={tran('Pinned')}
                                items={pinItems}
                                heldSrc={heldSrc}
                                onPick={handlePicking}
                                pinView={pinView}
                            />
                        )}
                        <AnimationCategorySelectComp
                            category={category}
                            onChange={changeCategory}
                        />
                        <AnimationTileGridComp
                            iconName="gpu-card"
                            label={tran('GLSL Shaders')}
                            items={toCategoryTileItems(category, samples.glsl)}
                            heldSrc={heldSrc}
                            onPick={handlePicking}
                            pinView={pinView}
                            headEnd={
                                isCustomizeOffered &&
                                customizeView !== undefined ? (
                                    <FillCustomizeToggleComp
                                        isOpen={isCustomizeOpen}
                                        onToggle={
                                            customizeView.onCustomizeToggle
                                        }
                                    />
                                ) : null
                            }
                        />
                        <AnimationTileGridComp
                            iconName="filetype-css"
                            label={tran('CSS Animations')}
                            items={toCategoryTileItems(category, samples.css)}
                            heldSrc={heldSrc}
                            onPick={handlePicking}
                            pinView={pinView}
                        />
                        <PresetsRowComp<SavedAnimationPresetType>
                            savedSettingName={presetSettingName}
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
                                <div className="animation-picker-preview-row">
                                    <AnimationDraftPreviewComp
                                        src={currentSrc}
                                    />
                                    <AnimationExportButtonsComp
                                        src={currentSrc}
                                        place={agentPlace}
                                    />
                                </div>
                            )}
                            <AnimationEditorComp
                                animation={draft}
                                onChange={handleEditing}
                                chatbotEditorId={agentEditorId}
                                onCodeEditing={() => {
                                    setCodeEngine(draft.engine);
                                }}
                            />
                        </div>
                    ) : null}
                </>
            )}
            {codeEngine !== null && draft?.engine === codeEngine ? (
                <AppSuspenseComp>
                    <LazyAnimationCodeEditorComp
                        // Shader Code and CSS Code are two panels, each
                        // with its own editor and model.
                        key={codeEngine}
                        agentEditorId={isEditable ? agentEditorId : undefined}
                        animation={draft}
                        onApply={handleCodeApplying}
                        onClose={() => {
                            setCodeEngine(null);
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
