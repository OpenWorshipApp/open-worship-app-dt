import './foregroundProperties.scss';

import { useCallback, useMemo, useRef, useState } from 'react';

import ScreenLongTextManager from '../_screen/managers/ScreenLongTextManager';
import { useScreenLongTextManagerEvents } from '../_screen/managers/screenEventHelpers';
import type { LongTextColumnStyleType } from '../_screen/screenLongTextTypeHelpers';
import { toLongTextSectionKey } from '../_screen/screenLongTextTypeHelpers';
import type { LongTextItemDataType } from '../_screen/screenTypeHelpers';
import ContextMenuDotsButtonComp from '../context-menu/ContextMenuDotsButtonComp';
import { useKeyboardRegistering } from '../event/KeyboardEventListener';
import { useAppCurrentRef, useAppEffect } from '../helper/appHooks';
import { useFileSourceEvents } from '../helper/dirSourceHelpers';
import { handleError } from '../helper/errorHelpers';
import { getSetting, setSetting } from '../helper/settingHelpers';
import { genTimeoutAttempt } from '../helper/timeoutHelpers';
import { slideMovingEventMappers } from '../keyboard-shortcut/appShortcutMappers';
import {
    KEYING_AREA_PRIORITY,
    registerKeyingArea,
} from '../keyboard-shortcut/keyingAreaHelpers';
import { tran } from '../lang/langHelpers';
import BibleCustomStyleFloatingToggleComp from '../screen-setting/BibleCustomStyleFloatingToggleComp';
import { getFileName, pathBasename } from '../server/fileHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import ForegroundLayoutComp from './ForegroundLayoutComp';
import type {
    LongTextLanguageType,
    LongTextOutlineType,
    LongTextProblemType,
    LongTextReadProblemType,
    LongTextScreenRowType,
    LongTextSessionType,
    LongTextSourceType,
} from './foregroundLongTextHelpers';
import {
    LONG_TEXT_WIDGET_KEY,
    genLongTextItemData,
    genLongTextLanguage,
    genLongTextStyleByCode,
    mapLongTextSectionKey,
    parseLongTextSession,
    serializeLongTextSession,
    toLongTextCardText,
    toLongTextColumnCode,
    toLongTextOutline,
    toLongTextSettingName,
    toLongTextSourceId,
    toRawResolvedLanguage,
    verifyLongText,
} from './foregroundLongTextHelpers';
import {
    genLongTextColumnInput,
    toLongTextLanguageLabel,
} from './foregroundLongTextLangHelpers';
import { resolveLongTextLanguage } from './foregroundLongTextLyricHelpers';
import {
    chooseLongTextLangCode,
    chooseLyricFilePath,
} from './foregroundLongTextMenuHelpers';
import ForegroundLongTextStyleComp from './ForegroundLongTextStyleComp';
import { PropOptionsComp } from './ForegroundPropRowComp';
import { useForegroundSessions } from './foregroundSessionHelpers';
import ScreensRendererComp from './ScreensRendererComp';

/**
 * One text in several languages, put up the way several Bibles are: a column
 * per language, a row per section, scrolled together -- a song for a room to
 * sing along to.
 *
 * A SESSION is one such text. Each of its cards is one LANGUAGE, there once,
 * and holds either typed text (a title, then a box per section) or a lyric
 * file of the Documents folder. Before anything goes up the languages are
 * checked against each other (`verifyLongText`): rows that paired a verse
 * with another verse's translation would have a room reading the wrong words,
 * so a text that does not line up is not shown at all, and the panel says
 * which part is the one that differs.
 *
 * It is drawn by `ScreenLongTextManager`, the layer a Bible passage is drawn
 * in, so it takes a passage's place on a screen and is styled by the screen's
 * own Bible text style; a card's Properties are what that ONE language says
 * over it.
 */

type OutlineMapType = { [langCode: string]: LongTextOutlineType };

/**
 * What a card needs to offer its sections as buttons that bring one to the
 * middle of the screen.
 */
type LongTextRowsType = {
    // The rows of the text as they would go up, as indexes into a LYRIC
    // language's parts (a typed language has a section per row). Null while
    // the languages do not line up: there are no rows to speak of.
    rowIndexes: number[] | null;
    // Those rows as the screen numbers them -- a LINE each in Atom mode --
    // and what every button stands for: button `i` is screen row `i`. Null
    // exactly when `rowIndexes` is.
    screenRows: LongTextScreenRowType[] | null;
    // Nothing to bring anywhere while the text is on no screen.
    isOnScreen: boolean;
    // The row MARKED on a screen -- the one just brought to the middle, or
    // one clicked on the text itself. Its button is lit in every language's
    // card, so the panel shows where the song has got to.
    checkIsRowSelected: (rowIndex: number) => boolean;
    onBringingToMiddle: (rowIndex: number) => void;
};

// Lit, not filled: on a text card the words are still what is read.
const PART_SELECTED_CLASSNAME = ' fg-part-on';

// A part button carries its ROW, and what holds one card's part buttons is
// marked, so a key steps to the next row's button in the SAME card.
const PART_ROW_DATA_KEY = 'data-long-text-row';
const PARTS_DATA_KEY = 'data-long-text-parts';
const LIT_PART_SELECTOR = `[${PART_ROW_DATA_KEY}][aria-current="true"]`;

// The Show row, docked over the bottom of the panel's scroller.
const ACTIONS_DOCK_CLASSNAME = 'fg-actions-dock';
// Room left between a part brought into view and the docked row above it.
const DOCK_CLEARANCE_PX = 6;

/**
 * Brings a part button into view CLEAR of the docked Show row: that row sits
 * over the bottom of the scroller, and a button brought only as far as the
 * scroller's edge stopped under it, the lit part hidden by the very bar that
 * shows it. The row is measured at the press -- it wraps taller once a few
 * screens have a Hide button in it -- and its height is the button's scroll
 * margin, which `scrollIntoView` keeps clear.
 */
