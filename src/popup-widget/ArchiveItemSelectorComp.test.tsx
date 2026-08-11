// @vitest-environment jsdom

import { act } from 'react';
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

import ArchiveItemSelectorComp, {
    type ArchiveItemChoiceType,
} from './ArchiveItemSelectorComp';

let container: HTMLDivElement;
let root: Root;

function render(element: any) {
    act(() => {
        root.render(element);
    });
}

function rows() {
    return Array.from(container.querySelectorAll('li'));
}

function checkedTitles() {
    return rows()
        .filter((row) => {
            return (row.querySelector('input') as HTMLInputElement).checked;
        })
        .map((row) => {
            return row.querySelector('span.flex-grow-1')?.textContent;
        });
}

function clickRow(title: string) {
    const row = rows().find((each) => {
        return each.querySelector('span.flex-grow-1')?.textContent === title;
    })!;
    act(() => {
        row.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
}

function clickAllToggle() {
    const button = container.querySelector('button') as HTMLButtonElement;
    act(() => {
        button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
}

function toChoices(...titles: string[]): ArchiveItemChoiceType[] {
    return titles.map((title) => {
        return { key: title, title, iconClassName: 'bi-filetype-xml' };
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

describe('the archive item selector', () => {
    test('starts with everything valid selected, and says so', () => {
        const onChange = vi.fn();
        render(
            <ArchiveItemSelectorComp
                choices={toChoices('KJV', 'ASV')}
                message="Choose the bibles to export"
                onChange={onChange}
            />,
        );

        expect(checkedTitles()).toEqual(['KJV', 'ASV']);
        // The caller is told the starting selection rather than having to
        // assume it.
        expect(onChange).toHaveBeenCalledWith(['KJV', 'ASV']);
    });

    test('never selects or reports an invalid row', () => {
        const onChange = vi.fn();
        render(
            <ArchiveItemSelectorComp
                choices={[
                    ...toChoices('KJV'),
                    {
                        key: 'ASV',
                        title: 'ASV',
                        iconClassName: 'bi-filetype-xml',
                        invalidMessage: 'Bible key already exists',
                    },
                ]}
                message="Choose the bibles to import"
                onChange={onChange}
            />,
        );

        expect(onChange).toHaveBeenLastCalledWith(['KJV']);
        const invalidRow = rows()[1];
        expect(invalidRow.className).toContain('list-group-item-danger');
        const checkbox = invalidRow.querySelector('input') as HTMLInputElement;
        expect(checkbox.checked).toBe(false);
        expect(checkbox.disabled).toBe(true);
        expect(invalidRow.textContent).toContain('Bible key already exists');

        // And it cannot be talked into selecting one.
        clickRow('ASV');
        expect(onChange).toHaveBeenLastCalledWith(['KJV']);
    });

    /**
     * The regression this exists for — the twin of `ArchivePasswordComp`'s.
     *
     * A mismatched password confirmation re-opens the export dialog, handing
     * this component a FRESH closure while React keeps it mounted with its
     * state. An effect watching only `selectedKeys` never fired again, so the
     * new closure fell back to the caller's default of "everything". An
     * operator who picked ONE folder, mistyped the confirmation and pressed Ok
     * again exported their whole data directory instead.
     */
    test('tells a NEW listener the selection it is already holding', () => {
        const choices = toChoices('Documents', 'Background Videos');
        const firstOnChange = vi.fn();
        render(
            <ArchiveItemSelectorComp
                choices={choices}
                message="Choose the folders to export"
                onChange={firstOnChange}
            />,
        );
        clickRow('Background Videos');
        expect(firstOnChange).toHaveBeenLastCalledWith(['Documents']);

        // The re-ask: same mounted component, a different closure.
        const secondOnChange = vi.fn();
        render(
            <ArchiveItemSelectorComp
                choices={choices}
                message="Choose the folders to export"
                onChange={secondOnChange}
            />,
        );

        expect(secondOnChange).toHaveBeenCalledWith(['Documents']);
        expect(checkedTitles()).toEqual(['Documents']);
    });

    test('toggles everything off and on, and the button follows', () => {
        const onChange = vi.fn();
        render(
            <ArchiveItemSelectorComp
                choices={toChoices('KJV', 'ASV')}
                message="Choose the bibles to export"
                onChange={onChange}
            />,
        );
        expect(container.querySelector('button')?.textContent).toBe(
            'Deselect All',
        );

        clickAllToggle();

        expect(onChange).toHaveBeenLastCalledWith([]);
        expect(container.querySelector('button')?.textContent).toBe(
            'Select All',
        );
        expect(container.textContent).toContain('Nothing is selected');

        clickAllToggle();

        expect(onChange).toHaveBeenLastCalledWith(['KJV', 'ASV']);
        expect(container.textContent).not.toContain('Nothing is selected');
    });

    test('disables the toggle when nothing in the bundle can be taken', () => {
        render(
            <ArchiveItemSelectorComp
                choices={[
                    {
                        key: 'KJV',
                        title: 'KJV',
                        iconClassName: 'bi-filetype-xml',
                        invalidMessage: 'Bible key already exists',
                    },
                ]}
                message="Choose the bibles to import"
                onChange={vi.fn()}
            />,
        );

        // "All of them are selected" would be vacuously true here, so the
        // button must not offer to deselect a selection that does not exist.
        const button = container.querySelector('button') as HTMLButtonElement;
        expect(button.textContent).toBe('Select All');
        expect(button.disabled).toBe(true);
        expect(container.textContent).toContain('Nothing is selected');
    });
});
