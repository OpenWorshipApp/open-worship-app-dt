// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const { cleanTypedDirPathMock } = vi.hoisted(() => ({
    // Stands in for the real cleaner (its own tests are in fileHelpers'):
    // what reaches the folder setter is what it returned.
    cleanTypedDirPathMock: vi.fn((typedPath: string) => {
        return typedPath.trim().replace(/^"(.*)"$/, '$1');
    }),
}));

vi.mock('../lang/langHelpers', () => ({ tran: (key: string) => key }));
vi.mock('../server/appProvider', () => ({
    default: { systemUtils: { isDev: false } },
}));
vi.mock('../server/fileHelpers', () => ({
    cleanTypedDirPath: cleanTypedDirPathMock,
    selectDirs: vi.fn(),
}));

import PathEditorComp from './PathEditorComp';
import { selectDirs } from '../server/fileHelpers';

function genDirSource(initialDirPath: string) {
    const committedDirPaths: string[] = [];
    let dirPath = initialDirPath;
    const dirSource = {
        isDirPathValid: true,
        setDirPath: (_dirPath: string) => {},
        fireReloadEvent: vi.fn(),
        get dirPath() {
            return dirPath;
        },
        set dirPath(newDirPath: string) {
            committedDirPaths.push(newDirPath);
            dirPath = newDirPath;
        },
    };
    return { dirSource, committedDirPaths };
}

describe('PathEditorComp committing a typed path', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
        cleanTypedDirPathMock.mockClear();
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();
        vi.unstubAllGlobals();
    });

    async function typeAndPressEnter(text: string) {
        const input = container.querySelector('input');
        if (input === null) {
            throw new Error('Missing path input');
        }
        await act(async () => {
            // React tracks the value it last set; a plain assignment would
            // not reach `onChange`.
            const setValue = Object.getOwnPropertyDescriptor(
                HTMLInputElement.prototype,
                'value',
            )?.set;
            setValue?.call(input, text);
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });
        await act(async () => {
            input.dispatchEvent(
                new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }),
            );
        });
        return input;
    }

    test('a pasted "Copy as path" is committed and shown without its quotes', async () => {
        const { dirSource, committedDirPaths } = genDirSource('/data/old');
        await act(async () => {
            root.render(<PathEditorComp dirSource={dirSource as any} />);
        });
        const input = await typeAndPressEnter(' "/data/Church Data" ');
        expect(cleanTypedDirPathMock).toHaveBeenCalledWith(
            ' "/data/Church Data" ',
        );
        // It was taken as typed, and refused as "not a full path".
        expect(committedDirPaths).toEqual(['/data/Church Data']);
        expect(input.value).toBe('/data/Church Data');
    });

    test('a path that cleans to the folder in force commits nothing', async () => {
        const { dirSource, committedDirPaths } = genDirSource('/data/old');
        await act(async () => {
            root.render(<PathEditorComp dirSource={dirSource as any} />);
        });
        const input = await typeAndPressEnter('"/data/old"');
        expect(committedDirPaths).toEqual([]);
        expect(input.value).toBe('/data/old');
    });
});

describe('PathEditorComp controls', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    afterEach(async () => {
        await act(async () => root.unmount());
        container.remove();
        vi.unstubAllGlobals();
    });

    async function renderEditor(dirSource: any, placeholder?: string) {
        await act(async () => {
            root.render(
                <PathEditorComp
                    dirSource={dirSource}
                    placeholder={placeholder}
                />,
            );
        });
        return container.querySelector('input') as HTMLInputElement;
    }

    async function typeInto(input: HTMLInputElement, text: string) {
        await act(async () => {
            Object.getOwnPropertyDescriptor(
                HTMLInputElement.prototype,
                'value',
            )!.set!.call(input, text);
            input.dispatchEvent(new Event('input', { bubbles: true }));
        });
    }

    test('marks the box by the folder state, a blank box being neither', async () => {
        const { dirSource } = genDirSource('/data/old');
        let input = await renderEditor(dirSource, '/home/me/worship');
        expect(input.className).toBe('form-control form-control-sm is-valid');
        expect(input.placeholder).toBe('e.g. /home/me/worship');
        dirSource.isDirPathValid = false;
        input = await renderEditor({ ...dirSource, dirPath: '/data/old' });
        expect(input.className).toBe('form-control form-control-sm is-invalid');
        input = await renderEditor({
            ...genDirSource('/data/old').dirSource,
            isDirPathValid: null,
            dirPath: '/data/old',
        });
        expect(input.className).toBe('form-control form-control-sm ');
        input = await renderEditor(genDirSource('').dirSource);
        expect(input.className).toBe('form-control form-control-sm ');
        expect(input.placeholder).toBe('');
        // Nothing to reload while no folder is set.
        expect(container.querySelector('[aria-label="Reload"]')).toBeNull();
    });

    test('reloads the folder and takes the first folder picked', async () => {
        const { dirSource, committedDirPaths } = genDirSource('/data/old');
        await renderEditor(dirSource);
        await act(async () => {
            (
                container.querySelector('[aria-label="Reload"]') as HTMLElement
            ).click();
        });
        expect(dirSource.fireReloadEvent).toHaveBeenCalledTimes(1);
        const chooseButton = container.querySelector(
            '[aria-label="Choose a folder"]',
        ) as HTMLElement;
        vi.mocked(selectDirs).mockResolvedValue([]);
        await act(async () => {
            chooseButton.click();
        });
        expect(committedDirPaths).toEqual([]);
        vi.mocked(selectDirs).mockResolvedValue(['/picked', '/other']);
        await act(async () => {
            chooseButton.click();
        });
        expect(selectDirs).toHaveBeenCalledTimes(2);
        expect(committedDirPaths).toEqual(['/picked']);
    });

    test('a blur commits, Escape abandons, a change from outside shows', async () => {
        const { dirSource, committedDirPaths } = genDirSource('/data/old');
        const input = await renderEditor(dirSource);
        await typeInto(input, '/data/typed');
        // Typing alone commits nothing.
        expect(committedDirPaths).toEqual([]);
        await act(async () => {
            input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
        });
        expect(committedDirPaths).toEqual(['/data/typed']);

        await typeInto(input, '/data/half');
        await act(async () => {
            input.dispatchEvent(
                new KeyboardEvent('keyup', { key: 'Escape', bubbles: true }),
            );
        });
        expect(input.value).toBe('/data/typed');
        await act(async () => {
            input.dispatchEvent(
                new KeyboardEvent('keyup', { key: 'a', bubbles: true }),
            );
        });
        expect(committedDirPaths).toEqual(['/data/typed']);

        await act(async () => {
            dirSource.setDirPath('/data/from-settings');
        });
        expect(input.value).toBe('/data/from-settings');
    });
});
