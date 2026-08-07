import type { MouseEvent } from 'react';

import EventHandler from '../../event/EventHandler';
import { showAppContextMenu } from '../../context-menu/appContextMenuHelpers';
import appProvider from '../../server/appProvider';
import {
    genScreenIdMenuItems,
    notifyChosenScreenIds,
} from './screenChoosingHelpers';
import type ScreenManagerBase from './ScreenManagerBase';
import {
    getSelectedScreenManagerBases,
    getScreenManagerBase,
} from './screenManagerBaseHelpers';
import type {
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
        const constructor = this.constructor as typeof ScreenEventHandler;
        return `${this.screenId}-${constructor.eventNamePrefix}`;
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
        this.screenManagerBase.sendScreenMessage(
            {
                screenId: this.screenId,
                ...this.toSyncMessage(),
            },
            false,
        );
    }

    sendSyncScrollPercentage(
        domSelector: string,
        scroll: { x: number; y: number },
    ) {
        if (
            !appProvider.getIsMouseOverApp() ||
            !appProvider.getIsWindowFocused()
        ) {
            return;
        }
        setTimeout(() => {
            this.screenManagerBase.sendScreenMessage(
                {
                    screenId: this.screenId,
                    type: 'sync-scroll-percentage',
                    data: {
                        domSelector,
                        scroll,
                    },
                },
                true,
            );
        }, 0);
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
        const instance = cache.get(`${screenId}-${this.eventNamePrefix}`) as T;
        if (instance === undefined) {
            return null;
        }
        return instance;
    }

    static getAllInstancesBase<T extends ScreenEventHandler<any>>(): T[] {
        const instances: T[] = [];
        for (const instance of cache.values()) {
            const constructor =
                instance.constructor as typeof ScreenEventHandler;
            if (constructor.eventNamePrefix === this.eventNamePrefix) {
                instances.push(instance as T);
            }
        }
        return instances;
    }

    static getInstance(_screenId: number) {
        throw new Error('getInstance is not implemented.');
    }

    /**
     * Which screens the operator meant, answered here and nowhere else.
     *
     * `isForceChoosing` is "ignore the default, ASK"; `presetScreenIds` is its
     * mirror image — "ignore the default, use THESE" — and is how an item
     * pinned to a screen reaches it whatever happens to be selected. Force
     * wins over a preset on purpose: the menu entry that passes it is the
     * operator explicitly overriding the pin for one present.
     */
    static async chooseScreenIds(
        event: MouseEvent,
        isForceChoosing: boolean,
        presetScreenIds: number[] = [],
    ) {
        const screenIds = await this.resolveScreenIds(
            event,
            isForceChoosing,
            presetScreenIds,
        );
        // Published so a FOLLOWER of this same gesture — a playlist element's CC
        // elements — can land on exactly these screens without asking a second
        // question. Every exit above goes through here, the empty ones included:
        // a follower has to be told "nowhere" as plainly as it is told "screen 2",
        // or it sits armed holding its closure.
        notifyChosenScreenIds(event, screenIds);
        return screenIds;
    }

    private static async resolveScreenIds(
        event: MouseEvent,
        isForceChoosing: boolean,
        presetScreenIds: number[] = [],
    ) {
        if (!appProvider.isPagePresenter) {
            return [];
        }
        if (!isForceChoosing && presetScreenIds.length > 0) {
            return presetScreenIds;
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
            const menuItems = genScreenIdMenuItems((screenId) => {
                resolve([screenId]);
            });
            showAppContextMenu(event as any, menuItems).promiseDone.then(() => {
                resolve([]);
            });
        });
    }
}

export interface GroupMembershipInf {
    getMemberInstances(): Promise<ScreenEventHandler<any>[]>;
    getMemberIds(): Promise<number[]>;
    checkIsMainInstance(): Promise<boolean>;
}
