// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => ({
    openPathSetting: vi.fn(),
    openChatbotOnPress: vi.fn(),
}));

vi.mock('../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../popup-widget/HandleAlertComp', () => ({
    default: () => <i data-host="alerts" />,
}));
vi.mock('./AppAssistantComp', () => ({
    default: () => <i data-host="assistant" />,
}));
vi.mock('../setting/settingHelpers', () => ({
    openPathSetting: state.openPathSetting,
}));
vi.mock('./commonButtons', () => ({
    openChatbotOnPress: state.openChatbotOnPress,
}));

import NoDataDirGateComp from './NoDataDirGateComp';

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    state.openChatbotOnPress.mockResolvedValue(undefined);
    host = document.createElement('div');
    document.body.append(host);
    root = createRoot(host);
});

afterEach(async () => {
    await act(async () => root.unmount());
    host.remove();
    vi.unstubAllGlobals();
});

function getButton(text: string) {
    return Array.from(host.querySelectorAll('button')).find(
        (button) => button.textContent === text,
    )!;
}

describe('NoDataDirGateComp', () => {
    test('says a data folder is needed and hosts the assistant and alerts', async () => {
        await act(async () => root.render(<NoDataDirGateComp />));
        expect(host.querySelector('strong')!.textContent).toBe(
            'No Parent Directory Selected',
        );
        expect(host.textContent).toContain(
            'You need to select a parent directory to start using the app.',
        );
        expect(
            Array.from(host.querySelectorAll('[data-host]')).map((element) =>
                element.getAttribute('data-host'),
            ),
        ).toEqual(['assistant', 'alerts']);
    });

    test('Go to Settings opens the path setting', async () => {
        await act(async () => root.render(<NoDataDirGateComp />));
        await act(async () => getButton('Go to Settings').click());
        expect(state.openPathSetting).toHaveBeenCalledOnce();
        expect(state.openChatbotOnPress).not.toHaveBeenCalled();
    });

    test('the assistant is one press away, loaded on that press', async () => {
        await act(async () => root.render(<NoDataDirGateComp />));
        await act(async () => getButton('App Assistant').click());
        await act(async () => {
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
        expect(state.openChatbotOnPress).toHaveBeenCalledOnce();
        expect(state.openPathSetting).not.toHaveBeenCalled();
    });
});
