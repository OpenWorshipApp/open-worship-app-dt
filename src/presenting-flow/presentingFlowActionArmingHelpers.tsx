import {
    useCallback,
    useMemo,
    useState,
    type ChangeEvent,
    type KeyboardEvent as ReactKeyboardEvent,
} from 'react';

import { getAllScreenManagerBases } from '../_screen/managers/screenManagerBaseHelpers';
import { genColorFromScreenId } from '../_screen/preview/screenIdColorHelpers';
import { useAppCurrentRef } from '../helper/appHooks';
import { tran } from '../lang/langHelpers';
import { showAppInput } from '../popup-widget/popupWidgetHelpers';
import { showSimpleToast } from '../toast/toastHelpers';
import type {
    PresentingFlowActionArmingType,
    PresentingFlowRunActionType,
    PresentingFlowScreenActionType,
} from './presentingFlowActionHelpers';
import {
    checkIsValidPresentingFlowActionKey,
    readPresentingFlowActionKeyFromEvent,
} from './presentingFlowActionKeyHelpers';
import {
    checkIsValidPresentingFlowActionTime,
    toPresentingFlowActionTime,
} from './presentingFlowActionTimeHelpers';

/**
 * Asking how a run action is ARMED: a count of seconds, or — for the timeout,
 * the one that may be (`canBeTimeArmed`) — a time of day, or — for the keyboard
 * event, the one that may be (`canBeKeyArmed`) — a SHORTCUT.
 *
 * `showAppInput` resolves Ok/Cancel and nothing else, so the live value is
 * written back through a callback the caller closes over — the same shape
 * `askForURL` uses for the download dialog.
 */

/**
 * Where the time field opens when there is no time to open on. Deliberately a
 * few minutes AHEAD of now rather than on the current time, which is the one
 * value that is already due the moment it is fired.
 */
const DEFAULT_TIME_AHEAD_MILLISECOND = 5 * 60 * 1000;

function ActionArmingInputComp({
    numberLabel,
    canBeTimeArmed,
    defaultNumber,
    defaultTime,
    isTimeDefault,
    onChange,
}: Readonly<{
    numberLabel: string;
    canBeTimeArmed: boolean;
    defaultNumber: number;
    defaultTime: string;
    isTimeDefault: boolean;
    onChange: (arming: PresentingFlowActionArmingType) => void;
}>) {
    const [isTime, setIsTime] = useState(isTimeDefault);
    const [numberValue, setNumberValue] = useState(`${defaultNumber}`);
    const [timeValue, setTimeValue] = useState(defaultTime);
    const onChangeRef = useAppCurrentRef(onChange);
    // Every field writes the WHOLE answer back, so switching between the two
    // halves hands the caller the one that is now showing — an operator who
    // typed 30 seconds, changed their mind and chose 7:05 must not have both
    // written down, with the file deciding which one won.
    const applyChanging = useCallback(
        (newIsTime: boolean, newNumberValue: string, newTimeValue: string) => {
            setIsTime(newIsTime);
            setNumberValue(newNumberValue);
            setTimeValue(newTimeValue);
            onChangeRef.current(
                newIsTime
                    ? { actionTime: newTimeValue }
                    : { actionNumber: parseInt(newNumberValue, 10) },
            );
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    const handleModeChanging = useCallback(
        (event: ChangeEvent<HTMLSelectElement>) => {
            applyChanging(
                event.target.value === 'time',
                numberValue,
                timeValue,
            );
        },
        [applyChanging, numberValue, timeValue],
    );
    const handleNumberChanging = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            applyChanging(false, event.target.value, timeValue);
        },
        [applyChanging, timeValue],
    );
    const handleTimeChanging = useCallback(
        (event: ChangeEvent<HTMLInputElement>) => {
            applyChanging(true, numberValue, event.target.value);
        },
        [applyChanging, numberValue],
    );
    return (
        <div className="w-100 h-100">
            <div className="input-group">
                {canBeTimeArmed ? (
                    // The label IS the choice for the one action that has one:
                    // a separate toggle beside a static label would say the same
                    // word twice and leave the operator hunting for which of the
                    // two the number under it belongs to.
                    <select
                        className="form-select form-select-sm flex-grow-0 w-auto"
                        value={isTime ? 'time' : 'number'}
                        onChange={handleModeChanging}
                    >
                        <option value="number">{tran(numberLabel)}</option>
                        <option value="time">{tran('At Time')}</option>
                    </select>
                ) : (
                    <div className="input-group-text">{tran(numberLabel)}</div>
                )}
                {isTime ? (
                    <input
                        className="form-control form-control-sm"
                        type="time"
                        // The dialog opens on it, so the value can be typed over
                        // straight away — this is asked mid-service.
                        autoFocus
                        value={timeValue}
                        onChange={handleTimeChanging}
                    />
                ) : (
                    <input
                        className="form-control form-control-sm"
                        type="number"
                        min={1}
                        autoFocus
                        value={numberValue}
                        onChange={handleNumberChanging}
                    />
                )}
            </div>
        </div>
    );
}