function scrollPartIntoView(button: HTMLElement) {
    const dock =
        button
            .closest('.fg-body')
            ?.querySelector<HTMLElement>(`.${ACTIONS_DOCK_CLASSNAME}`) ?? null;
    button.style.scrollMarginBottom =
        dock === null ? '' : `${dock.offsetHeight + DOCK_CLEARANCE_PX}px`;
    button.scrollIntoView({ block: 'nearest' });
}

// The part button holding focus inside this panel, or null.
function findFocusedPartButton(body: HTMLElement | null) {
    const { activeElement } = document;
    if (
        body === null ||
        !(activeElement instanceof HTMLElement) ||
        !activeElement.hasAttribute(PART_ROW_DATA_KEY) ||
        !body.contains(activeElement)
    ) {
        return null;
    }
    return activeElement;
}

/**
 * Space and the arrows step the song from a part button the way they step the
 * slides preview: with the LIT part's button focused -- the one just pressed
 * -- the next key presses the next part's, and focus goes with it so the key
 * after steps again. Shift+Space and the back arrows go the other way.
 *
 * It stops at either end. A song is sung to its last part, and going round to
 * the first would put the opening verse up in the middle of the ending.
 *
 * A part button that is NOT lit keeps its own keys: Space presses that one,
 * which is what a keyboard user who tabbed to it meant.
 */
function useLongTextPartKeying(
    bodyRef: { current: HTMLDivElement | null },
    sourceId: string,
    rowCount: number,
) {
    const currentRef = useAppCurrentRef({ sourceId, rowCount });
    useKeyboardRegistering(
        slideMovingEventMappers,
        (event) => {
            const button = findFocusedPartButton(bodyRef.current);
            if (button === null) {
                return;
            }
            const { sourceId, rowCount } = currentRef.current;
            const rowIndex = Number(button.getAttribute(PART_ROW_DATA_KEY));
            // The SCREEN's mark, not the button's lit class: the mark moves
            // the moment a row is brought up, and the panel only catches up
            // with it on its next render -- a quick second press would find
            // the button it just focused not lit yet.
            const selectedKeys =
                ScreenLongTextManager.getLongTextSelectedSectionKeys(sourceId);
            if (!selectedKeys.includes(toLongTextSectionKey(rowIndex))) {
                return;
            }
            // The key is this panel's from here, at an end too: left to the
            // button, Space would press the last part again.
            event.preventDefault();
            const isPrevious =
                ['ArrowLeft', 'ArrowUp', 'PageUp'].includes(event.key) ||
                (event.key === ' ' && event.shiftKey);
            const targetRowIndex = rowIndex + (isPrevious ? -1 : 1);
            if (targetRowIndex < 0 || targetRowIndex >= rowCount) {
                return;
            }
            ScreenLongTextManager.bringLongTextRowToMiddle(
                sourceId,
                targetRowIndex,
            );
            const targetButton =
                button
                    .closest(`[${PARTS_DATA_KEY}]`)
                    ?.querySelector<HTMLElement>(
                        `[${PART_ROW_DATA_KEY}="${targetRowIndex}"]`,
                    ) ?? null;
            if (targetButton !== null) {
                // Not the browser's own scroll to a focused element: only as
                // far as it takes to see the card, and at once.
                targetButton.focus({ preventScroll: true });
                scrollPartIntoView(targetButton);
            }
        },
        [],
    );
    // Named to the remote's take-over (`keyingAreaHelpers`), after the run
    // sheet and the slides: three quick presses elsewhere hand the keys to
    // the lit part's button, and stepping quickly through a song from here
    // is never mistaken for a remote going unanswered.
    useAppEffect(() => {
        return registerKeyingArea({
            priority: KEYING_AREA_PRIORITY.longText,
            getElement: () => {
                const body = bodyRef.current;
                return (
                    findFocusedPartButton(body) ??
                    body?.querySelector<HTMLElement>(LIT_PART_SELECTOR) ??
                    null
                );
            },
            checkHasSelected: () => {
                const body = bodyRef.current;
                return (
                    body !== null &&
                    body.querySelector(LIT_PART_SELECTOR) !== null
                );
            },
        });
    }, []);
}

function toReadProblemText(reason: LongTextReadProblemType) {
    if (reason === 'no-file') {
        return tran('No lyric file chosen');
    }
    if (reason === 'missing-part') {
        return tran('This lyric file names a part it does not have');
    }
    return tran('This lyric file could not be read');
}

/** The first thing wrong with a text, in the words the panel shows. */
function toProblemText(problem: LongTextProblemType) {
    if (problem.kind === 'no-language') {
        return tran('No language yet');
    }
    if (problem.kind === 'no-section') {
        return tran('No section yet');
    }
    if (problem.kind === 'unreadable') {
        return (
            `${toLongTextColumnCode(problem.langCode)}: ` +
            toReadProblemText(problem.reason) +
            (problem.partName === undefined ? '' : ` (${problem.partName})`)
        );
    }
    if (problem.kind === 'structure') {
        return (
            `${tran('The songs do not have the same structure')}: ` +
            `${problem.index + 1}. ` +
            `${toLongTextColumnCode(problem.langCode)} ` +
            `${problem.partName ?? '—'} ≠ ` +
            `${toLongTextColumnCode(problem.otherLangCode)} ` +
            `${problem.otherPartName ?? '—'}`
        );
    }
    if (problem.kind === 'lines') {
        // A song's row by its part, as its card is numbered; typed text by
        // its section, as its box is.
        const rowText =
            problem.partName === undefined
                ? `${tran('Section')} ${problem.index + 1}`
                : `${problem.index + 1}. ${problem.partName}`;
        return (
            `${tran('Every language needs the same number of lines')}: ` +
            `${rowText} — ` +
            `${toLongTextColumnCode(problem.langCode)} ${problem.count} ≠ ` +
            `${toLongTextColumnCode(problem.otherLangCode)} ` +
            `${problem.otherCount}`
        );
    }
    if (problem.kind === 'count') {
        return (
            `${tran('Every language needs the same number of sections')}: ` +
            `${toLongTextColumnCode(problem.langCode)} ${problem.count} ≠ ` +
            `${problem.expectedCount}`
        );
    }
    return (
        `${toLongTextColumnCode(problem.langCode)} ` +
        `${tran('Section')} ${problem.index + 1}: ` +
        tran('This section is empty')
    );
}

