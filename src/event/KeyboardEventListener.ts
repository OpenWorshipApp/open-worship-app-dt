import { useMemo, type DependencyList } from 'react';

import { useAppEffect } from '../helper/debuggerHelpers';
import appProvider from '../server/appProvider';
import EventHandler from './EventHandler';
import type { AppWidgetType } from './WindowEventListener';
import { cloneJson } from '../helper/helpers';

function getLastItem<T>(arr: T[]) {
    return arr.at(-1) ?? null;
}

export type KeyboardType =
    | 'ArrowUp'
    | 'ArrowRight'
    | 'PageUp'
    | 'ArrowDown'
    | 'ArrowLeft'
    | 'PageDown'
    | 'Enter'
    | 'Tab'
    | 'Escape'
    | ' ';
export const allArrows: KeyboardType[] = [
    'ArrowLeft',
    'ArrowRight',
    'ArrowUp',
    'ArrowDown',
];
export type WindowsControlType = 'Ctrl' | 'Alt' | 'Shift';
export type LinuxControlType = 'Ctrl' | 'Alt' | 'Shift';
export type MacControlType = 'Ctrl' | 'Option' | 'Shift' | 'Meta';
export type AllControlType = 'Ctrl' | 'Shift';

export enum PlatformEnum {
    Windows = 'Windows',
    Mac = 'Mac',
    Linux = 'Linux',
}

export interface EventMapper {
    wControlKey?: WindowsControlType[];
    mControlKey?: MacControlType[];
    lControlKey?: LinuxControlType[];
    allControlKey?: AllControlType[];
    platforms?: PlatformEnum[];
    key: string;
}
export interface RegisteredEventMapper extends EventMapper {
    listener: ListenerType;
}
export type ListenerType = ((event: KeyboardEvent) => void) | (() => void);

export function toShortcutKey(eventMapper: EventMapper) {
    return KeyboardEventListener.toShortcutKey(eventMapper);
}

const keyNameMap: { [key: string]: string } = {
    Meta: 'Command',
};

export default class KeyboardEventListener extends EventHandler<string> {
    static readonly eventNamePrefix: string = 'keyboard';
    static readonly _layers: AppWidgetType[] = ['root'];
    public static onMacQuitting: (() => void) | null = null;

    static async checkShouldNext(event: KeyboardEvent) {
        if (event.defaultPrevented) {
            return false;
        }
        return true;
    }
    async checkShouldNext(event: KeyboardEvent) {
        return await KeyboardEventListener.checkShouldNext(event);
    }

