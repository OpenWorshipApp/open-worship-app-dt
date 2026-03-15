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
    MacOS = 'MacOS',
    Linux = 'Linux',
}

export type EventMapperType =
    | {
          key: string;
      }
    | {
          allControlKey: AllControlType[];
          key: string;
      }
    | {
          platform: PlatformEnum.Windows;
          wControlKey: WindowsControlType[];
          key: string;
      }
    | {
          platform: PlatformEnum.Linux;
          lControlKey: LinuxControlType[];
          key: string;
      }
    | {
          platform: PlatformEnum.MacOS;
          mControlKey: MacControlType[];
          key: string;
      }
    | {
          wControlKey: WindowsControlType[];
          mControlKey: MacControlType[];
          lControlKey: LinuxControlType[];
          key: string;
      };
export type RegisteredEventMapperType = EventMapperType & {
    listener: ListenerType;
};
export type ListenerType = ((event: KeyboardEvent) => void) | (() => void);

export function toShortcutKey(eventMapper: EventMapperType) {
    return KeyboardEventListener.toShortcutKey(eventMapper);
}

const keyNameMap: { [key: string]: string } = {
    Meta: 'Command',
};

const macKeyMap: { [key: string]: string } = {
    ctrl: '⌃',
    alt: '⌥',
    meta: '⌘',
    command: '⌘',
    shift: '⇧',
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
    static addControlKey(eventMapper: EventMapperType, event: KeyboardEvent) {
        const clonedEventMapper = cloneJson(eventMapper) as any;
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

    static toShortcutKey(eventMapper: EventMapperType) {
        const clonedEventMapper = cloneJson(eventMapper);
        let key = clonedEventMapper.key;
        if (!key) {
            return '';
        }
        if (key.length === 1) {
            key = key.toUpperCase();
        }
        const { wControlKey, mControlKey, lControlKey, allControlKey } =
            clonedEventMapper as any;
        const allControls: string[] = allControlKey ?? [];
        if (appProvider.systemUtils.isWindows) {
            if (wControlKey) {
                allControls.push(...wControlKey);
            } else if (mControlKey || lControlKey) {
                throw new Error(
                    'mControlKey and lControlKey are ignored on Windows platform',
                );
            }
        } else if (appProvider.systemUtils.isMac) {
            if (mControlKey) {
                allControls.push(...mControlKey);
            } else if (wControlKey || lControlKey) {
                throw new Error(
                    'wControlKey and lControlKey are ignored on Mac platform',
                );
            }
        } else if (appProvider.systemUtils.isLinux) {
            if (lControlKey) {
                allControls.push(...lControlKey);
            } else if (wControlKey || mControlKey) {
                throw new Error(
                    'wControlKey and mControlKey are ignored on Linux platform',
                );
            }
        }
        if (allControls.length === 0) {
            return key;
        }
        const allControlKeys = allControls.map((key) => {
            return keyNameMap[key] ?? key;
        });
        let sorted = [...allControlKeys].sort((a, b) => {
            return a.localeCompare(b);
        });
        if (appProvider.systemUtils.isMac) {
            // Meta+C -> ⌘ C
            sorted = sorted.map((key) => {
                return macKeyMap[key.toLocaleLowerCase()] ?? key;
            });
            key = `${sorted.join('')} ${key}`;
        } else {
            key = `${sorted.join('+')}+${key}`;
        }
        return key;
    }

    static filterEventMappersByPlatform(eventMappers: EventMapperType[]) {
        return eventMappers.filter((eventMapper) => {
            const { platform } = eventMapper as any;
            if (!platform) {
                return true;
            }
            if (
                (platform === PlatformEnum.Windows &&
                    appProvider.systemUtils.isWindows) ||
                (platform === PlatformEnum.MacOS &&
                    appProvider.systemUtils.isMac) ||
                (platform === PlatformEnum.Linux &&
                    appProvider.systemUtils.isLinux)
            ) {
                return true;
            }
            return false;
        });
    }

    static toEventMapperKey(eventMapper: EventMapperType) {
        const key = toShortcutKey(eventMapper);
        const lastLayer = this.getLastLayer();
        return `${lastLayer}>${key}`;
    }
}

export function checkIsControlKeys(event: KeyboardEvent) {
    return ['Meta', 'Alt', 'Control', 'Shift'].includes(event.key);
}

export function checkIsKeyboardEventMatch(
    eventMappers: EventMapperType[],
    event: KeyboardEvent,
) {
    for (const eventMapper of KeyboardEventListener.filterEventMappersByPlatform(
        eventMappers,
    )) {
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

function genEventNames(eventMappers: EventMapperType[]) {
    const eventNames = KeyboardEventListener.filterEventMappersByPlatform(
        eventMappers,
    ).map((eventMapper) => {
        return KeyboardEventListener.toEventMapperKey(eventMapper);
    });
    return eventNames;
}
export function useKeyboardRegistering(
    eventMappers: EventMapperType[],
    listener: ListenerType,
    deps: DependencyList,
) {
    const eventNames = useMemo(() => {
        const eventNames = genEventNames(eventMappers);
        return eventNames;
    }, [eventMappers]);
    useAppEffect(() => {
        const registeredEvents = KeyboardEventListener.registerEventListener(
            eventNames,
            listener,
        );
        return () => {
            KeyboardEventListener.unregisterEventListener(registeredEvents);
        };
    }, [listener, ...deps, ...eventNames]);
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
                    platform: PlatformEnum.MacOS,
                    key: 'q',
                    mControlKey: ['Meta'],
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
