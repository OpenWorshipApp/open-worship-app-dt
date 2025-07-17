import { DependencyList } from 'react';
import { useAppEffect } from '../helper/debuggerHelpers';
import appProvider from '../server/appProvider';
import EventHandler from './EventHandler';
import { AppWidgetType } from './WindowEventListener';

function getLastItem<T>(arr: T[]) {
    return arr[arr.length - 1] ?? null;
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
    static fireEvent(event: KeyboardEvent) {
        const option = {
            key: event.key,
        };
        this.addControlKey(option, event);
        const eventName = KeyboardEventListener.toEventMapperKey(option);
        this.addPropEvent(eventName, event);
    }
    static addControlKey(option: EventMapper, event: KeyboardEvent) {
        if (appProvider.systemUtils.isWindows) {
            option.wControlKey = [];
            if (event.ctrlKey) {
                option.wControlKey.push('Ctrl');
            }
            if (event.altKey) {
                option.wControlKey.push('Alt');
            }
            if (event.shiftKey) {
                option.wControlKey.push('Shift');
            }
        } else if (appProvider.systemUtils.isMac) {
            option.mControlKey = [];
            if (event.ctrlKey) {
                option.mControlKey.push('Ctrl');
            }
            if (event.altKey) {
                option.mControlKey.push('Option');
            }
            if (event.shiftKey) {
                option.mControlKey.push('Shift');
            }
            if (event.metaKey) {
                option.mControlKey.push('Meta');
            }
        } else if (appProvider.systemUtils.isLinux) {
            option.lControlKey = [];
            if (event.ctrlKey) {
                option.lControlKey.push('Ctrl');
            }
            if (event.altKey) {
                option.lControlKey.push('Alt');
            }
            if (event.shiftKey) {
                option.lControlKey.push('Shift');
            }
        }
    }
    static toShortcutKey(eventMapper: EventMapper) {
        let key = eventMapper.key;
        if (!key) {
            return '';
        }
        if (key.length === 1) {
            key = key.toUpperCase();
        }
        const { wControlKey, mControlKey, lControlKey, allControlKey } =
            eventMapper;
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

export function useKeyboardRegistering(
    eventMappers: EventMapper[],
    listener: ListenerType,
    deps: DependencyList,
) {
    useAppEffect(() => {
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
        const registeredEvents = KeyboardEventListener.registerEventListener(
            eventNames,
            listener,
        );
        return () => {
            KeyboardEventListener.unregisterEventListener(registeredEvents);
        };
    }, [listener, ...deps]);
}

document.onkeydown = function (event) {
    if (['Meta', 'Alt', 'Control', 'Shift'].includes(event.key)) {
        return;
    }
    KeyboardEventListener.fireEvent(event);
};
