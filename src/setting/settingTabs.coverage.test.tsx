// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

// The tab bodies of the Settings window: which rows each one stacks, and the
// cards General leaves out when there is no data folder to keep them in.
const { state } = vi.hoisted(() => ({
    state: { isOnOwnFolder: false },
}));

vi.mock('./directory-setting/appLocalStorage', () => ({
    appLocalStorage: {
        get isOnOwnFolder() {
            return state.isOnOwnFolder;
        },
    },
}));
vi.mock('./SettingOthersAIComp', () => ({
    default: () => <div className="row-ai" />,
}));
vi.mock('./SettingGeneralThemeComp', () => ({
    default: () => <div className="card-theme" />,
}));
vi.mock('./SettingGeneralFontFamilyComp', () => ({
    default: () => <div className="card-font" />,
}));
vi.mock('./SettingGeneralOtherOptionsComp', () => ({
    default: () => <div className="card-other" />,
}));
vi.mock('./SettingOthersExtraBinComp', () => ({
    default: () => <div className="row-extra-bin" />,
}));
vi.mock('../plugins/song-select/SettingOthersSongSelectComp', () => ({
    default: () => <div className="row-song-select" />,
}));

import SettingAIComp from './SettingAIComp';
import SettingGeneralComp from './SettingGeneralComp';
import SettingOthersComp from './SettingOthersComp';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

function getRackClasses() {
    const rack = container.querySelector('.app-setting-others-rack');
    return Array.from(rack?.children ?? []).map((child) => child.className);
}

function getCardClasses() {
    const box = container.querySelector('.app-border-white-round');
    return Array.from(box?.children ?? []).map((child) => child.className);
}

beforeEach(() => {
    state.isOnOwnFolder = false;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});

afterEach(async () => {
    await act(async () => {
        root.unmount();
    });
    container.remove();
});

describe('the Settings tab bodies', () => {
    test('AI Providers holds its one row in the same rack as Others', async () => {
        await act(async () => {
            root.render(<SettingAIComp />);
        });
        expect(container.firstElementChild!.className).toContain(
            'app-setting-others',
        );
        expect(getRackClasses()).toEqual(['row-ai']);
    });

    test('Others stacks SongSelect above Extra Binaries', async () => {
        await act(async () => {
            root.render(<SettingOthersComp />);
        });
        expect(getRackClasses()).toEqual(['row-song-select', 'row-extra-bin']);
    });

    test('General shows every card with a data folder', async () => {
        await act(async () => {
            root.render(<SettingGeneralComp />);
        });
        expect(getCardClasses()).toEqual([
            'card-theme',
            'card-font',
            'card-other',
        ]);
    });

    test('General keeps only what belongs to the computer without one', async () => {
        state.isOnOwnFolder = true;
        await act(async () => {
            root.render(<SettingGeneralComp />);
        });
        // The language picker is the Languages tab's.
        expect(getCardClasses()).toEqual(['card-theme']);
    });
});
