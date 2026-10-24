// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test, vi } from 'vitest';

vi.mock('./directory-setting/SettingGeneralDirectoryPathComp', () => ({
    default: () => <section>path settings body</section>,
}));

import SettingPathComp from './SettingPathComp';

describe('SettingPathComp', () => {
    test('holds the tab to a centred reading width', () => {
        const host = document.createElement('div');
        host.innerHTML = renderToStaticMarkup(<SettingPathComp />);
        const body = host.querySelector('section')!;
        const column = body.parentElement!;
        expect(column.style.maxWidth).toBe('660px');
        expect(column.classList.contains('mx-auto')).toBe(true);
        // The scroller stays the full tab, so the bar is at the window edge.
        expect(column.parentElement!.style.overflowY).toBe('auto');
        expect(column.parentElement!.classList.contains('w-100')).toBe(true);
    });
});
