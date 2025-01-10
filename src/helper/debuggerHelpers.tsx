import {
    DependencyList,
    EffectCallback,
    useEffect,
    useMemo,
    useState,
} from 'react';

import { warn } from './loggerHelpers';

const THRESHOLD = 10;
const MILLIE_SECOND = 1000;

type StoreType = {
    count: number;
    timeoutId: any;
};
function restore(toKey: string) {
    const store = storeMapper.get(toKey) || {
        count: 0,
        timeoutId: 0,
    };
    store.count++;
    if (store.timeoutId) {
        clearTimeout(store.timeoutId);
    }
    store.timeoutId = setTimeout(() => {
        storeMapper.set(toKey, {
            count: 0,
            timeoutId: 0,
        });
    }, MILLIE_SECOND);
    return store;
}

function warningMethod(key: string) {
    warn(`[useAppEffect] ${key} is called after unmounting`);
}

const storeMapper = new Map<string, StoreType>();
function checkStore(toKey: string) {
    const store = restore(toKey);
    storeMapper.set(toKey, store);
    if (store.count > THRESHOLD) {
        warn(
            `[useAppEffect] ${toKey} is called more than ` +
                `${THRESHOLD} times in ${MILLIE_SECOND}ms`,
        );
    }
}

type MethodContextType = { [key: string]: any };
export function useAppEffectAsync<T extends MethodContextType>(
    effectMethod: (methodContext: T) => Promise<(() => void) | void>,
    deps?: DependencyList,
    methods?: T,
    key?: string,
) {
    const toKey = useMemo(() => {
        return key ?? effectMethod.toString();
    }, []);
    const isAllUndefined = deps === undefined && methods === undefined;
    const totalDeps = isAllUndefined
        ? undefined
        : [...(deps || []), ...Object.values(methods ?? {})];
    useEffect(() => {
        const methodContext = { ...(methods ?? {}) } as T;
        checkStore(toKey);
        const unmount = effectMethod(methodContext);
        return () => {
            for (const key in methodContext) {
                methodContext[key] = warningMethod.bind(null, key) as any;
            }
            unmount.then((cleanupResolved) => {
                if (typeof cleanupResolved === 'function') {
                    cleanupResolved();
                }
            });
        };
    }, totalDeps);
}

export function useAppEffect(
    effect: EffectCallback,
    deps?: DependencyList,
    key?: string,
) {
    const toKey = useMemo(() => {
        return key ?? effect.toString();
    }, []);
    useEffect(() => {
        checkStore(toKey);
        return effect();
    }, deps);
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function TestInfinite() {
    const [count, setCount] = useState(0);
    const [isStopped, setIsStopped] = useState(false);
    useAppEffect(
        () => {
            if (isStopped) {
                return;
            }
            setTimeout(() => {
                setCount(count + 1);
            }, 20);
        },
        [count],
        'test',
    );
    return (
        <h2>
            <button
                onClick={() => {
                    setIsStopped(true);
                }}
                disabled={isStopped}
            >
                {isStopped ? 'Stopped' : 'Stop'}
            </button>
            Count: {count}
        </h2>
    );
}