    static getLastLayer() {
        return getLastItem(this._layers);
    }
    static addLayer(layer: AppWidgetType) {
        this._layers.push(layer);
    }
    static removeLayer(layer: AppWidgetType) {
        this._layers.splice(this._layers.indexOf(layer), 1);
    }
    static genEventKeyFromFiredEvent(event: KeyboardEvent) {
        const eventMapper = this.addControlKey(
            {
                key: event.key,
            },
            event,
        );
        const eventKey = this.toEventMapperKey(eventMapper);
        return eventKey;
    }
    static fireEvent(event: KeyboardEvent) {
        const eventKey = this.genEventKeyFromFiredEvent(event);
        this.addPropEvent(eventKey, event);
    }
    static addControlKey(eventMapper: EventMapper, event: KeyboardEvent) {
        const clonedEventMapper = cloneJson(eventMapper);
        if (appProvider.systemUtils.isWindows) {
            clonedEventMapper.wControlKey = [];
            if (event.ctrlKey) {
                clonedEventMapper.wControlKey.push('Ctrl');
            }
            if (event.altKey) {
                clonedEventMapper.wControlKey.push('Alt');
            }
            if (event.shiftKey) {
                clonedEventMapper.wControlKey.push('Shift');
            }
        } else if (appProvider.systemUtils.isMac) {
            clonedEventMapper.mControlKey = [];
            if (event.ctrlKey) {
                clonedEventMapper.mControlKey.push('Ctrl');
            }
            if (event.altKey) {
                clonedEventMapper.mControlKey.push('Option');
            }
            if (event.shiftKey) {
                clonedEventMapper.mControlKey.push('Shift');
            }
            if (event.metaKey) {
                clonedEventMapper.mControlKey.push('Meta');
            }
        } else if (appProvider.systemUtils.isLinux) {
            clonedEventMapper.lControlKey = [];
            if (event.ctrlKey) {
                clonedEventMapper.lControlKey.push('Ctrl');
            }
            if (event.altKey) {
                clonedEventMapper.lControlKey.push('Alt');
            }
            if (event.shiftKey) {
                clonedEventMapper.lControlKey.push('Shift');
            }
        }
        return clonedEventMapper;
    }
    static toShortcutKey(eventMapper: EventMapper) {
        const clonedEventMapper = cloneJson(eventMapper);
        let key = clonedEventMapper.key;
        if (!key) {
            return '';
        }
        if (key.length === 1) {
            key = key.toUpperCase();
        }
        const { wControlKey, mControlKey, lControlKey, allControlKey } =
            clonedEventMapper;
        const allControls: string[] = allControlKey ?? [];
        if (appProvider.systemUtils.isWindows) {
            allControls.push(...(wControlKey ?? []));
        } else if (appProvider.systemUtils.isMac) {
            allControls.push(...(mControlKey ?? []));
        } else if (appProvider.systemUtils.isLinux) {
            allControls.push(...(lControlKey ?? []));
        }
        if (allControls.length > 0) {
            const allControlKeys = allControls.map((key) => {
                return keyNameMap[key] ?? key;
            });
            const sorted = [...allControlKeys].sort((a, b) => {
                return a.localeCompare(b);
            });
            key = `${sorted.join(' + ')} + ${key}`;
        }
        return key;
    }
    static toEventMapperKey(eventMapper: EventMapper) {
        const key = toShortcutKey(eventMapper);
        return `${this.getLastLayer()}>${key}`;
    }
}

export function checkIsControlKeys(event: KeyboardEvent) {
    return ['Meta', 'Alt', 'Control', 'Shift'].includes(event.key);
}

export function checkIsKeyboardEventMatch(
    eventMappers: EventMapper[],
    event: KeyboardEvent,
) {
    for (const eventMapper of eventMappers) {
        const expectEventKey =
            KeyboardEventListener.toEventMapperKey(eventMapper);
        const actualEventKey =
            KeyboardEventListener.genEventKeyFromFiredEvent(event);
        if (expectEventKey === actualEventKey) {
            return true;
        }
    }
    return false;
}

function genEventNames(eventMappers: EventMapper[]) {
    const eventNames = eventMappers
        .filter((eventMapper) => {
            const { platforms } = eventMapper;
            if (platforms) {
                if (
                    (platforms.includes(PlatformEnum.Windows) &&
                        appProvider.systemUtils.isWindows) ||
                    (platforms.includes(PlatformEnum.Mac) &&
                        appProvider.systemUtils.isMac) ||
                    (platforms.includes(PlatformEnum.Linux) &&
                        appProvider.systemUtils.isLinux)
                ) {
                    return true;
                }
                return false;
            }
            return true;
        })
        .map((eventMapper) => {
            return KeyboardEventListener.toEventMapperKey(eventMapper);
        });
    return eventNames;
}
export function useKeyboardRegistering(
    eventMappers: EventMapper[],
    listener: ListenerType,
    deps: DependencyList,
) {
    const eventNames = useMemo(() => {
        return genEventNames(eventMappers);
    }, [eventMappers]);
    useAppEffect(() => {
        const registeredEvents = KeyboardEventListener.registerEventListener(
            eventNames,
            listener,
        );
        return () => {
            KeyboardEventListener.unregisterEventListener(registeredEvents);
        };
    }, [listener, ...deps, eventNames]);
}

document.onkeydown = function (event) {
    if (checkIsControlKeys(event)) {
        return;
    }
    if (
        KeyboardEventListener.onMacQuitting !== null &&
        checkIsKeyboardEventMatch(
            [
                {
                    key: 'q',
                    mControlKey: ['Meta'],
                    platforms: [PlatformEnum.Mac],
                },
            ],
            event,
        )
    ) {
        event.preventDefault();
        KeyboardEventListener.onMacQuitting();
        return;
    }
    KeyboardEventListener.fireEvent(event);
};