/**
 * The shortcut field: it is PRESSED, not typed.
 *
 * A text box asking an operator to spell `Ctrl+Shift+A` is a box they can spell
 * it wrong in, and they would find out at the one moment it matters. So the
 * field is read-only, takes the key press itself, and shows back exactly what
 * was stored — what the row will say and what they will press.
 *
 * Every press is swallowed (`preventDefault`), which also keeps the app's own
 * shortcut layer out of it: `KeyboardEventListener` skips an event whose default
 * is already prevented, so setting `Ctrl+S` here cannot save something on the way
 * past.
 */
function ActionKeyInputComp({
    defaultKey,
    onChange,
}: Readonly<{
    defaultKey: string | null;
    onChange: (arming: PresentingFlowActionArmingType) => void;
}>) {
    const [actionKey, setActionKey] = useState(defaultKey);
    // What the LAST press could not be, so the operator is told why nothing
    // changed instead of pressing harder. Cleared by the next press that works.
    const [message, setMessage] = useState('');
    const onChangeRef = useAppCurrentRef(onChange);
    const handleKeyingDown = useCallback(
        (event: ReactKeyboardEvent<HTMLInputElement>) => {
            event.preventDefault();
            event.stopPropagation();
            const answer = readPresentingFlowActionKeyFromEvent(event);
            // A bare modifier on the way to the combination — nothing to say.
            if (answer === null) {
                return;
            }
            if (answer.actionKey === null) {
                setMessage(answer.message);
                return;
            }
            setMessage('');
            setActionKey(answer.actionKey);
            onChangeRef.current({ actionKey: answer.actionKey });
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );
    return (
        <div className="w-100 h-100">
            <div className="input-group">
                <div className="input-group-text">{tran('Shortcut')}</div>
                <input
                    className="form-control form-control-sm"
                    type="text"
                    // The dialog opens on it so the very next press is the
                    // answer — this is asked mid-service.
                    autoFocus
                    readOnly
                    value={actionKey ?? ''}
                    placeholder={tran('Press a shortcut')}
                    onKeyDown={handleKeyingDown}
                />
            </div>
            {message === '' ? null : (
                <div className="pt-1" style={{ color: 'var(--bs-warning)' }}>
                    {tran(message)}
                </div>
            )}
        </div>
    );
}

/**
 * Arm a run action with a keyboard SHORTCUT, or null when the operator cancelled
 * — or pressed nothing at all, which is refused rather than stored as a line
 * with no key.
 */
async function askForPresentingFlowActionKey(
    runAction: PresentingFlowRunActionType,
    currentArming: PresentingFlowActionArmingType,
): Promise<PresentingFlowActionArmingType | null> {
    const currentKey = currentArming.actionKey;
    const defaultKey = checkIsValidPresentingFlowActionKey(currentKey)
        ? currentKey
        : null;
    let arming: PresentingFlowActionArmingType =
        defaultKey === null ? {} : { actionKey: defaultKey };
    const isOk = await showAppInput(
        `${tran(runAction.label)} - ${tran('Shortcut')}`,
        <ActionKeyInputComp
            defaultKey={defaultKey}
            onChange={(newArming) => {
                arming = newArming;
            }}
        />,
    );
    if (!isOk) {
        return null;
    }
    if (!checkIsValidPresentingFlowActionKey(arming.actionKey)) {
        showSimpleToast(tran(runAction.label), tran('Please press a shortcut'));
        return null;
    }
    return { actionKey: arming.actionKey };
}

/**
 * How to arm a run action, or null when the operator cancelled — or answered
 * with something that is not a number greater than 0, not a time of day, or not
 * a shortcut, which is refused with a toast rather than quietly rounded into
 * something they did not ask for.
 *
 * `currentArming` is what an already-listed element is armed with, so re-arming
 * one opens on its own value — and on its own HALF of the question — instead of
 * on the default.
 */
export async function askForPresentingFlowActionArming(
    runAction: PresentingFlowRunActionType,
    currentArming: PresentingFlowActionArmingType = {},
): Promise<PresentingFlowActionArmingType | null> {
    // Asked first, and answered by a question of its own: a shortcut is not a
    // quantity, so it shares nothing with the two halves below but the shape of
    // the answer.
    if (runAction.canBeKeyArmed) {
        return await askForPresentingFlowActionKey(runAction, currentArming);
    }
    const numberSpec = runAction.number;
    if (numberSpec === null) {
        return null;
    }
    const { canBeTimeArmed } = runAction;
    const currentTime = currentArming.actionTime;
    const isTimeDefault =
        canBeTimeArmed && checkIsValidPresentingFlowActionTime(currentTime);
    const defaultNumber = currentArming.actionNumber || numberSpec.defaultValue;
    const defaultTime = isTimeDefault
        ? (currentTime as string)
        : toPresentingFlowActionTime(
              new Date(Date.now() + DEFAULT_TIME_AHEAD_MILLISECOND),
          );
    let arming: PresentingFlowActionArmingType = isTimeDefault
        ? { actionTime: defaultTime }
        : { actionNumber: defaultNumber };
    const isOk = await showAppInput(
        `${tran(runAction.label)} - ${tran(
            canBeTimeArmed ? 'Timing' : numberSpec.label,
        )}`,
        <ActionArmingInputComp
            numberLabel={numberSpec.label}
            canBeTimeArmed={canBeTimeArmed}
            defaultNumber={defaultNumber}
            defaultTime={defaultTime}
            isTimeDefault={isTimeDefault}
            onChange={(newArming) => {
                arming = newArming;
            }}
        />,
    );
    if (!isOk) {
        return null;
    }
    const { actionNumber, actionTime } = arming;
    if (actionTime !== undefined) {
        if (!checkIsValidPresentingFlowActionTime(actionTime)) {
            showSimpleToast(
                tran(runAction.label),
                tran('Please enter a valid time'),
            );
            return null;
        }
        return { actionTime };
    }
    if (
        actionNumber === undefined ||
        !Number.isFinite(actionNumber) ||
        actionNumber <= 0
    ) {
        showSimpleToast(
            tran(runAction.label),
            tran('Please enter a number greater than 0'),
        );
        return null;
    }
    return { actionNumber };
}

/**
 * The screen checklist a `Screen: Show` / `Screen: Hide` is armed with.
 *
 * The same rows as every other screen picker in the app — `Screen id: N` in the
 * screen's own identity colour, sorted by id — but as a form the operator OKs
 * rather than as a menu that acts on the first click: this is one answer to one
 * question, and picking two screens must not mean adding two lines.
 */
function ActionScreenIdsInputComp({
    defaultScreenIds,
    onChange,
}: Readonly<{
    defaultScreenIds: number[];
    onChange: (screenIds: number[]) => void;
}>) {
    const [screenIds, setScreenIds] = useState(defaultScreenIds);
    const screenIdsRef = useAppCurrentRef(screenIds);
    const onChangeRef = useAppCurrentRef(onChange);
    // Read once: the dialog is modal, so no screen can be added or closed while
    // it is open, and re-reading per render would rebuild the list under the
    // operator's pointer.
    const allScreenIds = useMemo(() => {
        return getAllScreenManagerBases().map(({ screenId }) => {
            return screenId;
        });
    }, []);
    const handleToggling = useCallback((screenId: number) => {
        const oldScreenIds = screenIdsRef.current;
        const newScreenIds = oldScreenIds.includes(screenId)
            ? oldScreenIds.filter((id) => {
                  return id !== screenId;
              })
            : [...oldScreenIds, screenId].sort((a, b) => {
                  return a - b;
              });
        setScreenIds(newScreenIds);
        onChangeRef.current(newScreenIds);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    if (allScreenIds.length === 0) {
        return <div className="w-100 h-100">{tran('No screen is open')}</div>;
    }
    return (
        <div className="w-100 h-100">
            {allScreenIds.map((screenId) => {
                return (
                    <div className="form-check" key={screenId}>
                        <label className="form-check-label app-caught-hover-pointer">
                            <input
                                className="form-check-input"
                                type="checkbox"
                                checked={screenIds.includes(screenId)}
                                onChange={() => {
                                    handleToggling(screenId);
                                }}
                            />
                            <span
                                style={{
                                    color: genColorFromScreenId(screenId),
                                }}
                            >
                                {`Screen id: ${screenId}`}
                            </span>
                        </label>
                    </div>
                );
            })}
        </div>
    );
}

/**
 * Which screens a `Screen: Show` / `Screen: Hide` runs on, asked BEFORE the line
 * exists — the same shape as the run family's question, and for the same reason:
 * an action that must name its screens is not a valid line without them, so a
 * cancelled question has to add nothing at all.
 *
 * Null when the operator cancelled, or answered with no screen — refused with a
 * toast rather than written as a line that would do nothing every time it fired.
 * `currentScreenIds` is what an already-listed element names, so RE-arming one
 * opens on its own answer.
 */
export async function askForPresentingFlowActionScreenIds(
    screenAction: PresentingFlowScreenActionType,
    currentScreenIds: number[] = [],
): Promise<number[] | null> {
    let screenIds = currentScreenIds;
    const isOk = await showAppInput(
        `${tran(screenAction.label)} - ${tran('Set Specific Screen')}`,
        <ActionScreenIdsInputComp
            defaultScreenIds={currentScreenIds}
            onChange={(newScreenIds) => {
                screenIds = newScreenIds;
            }}
        />,
    );
    if (!isOk) {
        return null;
    }
    if (screenIds.length === 0) {
        showSimpleToast(
            tran(screenAction.label),
            tran('Please choose at least one screen'),
        );
        return null;
    }
    return screenIds;
}
