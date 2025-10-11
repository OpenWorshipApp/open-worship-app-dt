import { ReactNode, Context } from 'react';

export type ContextPairType<T> = {
    context: Context<T>;
    value: T;
};

export function MultiContextRender({
    contexts,
    children,
}: Readonly<{
    contexts: ContextPairType<any>[];
    children: ReactNode;
}>) {
    let result = children;
    for (const { context: Context, value } of contexts) {
        result = <Context value={value}>{result}</Context>;
    }
    return result;
}
