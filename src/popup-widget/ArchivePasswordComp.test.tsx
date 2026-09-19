// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('./popupWidgetHelpers', () => ({ showAppInput: vi.fn() }));
vi.mock('../helper/appHooks', async () => {
    const { useEffect } = await import('react');
    return { useAppEffect: useEffect };
});

import { ArchivePasswordComp } from './ArchivePasswordComp';

let container: HTMLDivElement;
let root: Root;

function render(element: any) {
    act(() => {
        root.render(element);
    });
}

function typeInto(index: number, value: string) {
    const input = container.querySelectorAll('input')[
        index
    ] as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        'value',
    )!.set!;
    act(() => {
        setter.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
    });
}

beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    act(() => {
        root = createRoot(container);
    });
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
});

describe('the archive password fields', () => {
    test('reports both values as they are typed', () => {
        const onChange = vi.fn();
        render(<ArchivePasswordComp isConfirming onChange={onChange} />);

        // The caller is told the starting value too, so an operator who types
        // nothing still gets a definite "no password" rather than silence.
        expect(onChange).toHaveBeenCalledWith('', '');

        typeInto(0, 'secret');
        typeInto(1, 'secret');

        expect(onChange).toHaveBeenLastCalledWith('secret', 'secret');
    });

    /**
     * The regression this exists for.
     *
     * A mismatched confirmation re-opens the dialog, which hands over a FRESH
     * closure while React keeps this component mounted with its state. An
     * effect that watched only the values never fired again, so the new closure
     * was never told anything and read the password as empty — and empty means
     * "no password". Pressing Ok a second time therefore exported the bundle
     * UNPROTECTED, silently, after the operator had asked for a password.
     */
    test('tells a NEW listener the values it is already holding', () => {
        const firstOnChange = vi.fn();
        render(<ArchivePasswordComp isConfirming onChange={firstOnChange} />);
        typeInto(0, 'secret');
        typeInto(1, 'mistyped');
        expect(firstOnChange).toHaveBeenLastCalledWith('secret', 'mistyped');

        // The re-ask: same mounted component, a different closure.
        const secondOnChange = vi.fn();
        render(<ArchivePasswordComp isConfirming onChange={secondOnChange} />);

        expect(secondOnChange).toHaveBeenCalledWith('secret', 'mistyped');
    });

    test('warns when the confirmation does not match', () => {
        render(<ArchivePasswordComp isConfirming onChange={vi.fn()} />);
        typeInto(0, 'secret');
        typeInto(1, 'mistyped');

        expect(container.textContent).toContain('Passwords do not match');
    });

    /**
     * The re-ask hands this component the previous attempt's complaint as
     * `invalidMessage` while React keeps it mounted with what was already
     * typed. Correcting the confirmation has to settle that complaint, or the
     * operator fixes their typo and the dialog still tells them it is wrong.
     */
    test('drops the re-ask complaint once the confirmation matches', () => {
        render(
            <ArchivePasswordComp
                isConfirming
                invalidMessage="Passwords do not match"
                onChange={vi.fn()}
            />,
        );
        typeInto(0, 'secret');
        typeInto(1, 'mistyped');
        expect(container.textContent).toContain('Passwords do not match');

        typeInto(1, 'secret');

        expect(container.textContent).not.toContain('Passwords do not match');
    });

    /**
     * Found by the 2026-08-10 robot run.
     *
     * Clearing both fields IS an answer — "export without a password", which is
     * exactly what the hint below the fields offers. Settling the re-ask's
     * complaint only on a non-empty match left it showing over input that Ok
     * would have accepted, which reads as a dialog that cannot be got out of.
     */
    test('drops the re-ask complaint once both fields are cleared', () => {
        render(
            <ArchivePasswordComp
                isConfirming
                invalidMessage="Passwords do not match"
                onChange={vi.fn()}
            />,
        );
        typeInto(0, 'secret');
        typeInto(1, 'mistyped');
        expect(container.textContent).toContain('Passwords do not match');

        typeInto(0, '');
        typeInto(1, '');

        expect(container.textContent).not.toContain('Passwords do not match');
    });

    /**
     * A password typed into the CONFIRMATION alone used to be silently read as
     * "no password" — the fields disagreed, nothing said so, and Ok exported
     * unprotected. They now simply have to agree.
     */
    test('flags a confirmation typed against an empty password', () => {
        render(<ArchivePasswordComp isConfirming onChange={vi.fn()} />);
        typeInto(1, 'secret');

        expect(container.textContent).toContain('Passwords do not match');
    });

    test('keeps a read complaint up while the password is retyped', () => {
        // An import has no confirmation to settle the complaint against, so
        // only a fresh attempt may clear it.
        render(
            <ArchivePasswordComp
                isConfirming={false}
                invalidMessage="Wrong password, try again"
                onChange={vi.fn()}
            />,
        );
        typeInto(0, 'another-guess');

        expect(container.textContent).toContain('Wrong password, try again');
    });

    test('says nothing about a mismatch while the password is empty', () => {
        render(<ArchivePasswordComp isConfirming onChange={vi.fn()} />);

        // Empty is a legitimate answer — it means "export unprotected".
        expect(container.textContent).not.toContain('Passwords do not match');
        expect(container.textContent).toContain(
            'Leave empty to export without a password',
        );
    });

    test('asks once, without a confirmation, when reading an archive', () => {
        render(
            <ArchivePasswordComp
                isConfirming={false}
                invalidMessage="Wrong password, try again"
                onChange={vi.fn()}
            />,
        );

        expect(container.querySelectorAll('input')).toHaveLength(1);
        expect(container.textContent).toContain('Wrong password, try again');
        expect(container.textContent).not.toContain(
            'Leave empty to export without a password',
        );
    });

    test('reveals and hides both fields together', () => {
        render(<ArchivePasswordComp isConfirming onChange={vi.fn()} />);
        const types = () => {
            return Array.from(container.querySelectorAll('input')).map(
                (input) => {
                    return (input as HTMLInputElement).type;
                },
            );
        };
        expect(types()).toEqual(['password', 'password']);

        const toggle = container.querySelector('button') as HTMLButtonElement;
        act(() => {
            toggle.click();
        });

        expect(types()).toEqual(['text', 'text']);
    });
});
