// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../../helper/appHooks', async () => {
    const { useEffect, useRef } = await import('react');
    return {
        useAppEffect: useEffect,
        useAppCurrentRef: (target: any) => {
            const ref = useRef(target);
            ref.current = target;
            return ref;
        },
    };
});
// The real fields reach the popup host; these report the same way.
vi.mock('../../popup-widget/ArchivePasswordComp', async () => {
    const { useEffect, useState } = await import('react');
    return {
        ArchivePasswordComp: ({
            onChange,
        }: {
            onChange: (password: string, confirmed: string) => void;
        }) => {
            const [password, setPassword] = useState('');
            useEffect(() => {
                onChange(password, password);
            }, [onChange, password]);
            return (
                <input
                    data-testid="password"
                    value={password}
                    onChange={(event) => {
                        setPassword(event.target.value);
                    }}
                />
            );
        },
    };
});

import SettingExportDialogBodyComp, {
    type SettingExportAnswerType,
} from './SettingExportDialogBodyComp';

let container: HTMLDivElement;
let root: Root;
let answer: SettingExportAnswerType | null;

function rowOf(title: string) {
    return Array.from(container.querySelectorAll('li')).find((row) => {
        return row.querySelector('span.flex-grow-1')?.textContent === title;
    })!;
}

function click(element: Element) {
    act(() => {
        element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
}

function typePassword(text: string) {
    const input = container.querySelector(
        '[data-testid="password"]',
    ) as HTMLInputElement;
    act(() => {
        const setValue = Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            'value',
        )!.set!;
        setValue.call(input, text);
        input.dispatchEvent(new Event('input', { bubbles: true }));
    });
}

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    answer = null;
    act(() => {
        root.render(
            <SettingExportDialogBodyComp
                countByLeafId={new Map([['general.language', 1]])}
                onChange={(newAnswer) => {
                    answer = newAnswer;
                }}
            />,
        );
    });
    click(rowOf('API Keys & Sign-ins').querySelector('button')!);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = false;
});

describe('SettingExportDialogBodyComp', () => {
    test('credentials cannot be ticked until a password is typed', () => {
        const aiKeysBox = rowOf('AI Keys').querySelector('input')!;
        expect(aiKeysBox.disabled).toBe(true);
        expect(rowOf('AI Keys').textContent).toContain(
            'Type a password below to include these',
        );
        expect(answer?.leafIds).toContain('general.language');
        expect(answer?.leafIds).not.toContain('secrets.aiKeys');

        typePassword('pw');
        expect(rowOf('AI Keys').querySelector('input')!.disabled).toBe(false);
        // Usable now, but never ticked behind the operator's back.
        expect(answer?.leafIds).not.toContain('secrets.aiKeys');
        click(rowOf('AI Keys').querySelector('input')!);
        expect(answer).toMatchObject({
            password: 'pw',
            confirmedPassword: 'pw',
        });
        expect(answer?.leafIds).toContain('secrets.aiKeys');
    });

    test('clearing the password drops the credentials again', () => {
        typePassword('pw');
        click(rowOf('AI Keys').querySelector('input')!);
        typePassword('');

        expect(answer?.leafIds).not.toContain('secrets.aiKeys');
        expect(answer?.password).toBe('');
        typePassword('pw');
        expect(rowOf('AI Keys').querySelector('input')!.checked).toBe(false);
    });

    test('shows counts, and none for what it does not read', () => {
        expect(rowOf('General').textContent).toContain('Settings: 1');
        expect(rowOf('Screens').textContent).toContain('All default');
        expect(rowOf('API Keys & Sign-ins').textContent).not.toContain(
            'All default',
        );
        click(rowOf('General').querySelector('button')!);
        expect(rowOf('Language').textContent).toContain('Settings: 1');
        expect(rowOf('Font').textContent).toContain('All default');
        expect(rowOf('AI Keys').textContent).not.toContain('Settings');
        expect(rowOf('AI Keys').textContent).not.toContain('All default');
    });
});
