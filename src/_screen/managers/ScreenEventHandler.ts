import { MouseEvent } from 'react';

import EventHandler from '../../event/EventHandler';
import {
    ContextMenuItemType,
    showAppContextMenu,
} from '../../context-menu/appContextMenuHelpers';
import appProvider from '../../server/appProvider';
import ScreenManagerBase from './ScreenManagerBase';
import {
    getSelectedScreenManagerBases,
    getAllScreenManagerBases,
    getScreenManagerBase,
} from './screenManagerBaseHelpers';
import {
    BasicScreenMessageType,
    ScreenMessageType,
} from '../screenTypeHelpers';

const cache = new Map<string, ScreenEventHandler<any>>();
export default abstract class ScreenEventHandler<
    T extends string,
> extends EventHandler<T> {
    static readonly eventNamePrefix: string = 'screen-em';
    screenManagerBase: ScreenManagerBase;
    constructor(screenManagerBase?: ScreenManagerBase) {
        super();
        this.screenManagerBase = screenManagerBase || (new Object() as any);
        cache.set(this.toCacheKey(), this);
    }

    protected toCacheKey() {
        return `${this.screenId}-${this.constructor.name}`;
    }

    abstract get isShowing(): boolean;

    get screenId() {
        return this.screenManagerBase.screenId;
    }

    get key() {
        return `${this.screenId}`;
    }

    abstract toSyncMessage(): BasicScreenMessageType;

    sendSyncScreen() {
        this.screenManagerBase.sendScreenMessage({
            screenId: this.screenId,
            ...this.toSyncMessage(),
        });
    }

    abstract receiveSyncScreen(message: ScreenMessageType): void;

    static receiveSyncScreen(_message: ScreenMessageType) {
        throw new Error('receiveSyncScreen is not implemented.');
    }

    abstract render(): void;

    fireUpdateEvent() {
        this.addPropEvent('update' as T);
    }

    static fireUpdateEvent() {
        this.addPropEvent('update');
    }

    abstract clear(): void;

    static disableSyncGroup(screenId: number) {
        const screenManagerBase = getScreenManagerBase(screenId);
        screenManagerBase?.noSyncGroupMap.set(this.eventNamePrefix, true);
    }

    static enableSyncGroup(screenId: number) {
        const screenManagerBase = getScreenManagerBase(screenId);
        screenManagerBase?.noSyncGroupMap.set(this.eventNamePrefix, false);
    }

    delete() {
        cache.delete(this.toCacheKey());
        this.screenManagerBase =
            this.screenManagerBase.createScreenManagerBaseGhost(this.screenId);
    }

    static getInstanceBase<T extends ScreenEventHandler<any>>(
        screenId: number,
    ) {
        const instance = cache.get(`${screenId}-${this.name}`) as T;
        if (instance === undefined) {
            throw new Error('instance is not found.');
        }
        return instance;
    }

    static getInstance(_screenId: number) {
        throw new Error('getInstance is not implemented.');
    }

    static async chooseScreenIds(event: MouseEvent, isForceChoosing: boolean) {
        if (!appProvider.isPagePresenter) {
            return [];
        }
        const selectedScreenManagerBases = isForceChoosing
            ? []
            : getSelectedScreenManagerBases();
        if (selectedScreenManagerBases.length > 0) {
            return selectedScreenManagerBases.map((screenManagerBase) => {
                return screenManagerBase.screenId;
            });
        }
        return new Promise<number[]>((resolve) => {
            const screenManagerBases = getAllScreenManagerBases();
            const menuItems: ContextMenuItemType[] = screenManagerBases.map(
                (screenManagerBase) => {
                    return {
                        menuElement: `Screen id: ${screenManagerBase.screenId}`,
                        onSelect: () => {
                            resolve([screenManagerBase.screenId]);
                        },
                    };
                },
            );
            showAppContextMenu(event as any, menuItems).promiseDone.then(() => {
                resolve([]);
            });
        });
    }
}
