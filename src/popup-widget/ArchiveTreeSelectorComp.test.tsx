// @vitest-environment jsdom

import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../helper/appHooks', async () => {
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

import ArchiveTreeSelectorComp, {
    type ArchiveTreeChoiceType,
} from './ArchiveTreeSelectorComp';

let container: HTMLDivElement;
let root: Root;

function render(element: any) {
    act(() => {
        root.render(element);
    });
}

function leaf(key: string, extra: Partial<ArchiveTreeChoiceType> = {}) {
    return { key, title: key, iconClassName: 'bi-gear', ...extra };
}

const CHOICES: ArchiveTreeChoiceType[] = [
    {
        key: 'general',
        title: 'General',
        iconClassName: 'bi-gear',
        children: [leaf('language'), leaf('theme'), leaf('folders')],
    },
    {
        key: 'secrets',
        title: 'Secrets',
        iconClassName: 'bi-key',
        children: [
            leaf('aiKeys', {
                invalidMessage: 'Type a password',
                isDefaultUnchecked: true,
            }),
        ],
    },
    leaf('other'),
];

function rowOf(title: string) {
    return Array.from(container.querySelectorAll('li')).find((row) => {
        return row.querySelector('span.flex-grow-1')?.textContent === title;
    });
}

function checkboxOf(title: string) {
    return rowOf(title)?.querySelector('input') as HTMLInputElement;
}

function click(element: Element) {
    act(() => {
        element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
}

function expand(title: string) {
    click(rowOf(title)!.querySelector('button')!);
}

function clickAllToggle() {
    click(
        Array.from(container.querySelectorAll('button')).find((button) => {
            return /Select All|Deselect All/.test(button.textContent ?? '');
        })!,
    );
}

beforeEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(() => {
    act(() => {
        root.unmount();
    });
    container.remove();
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = false;
});

describe('ArchiveTreeSelectorComp', () => {
    test('starts with every usable leaf ticked and parents collapsed', () => {
        const onChange = vi.fn();
        render(
            <ArchiveTreeSelectorComp
                choices={CHOICES}
                message="Choose"
                onChange={onChange}
            />,
        );

        expect(onChange).toHaveBeenLastCalledWith([
            'language',
            'theme',
            'folders',
            'other',
        ]);
        expect(rowOf('language')).toBeUndefined();
        expect(checkboxOf('General').checked).toBe(true);
        expect(checkboxOf('General').indeterminate).toBe(false);
        // Nothing usable under it: unticked and disabled.
        expect(checkboxOf('Secrets').checked).toBe(false);
        expect(checkboxOf('Secrets').disabled).toBe(true);
    });

    test('a parent is half-ticked, and ticks all its leaves', () => {
        const onChange = vi.fn();
        render(
            <ArchiveTreeSelectorComp
                choices={CHOICES}
                message="Choose"
                onChange={onChange}
            />,
        );
        expand('General');
        expect(
            rowOf('General')!
                .querySelector('button')!
                .getAttribute('aria-expanded'),
        ).toBe('true');
        click(checkboxOf('theme'));

        expect(onChange).toHaveBeenLastCalledWith([
            'language',
            'folders',
            'other',
        ]);
        expect(checkboxOf('General').checked).toBe(false);
        expect(checkboxOf('General').indeterminate).toBe(true);

        click(checkboxOf('General'));
        expect(onChange).toHaveBeenLastCalledWith([
            'language',
            'theme',
            'folders',
            'other',
        ]);
        expect(checkboxOf('General').indeterminate).toBe(false);

        click(checkboxOf('General'));
        expect(onChange).toHaveBeenLastCalledWith(['other']);
    });

    test('a disabled leaf says why and is never reported', () => {
        const onChange = vi.fn();
        render(
            <ArchiveTreeSelectorComp
                choices={CHOICES}
                message="Choose"
                onChange={onChange}
            />,
        );
        expand('Secrets');
        expect(checkboxOf('aiKeys').disabled).toBe(true);
        expect(rowOf('aiKeys')!.textContent).toContain('Type a password');

        clickAllToggle(); // everything is ticked: deselect all
        expect(onChange).toHaveBeenLastCalledWith([]);
        expect(container.textContent).toContain('Nothing is selected');
        clickAllToggle();
        expect(onChange).toHaveBeenLastCalledWith([
            'language',
            'theme',
            'folders',
            'other',
        ]);
    });

    test('a leaf that becomes usable comes back unticked', () => {
        const onChange = vi.fn();
        const enabledChoices = CHOICES.map((choice) => {
            return choice.key === 'secrets'
                ? {
                      ...choice,
                      children: [leaf('aiKeys', { isDefaultUnchecked: true })],
                  }
                : choice;
        });
        render(
            <ArchiveTreeSelectorComp
                choices={CHOICES}
                message="Choose"
                onChange={onChange}
            />,
        );
        render(
            <ArchiveTreeSelectorComp
                choices={enabledChoices}
                message="Choose"
                onChange={onChange}
            />,
        );
        expand('Secrets');
        expect(checkboxOf('aiKeys').checked).toBe(false);
        click(checkboxOf('aiKeys'));
        expect(onChange.mock.lastCall?.[0]).toContain('aiKeys');

        // Disabled again (the password was cleared): dropped, and it stays
        // unticked when enabled once more.
        render(
            <ArchiveTreeSelectorComp
                choices={CHOICES}
                message="Choose"
                onChange={onChange}
            />,
        );
        expect(onChange.mock.lastCall?.[0]).not.toContain('aiKeys');
        render(
            <ArchiveTreeSelectorComp
                choices={enabledChoices}
                message="Choose"
                onChange={onChange}
            />,
        );
        expect(checkboxOf('aiKeys').checked).toBe(false);
    });

    // The Export Settings dialog re-opens itself with a fresh closure when
    // the password confirmation does not match; React keeps this component.
    test('tells a new onChange the selection the operator made', () => {
        const first = vi.fn();
        render(
            <ArchiveTreeSelectorComp
                choices={CHOICES}
                message="Choose"
                onChange={first}
            />,
        );
        click(checkboxOf('other'));
        const second = vi.fn();
        render(
            <ArchiveTreeSelectorComp
                choices={CHOICES}
                message="Choose"
                onChange={second}
            />,
        );
        expect(second).toHaveBeenLastCalledWith([
            'language',
            'theme',
            'folders',
        ]);
    });

    test('a caller keeping the answer in state does not loop', () => {
        let renderCount = 0;
        function HolderComp() {
            const [selected, setSelected] = useState<string[]>([]);
            renderCount++;
            return (
                <>
                    <span data-testid="count">{selected.length}</span>
                    <ArchiveTreeSelectorComp
                        choices={CHOICES}
                        message="Choose"
                        onChange={setSelected}
                    />
                </>
            );
        }
        render(<HolderComp />);
        expect(
            container.querySelector('[data-testid="count"]')?.textContent,
        ).toBe('4');
        expect(renderCount).toBeLessThan(5);
    });
});
