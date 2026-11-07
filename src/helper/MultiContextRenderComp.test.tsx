import { createContext, use } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'vitest';

import { MultiContextRenderComp } from './MultiContextRenderComp';

const LanguageContext = createContext('none');
const ThemeContext = createContext('none');

function ProbeComp() {
    return (
        <i>
            {use(LanguageContext)}-{use(ThemeContext)}
        </i>
    );
}

describe('MultiContextRenderComp', () => {
    test('every listed context reaches the children', () => {
        const markup = renderToStaticMarkup(
            <MultiContextRenderComp
                contexts={[
                    { context: LanguageContext, value: 'km' },
                    { context: ThemeContext, value: 'dark' },
                ]}
            >
                <ProbeComp />
            </MultiContextRenderComp>,
        );
        expect(markup).toBe('<i>km-dark</i>');
    });

    test('with one context listed twice the first entry wins: it wraps innermost', () => {
        const markup = renderToStaticMarkup(
            <MultiContextRenderComp
                contexts={[
                    { context: LanguageContext, value: 'first' },
                    { context: LanguageContext, value: 'second' },
                ]}
            >
                <ProbeComp />
            </MultiContextRenderComp>,
        );
        expect(markup).toBe('<i>first-none</i>');
    });

    test('with no contexts the children render as they are', () => {
        const markup = renderToStaticMarkup(
            <MultiContextRenderComp contexts={[]}>
                <ProbeComp />
            </MultiContextRenderComp>,
        );
        expect(markup).toBe('<i>none-none</i>');
    });
});