function moveItem<T>(list: T[], index: number, delta: number) {
    const targetIndex = index + delta;
    if (targetIndex < 0 || targetIndex >= list.length) {
        return list;
    }
    const newList = [...list];
    const [item] = newList.splice(index, 1);
    newList.splice(targetIndex, 0, item);
    return newList;
}

/**
 * Watches ONE lyric file for a card, and nothing when the card has none: the
 * hook under it listens to every file when it is given no path, so it is
 * mounted only with one.
 */
function LongTextLyricWatchComp({
    filePath,
    onChange,
}: Readonly<{ filePath: string; onChange: () => void }>) {
    // Per card: every card of every open session has its own file to follow,
    // and a shared timer would let the last one to change cancel the rest.
    const attemptTimeout = useMemo(() => {
        return genTimeoutAttempt(500);
    }, []);
    const onChangeRef = useAppCurrentRef(onChange);
    useFileSourceEvents(
        ['update', 'delete'],
        () => {
            attemptTimeout(() => {
                onChangeRef.current();
            });
        },
        [],
        filePath,
    );
    return null;
}

function LongTextLyricSourceComp({
    language,
    outline,
    rows,
    onLanguageChange,
    onOutlineChange,
}: Readonly<{
    language: LongTextLanguageType;
    outline: LongTextOutlineType | undefined;
    rows: LongTextRowsType;
    onLanguageChange: (language: LongTextLanguageType) => void;
    onOutlineChange: (
        langCode: string,
        outline: LongTextOutlineType | null,
    ) => void;
}>) {
    const { langCode, lyricFilePath } = language;
    const isCardView = language.sectionView === 'cards';
    const languageRef = useAppCurrentRef(language);
    const onLanguageChangeRef = useAppCurrentRef(onLanguageChange);
    const onOutlineChangeRef = useAppCurrentRef(onOutlineChange);
    // The words of each part, held ONLY while the card is showing them (its
    // text-card view). With the parts as buttons the card keeps their names
    // and lets the words go.
    const [partTextList, setPartTextList] = useState<string[] | null>(null);
    // Reads the file for what the check needs of it -- its parts, and which
    // have words -- and for the words themselves only when the card draws
    // them. They are read again when the text is shown.
    const readOutline = useCallback(async () => {
        const readLanguage = languageRef.current;
        try {
            const resolved = await resolveLongTextLanguage(readLanguage);
            // The card may point at another file, or be another language, by
            // the time this one is read.
            const current = languageRef.current;
            if (
                current.lyricFilePath !== readLanguage.lyricFilePath ||
                current.langCode !== readLanguage.langCode
            ) {
                return;
            }
            onOutlineChangeRef.current(
                readLanguage.langCode,
                toLongTextOutline(resolved),
            );
            setPartTextList(
                current.sectionView === 'cards'
                    ? resolved.sections.map(({ text }) => {
                          return text;
                      })
                    : null,
            );
        } catch (error) {
            handleError(error);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    useAppEffect(() => {
        readOutline();
        return () => {
            onOutlineChangeRef.current(langCode, null);
        };
    }, [langCode, lyricFilePath]);
    // Switching to text cards needs the words, which the card had let go of;
    // switching back lets them go again. Not on the first run: the effect
    // above has just read the file for this mount.
    const isFirstViewRunRef = useRef(true);
    useAppEffect(() => {
        if (isFirstViewRunRef.current) {
            isFirstViewRunRef.current = false;
            return;
        }
        if (isCardView) {
            readOutline();
        } else {
            setPartTextList(null);
        }
    }, [isCardView]);
    const handleChoosing = useCallback(async (event: any) => {
        const current = languageRef.current;
        const filePath = await chooseLyricFilePath(
            event,
            current.lyricFilePath,
        );
        if (filePath === null) {
            return;
        }
        onLanguageChangeRef.current({
            ...languageRef.current,
            lyricFilePath: filePath,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const handleViewToggling = () => {
        const { sectionView: _sectionView, ...languageWithoutView } = language;
        onLanguageChange(
            isCardView
                ? languageWithoutView
                : { ...languageWithoutView, sectionView: 'cards' },
        );
    };
    const code = toLongTextColumnCode(langCode);
    const chooseLabel = `${tran('Choose Lyric')} ${code}`;
    const sungCount = (outline?.steps ?? []).filter(({ isEmpty }) => {
        return !isEmpty;
    }).length;
    const middleLabel = tran('Bring to Middle');
    const viewLabel = `${tran('View as Text Cards')} ${code}`;
    return (
        <div className="d-flex align-items-center flex-wrap gap-2 px-1 pb-1">
            {lyricFilePath === '' ? null : (
                <LongTextLyricWatchComp
                    filePath={lyricFilePath}
                    onChange={readOutline}
                />
            )}
            <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                title={chooseLabel}
                aria-label={chooseLabel}
                onClick={handleChoosing}
            >
                <i className="bi bi-music-note-list" /> {tran('Choose Lyric')}
            </button>
            {lyricFilePath === '' ? (
                <small className="text-muted">
                    {tran('No lyric file chosen')}
                </small>
            ) : (
                <small title={lyricFilePath}>
                    <bdi>{getFileName(pathBasename(lyricFilePath))}</bdi>
                    {outline === undefined ||
                    outline.readProblem !== undefined ? null : (
                        <span className="text-muted">
                            {` — ${outline.title} · ${tran('Sections')}: ${sungCount}`}
                        </span>
                    )}
                </small>
            )}
            {outline?.readProblem === undefined ||
            outline.readProblem.kind === 'no-file' ? null : (
                <small className="text-warning">
                    {toReadProblemText(outline.readProblem.kind)}
                </small>
            )}
            {outline === undefined ||
            rows.rowIndexes === null ||
            rows.screenRows === null ? null : (
                // The song's parts as they are on the screen, one button
                // each: a press brings that row to the middle, which is
                // how an operator follows a band that jumps to the bridge.
                // Numbered as the screen numbers them, so a Chorus sung
                // twice is two buttons and each goes to its own. In Atom
                // mode a button is a LINE of its part, drawn just the same:
                // a verse of four lines is four, numbered on.
                //
                // The first button switches the parts between those
                // buttons and TEXT CARDS -- each button grown to hold
                // its part's words -- for an operator who follows the
                // song by its words rather than by its part names.
                <div
                    className="d-flex flex-wrap align-items-start gap-1 w-100"
                    role="group"
                    aria-label={`${middleLabel} ${code}`}
                    {...{ [PARTS_DATA_KEY]: '' }}
                >
                    <button
                        type="button"
                        className={
                            'btn btn-sm btn-' +
                            (isCardView ? 'secondary' : 'outline-secondary')
                        }
                        title={viewLabel}
                        aria-label={viewLabel}
                        aria-pressed={isCardView}
                        onClick={handleViewToggling}
                    >
                        <i className="bi bi-card-text" />
                    </button>
                    {rows.screenRows.map(({ row, line }, rowIndex) => {
                        const stepIndex = rows.rowIndexes?.[row] ?? -1;
                        const partName =
                            outline.steps[stepIndex]?.partName ?? '';
                        const label =
                            `${middleLabel} ${rowIndex + 1} ` +
                            `${partName} ${code}`;
                        const isSelected = rows.checkIsRowSelected(rowIndex);
                        // One button either way, with one name: as a text
                        // card the WHOLE card is that button -- the words
                        // are the largest thing to aim at, and an operator
                        // following a song presses where they are reading.
                        return (
                            <button
                                type="button"
                                key={rowIndex}
                                // A card is as wide as its words and no
                                // wider, so short parts share a row; a
                                // long one takes the row and wraps.
                                className={
                                    'btn btn-sm btn-outline-secondary' +
                                    (isCardView
                                        ? ' d-inline-block text-start'
                                        : '') +
                                    (isSelected ? PART_SELECTED_CLASSNAME : '')
                                }
                                style={
                                    isCardView
                                        ? {
                                              maxWidth: '100%',
                                              whiteSpace: 'normal',
                                              overflowWrap: 'anywhere',
                                          }
                                        : undefined
                                }
                                title={label}
                                aria-label={label}
                                aria-current={isSelected ? 'true' : undefined}
                                disabled={!rows.isOnScreen}
                                {...{ [PART_ROW_DATA_KEY]: rowIndex }}
                                onClick={() => {
                                    rows.onBringingToMiddle(rowIndex);
                                }}
                            >
                                {isCardView ? (
                                    // On a card the WORDS are what is
                                    // read, so the part's number and
                                    // name step back -- small, muted,
                                    // and a pill of their own, so the
                                    // eye does not read `Verse 1` as
                                    // the song's first words. The
                                    // words run on after it on one
                                    // flowing line: set line by line,
                                    // a song's cards did not fit the
                                    // panel.
                                    <>
                                        <span
                                            className={
                                                'badge rounded-pill border ' +
                                                'text-muted fw-normal'
                                            }
                                        >
                                            {rowIndex + 1} {partName}
                                        </span>{' '}
                                        <span>
                                            {toLongTextCardText(
                                                partTextList?.[stepIndex] ?? '',
                                                line,
                                            )}
                                        </span>
                                    </>
                                ) : (
                                    // As a button the name IS the
                                    // label; only its number is quiet.
                                    <>
                                        <small className="text-muted">
                                            {rowIndex + 1}
                                        </small>{' '}
                                        {partName}
                                    </>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function LongTextRawSourceComp({
    language,
    rows,
    onLanguageChange,
}: Readonly<{
    language: LongTextLanguageType;
    rows: LongTextRowsType;
    onLanguageChange: (language: LongTextLanguageType) => void;
}>) {
    const code = toLongTextColumnCode(language.langCode);
    const setSections = (sections: string[]) => {
        onLanguageChange({ ...language, sections });
    };
    const titleLabel = `${tran('Title')} ${code}`;
    const addLabel = `${tran('Add Section')} ${code}`;
    // Each section's screen rows: the one row a typed section is, or in Atom
    // mode one per line of it. While the languages do not line up there are
    // none, and the section keeps its number as a button that is off.
    const sectionScreenRowIndexes = language.sections.map((_, index) => {
        return rows.screenRows === null ? [index] : [];
    });
    rows.screenRows?.forEach(({ row }, rowIndex) => {
        sectionScreenRowIndexes[row]?.push(rowIndex);
    });
    return (
        <div
            className="d-flex flex-column gap-1 px-1 pb-1"
            {...{ [PARTS_DATA_KEY]: '' }}
        >
            <input
                type="text"
                className="form-control form-control-sm"
                aria-label={titleLabel}
                title={titleLabel}
                placeholder={tran('Title')}
                value={language.title}
                onChange={(event) => {
                    onLanguageChange({
                        ...language,
                        title: event.target.value,
                    });
                }}
            />
            {language.sections.map((section, index) => {
                // Every control carries its language AND its number: a text
                // in two languages of four sections has eight boxes, and one
                // name for all of them is a name nothing can aim with.
                const sectionLabel = `${tran('Section')} ${index + 1} ${code}`;
                const moveUpLabel = `${tran('Move up')} ${index + 1} ${code}`;
                const moveDownLabel = `${tran('Move down')} ${index + 1} ${code}`;
                const removeLabel = `${tran('Remove Section')} ${index + 1} ${code}`;
                return (
                    <div key={index} className="d-flex align-items-start gap-1">
                        {/* The section's number IS its button: a press
                            brings that row to the middle of the screen. A
                            typed language has a section per row, so the
                            number is the row -- and in Atom mode a section
                            has a numbered button per line, one under the
                            other, numbered as the screen numbers them. */}
                        <div className="d-flex flex-column gap-1">
                            {sectionScreenRowIndexes[index].map((rowIndex) => {
                                const middleLabel =
                                    `${tran('Bring to Middle')} ` +
                                    `${rowIndex + 1} ${code}`;
                                const isSelected =
                                    rows.screenRows !== null &&
                                    rows.checkIsRowSelected(rowIndex);
                                return (
                                    <button
                                        key={rowIndex}
                                        type="button"
                                        className={
                                            'btn btn-sm btn-outline-secondary' +
                                            (isSelected
                                                ? PART_SELECTED_CLASSNAME
                                                : '')
                                        }
                                        title={middleLabel}
                                        aria-label={middleLabel}
                                        aria-current={
                                            isSelected ? 'true' : undefined
                                        }
                                        disabled={
                                            !rows.isOnScreen ||
                                            rows.screenRows === null
                                        }
                                        {...{ [PART_ROW_DATA_KEY]: rowIndex }}
                                        onClick={() => {
                                            rows.onBringingToMiddle(rowIndex);
                                        }}
                                    >
                                        {rowIndex + 1}
                                    </button>
                                );
                            })}
                        </div>
                        <textarea
                            className="fg-text-editor flex-grow-1"
                            aria-label={sectionLabel}
                            placeholder={tran('Type a section')}
                            value={section}
                            style={{ height: '60px', minHeight: '40px' }}
                            onChange={(event) => {
                                const sections = [...language.sections];
                                sections[index] = event.target.value;
                                setSections(sections);
                            }}
                        />
                        <div className="d-flex flex-column gap-1">
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary"
                                title={moveUpLabel}
                                aria-label={moveUpLabel}
                                disabled={index === 0}
                                onClick={() => {
                                    setSections(
                                        moveItem(language.sections, index, -1),
                                    );
                                }}
                            >
                                <i className="bi bi-chevron-up" />
                            </button>
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary"
                                title={moveDownLabel}
                                aria-label={moveDownLabel}
                                disabled={
                                    index === language.sections.length - 1
                                }
                                onClick={() => {
                                    setSections(
                                        moveItem(language.sections, index, 1),
                                    );
                                }}
                            >
                                <i className="bi bi-chevron-down" />
                            </button>
                        </div>
                        <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            title={removeLabel}
                            aria-label={removeLabel}
                            onClick={() => {
                                setSections(
                                    language.sections.filter((_, i) => {
                                        return i !== index;
                                    }),
                                );
                            }}
                        >
                            <i className="bi bi-x-lg" />
                        </button>
                    </div>
                );
            })}
            <div>
                <button
                    type="button"
                    className="btn btn-sm btn-outline-primary"
                    title={addLabel}
                    aria-label={addLabel}
                    onClick={() => {
                        setSections([...language.sections, '']);
                    }}
                >
                    <i className="bi bi-plus-lg" /> {tran('Add Section')}
                </button>
            </div>
        </div>
    );
}

function LongTextLanguageCardComp({
    language,
    index,
    languageCount,
    usedLangCodes,
    outline,
    rows,
    onLanguageChange,
    onMoving,
    onRemoving,
    onOutlineChange,
}: Readonly<{
    language: LongTextLanguageType;
    index: number;
    languageCount: number;
    usedLangCodes: string[];
    outline: LongTextOutlineType | undefined;
    rows: LongTextRowsType;
    onLanguageChange: (language: LongTextLanguageType) => void;
    onMoving: (delta: number) => void;
    onRemoving: () => void;
    onOutlineChange: (
        langCode: string,
        outline: LongTextOutlineType | null,
    ) => void;
}>) {
    const [isStyleOpened, setIsStyleOpened] = useState(false);
    const languageRef = useAppCurrentRef(language);
    const usedLangCodesRef = useAppCurrentRef(usedLangCodes);
    const onLanguageChangeRef = useAppCurrentRef(onLanguageChange);
    const handleLangChoosing = useCallback(async (event: any) => {
        const langCode = await chooseLongTextLangCode(
            event,
            usedLangCodesRef.current,
        );
        if (langCode === null) {
            return;
        }
        onLanguageChangeRef.current({ ...languageRef.current, langCode });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const code = toLongTextColumnCode(language.langCode);
    const languageLabel = `${tran('Choose Language')}: ${toLongTextLanguageLabel(
        language.langCode,
    )}`;
    const sourceLabel = `${tran('Source')} ${code}`;
    const moveUpLabel = `${tran('Move up')} ${code}`;
    const moveDownLabel = `${tran('Move down')} ${code}`;
    const removeLabel = `${tran('Remove Language')} ${code}`;
    const propertiesLabel = `${tran('Properties')} ${code}`;
    return (
        <div className="app-border-white-round p-1 my-1">
            <div className="d-flex align-items-center flex-wrap gap-1 pb-1">
                <button
                    type="button"
                    className="btn btn-sm btn-outline-info"
                    title={languageLabel}
                    aria-label={languageLabel}
                    onClick={handleLangChoosing}
                >
                    <i className="bi bi-translate" /> {code}
                </button>
                <PropOptionsComp<LongTextSourceType>
                    label={sourceLabel}
                    options={[
                        { value: 'raw', label: tran('Raw Text') },
                        { value: 'lyric', label: tran('Lyric File') },
                    ]}
                    value={language.source}
                    setValue={(source) => {
                        onLanguageChange({ ...language, source });
                    }}
                />
                <button
                    type="button"
                    className={
                        'fg-props-toggle' +
                        (isStyleOpened ? ' fg-props-toggle-on' : '')
                    }
                    aria-expanded={isStyleOpened}
                    title={propertiesLabel}
                    aria-label={propertiesLabel}
                    onClick={() => {
                        setIsStyleOpened((old) => {
                            return !old;
                        });
                    }}
                >
                    <span>{tran('Properties')}</span>
                    <i className="bi bi-chevron-down" />
                </button>
                <div className="ms-auto d-flex gap-1">
                    <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        title={moveUpLabel}
                        aria-label={moveUpLabel}
                        disabled={index === 0}
                        onClick={() => {
                            onMoving(-1);
                        }}
                    >
                        <i className="bi bi-chevron-up" />
                    </button>
                    <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        title={moveDownLabel}
                        aria-label={moveDownLabel}
                        disabled={index === languageCount - 1}
                        onClick={() => {
                            onMoving(1);
                        }}
                    >
                        <i className="bi bi-chevron-down" />
                    </button>
                    <button
                        type="button"
                        className="btn btn-sm btn-outline-danger"
                        title={removeLabel}
                        aria-label={removeLabel}
                        onClick={onRemoving}
                    >
                        <i className="bi bi-x-lg" />
                    </button>
                </div>
            </div>
            {isStyleOpened ? (
                <ForegroundLongTextStyleComp
                    style={language.style}
                    onChange={(style: LongTextColumnStyleType | undefined) => {
                        const { style: _style, ...languageWithoutStyle } =
                            language;
                        onLanguageChange(
                            style === undefined
                                ? languageWithoutStyle
                                : { ...languageWithoutStyle, style },
                        );
                    }}
                />
            ) : null}
            {language.source === 'raw' ? (
                <LongTextRawSourceComp
                    language={language}
                    rows={rows}
                    onLanguageChange={onLanguageChange}
                />
            ) : (
                <LongTextLyricSourceComp
                    language={language}
                    outline={outline}
                    rows={rows}
                    onLanguageChange={onLanguageChange}
                    onOutlineChange={onOutlineChange}
                />
            )}
        </div>
    );
}

function LongTextBodyComp({
    suffix,
    sessionShowingList,
}: Readonly<{
    suffix: string;
    sessionShowingList: [number, LongTextItemDataType][];
}>) {
    const settingName = toLongTextSettingName(suffix);
    const sourceId = toLongTextSourceId(suffix);
    // Held here and written a moment after the typing stops: a setting is a
    // file, and a key press must not be a file write. The body is keyed by its
    // session, so this is read once, for the session it is.
    const [session, setSession] = useState<LongTextSessionType>(() => {
        return parseLongTextSession(getSetting(settingName));
    });
    const sessionRef = useAppCurrentRef(session);
    const bodyRef = useRef<HTMLDivElement>(null);
    // The layer's own word that a row was marked: by a button here, or by a
    // click on the text in the mini screen. Read at render from the screens
    // themselves, so nothing is held here to go stale.
    useScreenLongTextManagerEvents(['selected']);
    // What each lyric card's file comes to. Typed cards are worked out as
    // they are drawn; a file has to be read.
    const [outlineMap, setOutlineMap] = useState<OutlineMapType>({});
    const [isShowingBusy, setIsShowingBusy] = useState(false);
    // PER INSTANCE, each of them: several sessions' panels may be mounted, and
    // a module-level timer would let one cancel another's write or restyle.
    const persistAttempt = useMemo(() => {
        return genTimeoutAttempt(500);
    }, []);
    const restyleAttempt = useMemo(() => {
        return genTimeoutAttempt(500);
    }, []);
    // The session still to be written, or null once it is.
    const pendingSessionRef = useRef<LongTextSessionType | null>(null);
    const writePendingSession = useCallback(() => {
        const pendingSession = pendingSessionRef.current;
        if (pendingSession === null) {
            return;
        }
        pendingSessionRef.current = null;
        setSetting(settingName, serializeLongTextSession(pendingSession));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const flushSession = useCallback(() => {
        // Now, which also drops the timer that was waiting.
        persistAttempt(writePendingSession, true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    useAppEffect(() => {
        // Closing the panel, or leaving the session, in the half second after
        // a key press must not lose it.
        return flushSession;
    }, []);
    const applySession = useCallback(
        (newSession: LongTextSessionType, isRestyling = false) => {
            setSession(newSession);
            pendingSessionRef.current = newSession;
            persistAttempt(writePendingSession);
            if (isRestyling) {
                // A language's look reaches the screens it is showing on, the
                // way a message's Properties do: when the hand has stopped.
                restyleAttempt(() => {
                    ScreenLongTextManager.restyleLongText(
                        sourceId,
                        genLongTextStyleByCode(newSession),
                    );
                });
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const handleOutlineChange = useCallback(
        (langCode: string, outline: LongTextOutlineType | null) => {
            setOutlineMap((oldOutlineMap) => {
                const newOutlineMap = { ...oldOutlineMap };
                if (outline === null) {
                    delete newOutlineMap[langCode];
                } else {
                    newOutlineMap[langCode] = outline;
                }
                return newOutlineMap;
            });
        },
        [],
    );
    const handleLanguageChange = (
        index: number,
        language: LongTextLanguageType,
    ) => {
        const oldLanguage = session.languages[index];
        const languages = [...session.languages];
        languages[index] = language;
        applySession(
            { ...session, languages },
            // Only a change of LOOK reaches a text that is up; its words
            // are the ones it was shown with until it is shown again.
            JSON.stringify(oldLanguage.style) !==
                JSON.stringify(language.style),
        );
    };
    const handleAdding = async (event: any) => {
        const langCode = await chooseLongTextLangCode(
            event,
            sessionRef.current.languages.map((language) => {
                return language.langCode;
            }),
        );
        if (langCode === null) {
            return;
        }
        applySession({
            ...sessionRef.current,
            languages: [
                ...sessionRef.current.languages,
                genLongTextLanguage(langCode),
            ],
        });
    };
    /**
     * A session as the text to put up, read again NOW: what goes up is
     * checked against the files as they ARE, never against what a card read
     * a minute ago. Null, with the first thing wrong said, when it cannot go
     * up. The outlines come along for a caller that checks them another way.
     */
    const genShowingData = async ({
        languages,
        isAtomMode,
        isStacked,
        isNumberHidden,
    }: LongTextSessionType) => {
        const resolvedList = await Promise.all(
            languages.map(resolveLongTextLanguage),
        );
        const outlines = resolvedList.map(toLongTextOutline);
        const result = verifyLongText(outlines, isAtomMode === true);
        if (result.problem !== null) {
            showSimpleToast(
                tran('Long Text Show'),
                toProblemText(result.problem),
            );
            return null;
        }
        const columns = await Promise.all(
            languages.map((language, index) => {
                return genLongTextColumnInput(
                    language,
                    resolvedList[index],
                    result.rowIndexes,
                    result.screenRows,
                );
            }),
        );
        return {
            itemData: genLongTextItemData(sourceId, columns, {
                isStacked: isStacked === true && languages.length > 1,
                isNumberHidden: isNumberHidden === true,
            }),
            outlines,
            screenRows: result.screenRows,
        };
    };
    const handleShowing = async (event: any, isForceChoosing: boolean) => {
        if (isShowingBusy) {
            return;
        }
        setIsShowingBusy(true);
        try {
            flushSession();
            const showingData = await genShowingData(sessionRef.current);
            if (showingData === null) {
                return;
            }
            await ScreenLongTextManager.handleLongTextShowing(
                event,
                showingData.itemData,
                isForceChoosing,
            );
        } catch (error) {
            handleError(error);
        } finally {
            setIsShowingBusy(false);
        }
    };
    /**
     * Atom mode, Stack or Hide Number on or off. A text that is up goes up
     * again at once, on the screens it is on: after Atom mode the panel's
     * buttons are numbered for the new rows, and left to the next Show they
     * would bring the wrong row to the middle. Each screen keeps its place:
     * Stack and Hide Number keep the very row marked (the rows are the same,
     * only drawn otherwise), Atom mode moves the mark to the row it was on.
     */
    const handleLayoutToggling = async (
        key: 'isAtomMode' | 'isStacked' | 'isNumberHidden',
    ) => {
        const oldSession = sessionRef.current;
        const newSession: LongTextSessionType = { ...oldSession };
        if (oldSession[key] === true) {
            delete newSession[key];
        } else {
            newSession[key] = true;
        }
        applySession(newSession);
        if (sessionShowingList.length === 0) {
            return;
        }
        try {
            const showingData = await genShowingData(newSession);
            // Toggled again while the files were read: that press has its
            // own text to put up, and this one is not it.
            const current = sessionRef.current;
            if (
                showingData === null ||
                current.isAtomMode !== newSession.isAtomMode ||
                current.isStacked !== newSession.isStacked ||
                current.isNumberHidden !== newSession.isNumberHidden
            ) {
                return;
            }
            const isOldAtomMode = oldSession.isAtomMode === true;
            const isSameRows =
                isOldAtomMode === (newSession.isAtomMode === true);
            const oldResult = isSameRows
                ? null
                : verifyLongText(showingData.outlines, isOldAtomMode);
            const oldScreenRows =
                oldResult?.problem === null ? oldResult.screenRows : [];
            ScreenLongTextManager.replaceLongText(
                sourceId,
                showingData.itemData,
                (oldKey) => {
                    if (isSameRows) {
                        return oldKey;
                    }
                    return mapLongTextSectionKey(
                        oldKey,
                        oldScreenRows,
                        showingData.screenRows,
                    );
                },
            );
        } catch (error) {
            handleError(error);
        }
    };

    const usedLangCodes = session.languages.map((language) => {
        return language.langCode;
    });
    // What the panel says BEFORE Show is pressed. A lyric file not read yet
    // is neither right nor wrong, so the button waits for it.
    let isChecking = false;
    const outlines = session.languages.map((language): LongTextOutlineType => {
        if (language.source === 'raw') {
            return toLongTextOutline(toRawResolvedLanguage(language));
        }
        const outline = outlineMap[language.langCode];
        if (outline !== undefined) {
            return outline;
        }
        if (language.lyricFilePath !== '') {
            isChecking = true;
        }
        return {
            langCode: language.langCode,
            source: 'lyric',
            title: '',
            steps: [],
            readProblem: { kind: 'no-file' },
        };
    });
    const isAtomMode = session.isAtomMode === true;
    // One language has nothing to stack -- the screen draws it as one column
    // either way -- so Stack waits for a second. The choice stays in the
    // session and is back with the second language.
    const isStackable = session.languages.length > 1;
    const isStacked = isStackable && session.isStacked === true;
    const isNumberHidden = session.isNumberHidden === true;
    const verifyResult = isChecking
        ? null
        : verifyLongText(outlines, isAtomMode);
    const problem = verifyResult?.problem ?? null;
    const isShowable = !isChecking && problem === null && !isShowingBusy;
    const isOnScreen = sessionShowingList.length > 0;
    const selectedSectionKeys = isOnScreen
        ? ScreenLongTextManager.getLongTextSelectedSectionKeys(sourceId)
        : [];
    const rowIndexes =
        verifyResult?.problem === null ? verifyResult.rowIndexes : null;
    const screenRows =
        verifyResult?.problem === null ? verifyResult.screenRows : null;
    useLongTextPartKeying(bodyRef, sourceId, screenRows?.length ?? 0);
    const rows: LongTextRowsType = {
        rowIndexes,
        screenRows,
        isOnScreen,
        checkIsRowSelected: (rowIndex) => {
            return selectedSectionKeys.includes(toLongTextSectionKey(rowIndex));
        },
        onBringingToMiddle: (rowIndex) => {
            ScreenLongTextManager.bringLongTextRowToMiddle(sourceId, rowIndex);
        },
    };
    const showLabel = tran('Show Long Text');
    const atomModeLabel = tran('Atom Mode');
    const stackLabel = tran('Stack');
    const hideNumberLabel = tran('Hide Number');
    return (
        <div className="fg-body" ref={bodyRef}>
            <div className="d-flex flex-wrap align-items-center gap-2">
                <button
                    type="button"
                    className="btn btn-sm btn-outline-primary"
                    title={tran('Add Language')}
                    onClick={handleAdding}
                >
                    <i className="bi bi-plus-lg" /> {tran('Add Language')}
                </button>
                {/* The look every language is drawn in -- the same panel the
                    Bible's passage opens, because the text goes up in the
                    Bible's layer and is drawn in its style. A card's own
                    Properties hold only its font and size, unset until
                    chosen there. */}
                <div className="ms-auto d-flex flex-wrap align-items-center gap-2">
                    {/* Every line its own row, on the screen and here: a
                        verse of four lines is four, numbered on. */}
                    <button
                        type="button"
                        className={
                            'btn btn-sm btn-' +
                            (isAtomMode ? 'secondary' : 'outline-secondary')
                        }
                        title={atomModeLabel}
                        aria-pressed={isAtomMode}
                        onClick={() => {
                            handleLayoutToggling('isAtomMode');
                        }}
                    >
                        <i className="bi bi-list-ol" /> {atomModeLabel}
                    </button>
                    {/* Every language in the same row, one under another,
                        the way the Bible Reader merges versions. */}
                    <button
                        type="button"
                        className={
                            'btn btn-sm btn-' +
                            (isStacked ? 'secondary' : 'outline-secondary')
                        }
                        title={stackLabel}
                        aria-pressed={isStacked}
                        disabled={!isStackable}
                        onClick={() => {
                            handleLayoutToggling('isStacked');
                        }}
                    >
                        <i className="bi bi-view-stacked" /> {stackLabel}
                    </button>
                    {/* The screen's numbers only: the panel keeps its own. */}
                    <button
                        type="button"
                        className={
                            'btn btn-sm btn-' +
                            (isNumberHidden ? 'secondary' : 'outline-secondary')
                        }
                        title={hideNumberLabel}
                        aria-pressed={isNumberHidden}
                        onClick={() => {
                            handleLayoutToggling('isNumberHidden');
                        }}
                    >
                        <i className="bi bi-123" /> {hideNumberLabel}
                    </button>
                    <BibleCustomStyleFloatingToggleComp />
                </div>
            </div>
            {session.languages.length === 0 ? (
                <div className="app-border-white-round p-2 my-1">
                    <small className="text-muted">
                        {tran('No language yet')}
                    </small>
                </div>
            ) : null}
            {session.languages.map((language, index) => {
                return (
                    <LongTextLanguageCardComp
                        key={language.langCode}
                        language={language}
                        index={index}
                        languageCount={session.languages.length}
                        usedLangCodes={usedLangCodes}
                        outline={outlineMap[language.langCode]}
                        rows={rows}
                        onLanguageChange={(newLanguage) => {
                            handleLanguageChange(index, newLanguage);
                        }}
                        onMoving={(delta) => {
                            applySession({
                                ...session,
                                languages: moveItem(
                                    session.languages,
                                    index,
                                    delta,
                                ),
                            });
                        }}
                        onRemoving={() => {
                            applySession({
                                ...session,
                                languages: session.languages.filter((_, i) => {
                                    return i !== index;
                                }),
                            });
                        }}
                        onOutlineChange={handleOutlineChange}
                    />
                );
            })}
            {isChecking ? (
                <small className="text-muted">{tran('Loading')}...</small>
            ) : null}
            {problem === null || session.languages.length === 0 ? null : (
                // Said before the button is pressed, in the words of the
                // first thing to fix: a disabled button alone would leave a
                // volunteer guessing which of two songs is the odd one.
                <small className="text-warning" role="status">
                    <i className="bi bi-exclamation-triangle" />{' '}
                    {toProblemText(problem)}
                </small>
            )}
            {/* Docked to the panel's bottom: the cards run as long as the
                song, and Show must not be past its last verse. */}
            <div className={ACTIONS_DOCK_CLASSNAME}>
                <div className="fg-actions">
                    <button
                        type="button"
                        className="btn btn-primary"
                        title={showLabel}
                        disabled={!isShowable}
                        aria-pressed={sessionShowingList.length > 0}
                        onClick={(event) => {
                            handleShowing(event, false);
                        }}
                        onContextMenu={(event) => {
                            event.preventDefault();
                            if (isShowable) {
                                handleShowing(event, true);
                            }
                        }}
                    >
                        <i className="bi bi-body-text" /> {showLabel}
                    </button>
                    {isShowable ? (
                        <ContextMenuDotsButtonComp
                            label={tran('Show on Screens')}
                            onOpening={(event) => {
                                handleShowing(event, true);
                            }}
                        />
                    ) : null}
                    <ScreensRendererComp
                        showingScreenIdDataList={sessionShowingList}
                        genTitle={(data: LongTextItemDataType) => {
                            return (
                                data.longTextData.renderedList[0]?.title ?? ''
                            );
                        }}
                        buttonText={tran('Hide Long Text')}
                        handleForegroundHiding={(screenId: number) => {
                            ScreenLongTextManager.hideLongText(
                                sourceId,
                                screenId,
                            );
                        }}
                    />
                </div>
            </div>
        </div>
    );
}

export default function ForegroundLongTextComp() {
    // The long-text layer's own event: nothing this panel puts up is in the
    // foreground manager.
    useScreenLongTextManagerEvents(['update']);
    const showingList = ScreenLongTextManager.getLongTextShowingList();
    const checkIsSessionShowing = (sessionSuffix: string) => {
        const sourceId = toLongTextSourceId(sessionSuffix);
        return showingList.some(([, data]) => {
            return data.longTextData.sourceId === sourceId;
        });
    };
    const {
        activeId,
        suffix,
        element: sessionsElement,
    } = useForegroundSessions({
        widgetKey: LONG_TEXT_WIDGET_KEY,
        toOwnSettingNames: (sessionSuffix) => {
            return [toLongTextSettingName(sessionSuffix)];
        },
        checkIsOnScreen: (_sessionId, sessionSuffix) => {
            return checkIsSessionShowing(sessionSuffix);
        },
        hideSession: (_sessionId, sessionSuffix) => {
            ScreenLongTextManager.hideLongText(
                toLongTextSourceId(sessionSuffix),
            );
        },
    });
    const sourceId = toLongTextSourceId(suffix);
    return (
        <ForegroundLayoutComp target={LONG_TEXT_WIDGET_KEY}>
            {sessionsElement}
            {/* Keyed by the session: the body reads its session once, when
                it mounts. */}
            <LongTextBodyComp
                key={activeId}
                suffix={suffix}
                sessionShowingList={showingList.filter(([, data]) => {
                    return data.longTextData.sourceId === sourceId;
                })}
            />
        </ForegroundLayoutComp>
    );
}
