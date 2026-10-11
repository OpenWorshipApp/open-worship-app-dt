// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, expect, test, vi } from 'vitest';

const { searchMissingFontFamilyMock } = vi.hoisted(() => ({
    searchMissingFontFamilyMock: vi.fn(),
}));

vi.mock('../../lang/langHelpers', () => ({ tran: (text: string) => text }));
vi.mock('../../server/fontHelpers', () => ({
    searchMissingFontFamily: searchMissingFontFamilyMock,
}));

import MissingFontFamilyBannerComp from './MissingFontFamilyBannerComp';

const container = document.createElement('div');
document.body.appendChild(container);
const root = createRoot(container);
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(async () => {
    await act(async () => {
        root.render(null);
    });
});

function getBanner() {
    return container.querySelector<HTMLElement>('[role="alert"]');
}

async function pressHeader() {
    await act(async () => {
        container.querySelector<HTMLButtonElement>('[aria-expanded]')?.click();
    });
}

test('nothing is drawn while no font is missing', async () => {
    await act(async () => {
        root.render(<MissingFontFamilyBannerComp missingFontFamilyList={[]} />);
    });
    expect(getBanner()).toBeNull();
});

test('on its own it is a full-width row that opens to the fonts', async () => {
    const onRefresh = vi.fn();
    await act(async () => {
        root.render(
            <MissingFontFamilyBannerComp
                missingFontFamilyList={['Calibri', 'Calibri Light']}
                refreshLabel="Refresh PPTX Slides"
                onRefresh={onRefresh}
            />,
        );
    });
    const banner = getBanner()!;
    expect(banner.textContent).toContain('Missing fonts (2)');
    expect(banner.classList.contains('w-100')).toBe(true);
    expect(banner.classList.contains('py-1')).toBe(true);
    expect(banner.style.marginTop).toBe('');

    await pressHeader();
    expect(banner.classList.contains('py-2')).toBe(true);
    const fontButton = Array.from(banner.querySelectorAll('button')).find(
        (button) => button.textContent === 'Calibri Light',
    );
    fontButton?.click();
    expect(searchMissingFontFamilyMock).toHaveBeenCalledWith('Calibri Light');

    Array.from(banner.querySelectorAll('button'))
        .find((button) => button.textContent === 'Refresh PPTX Slides')
        ?.click();
    expect(onRefresh).toHaveBeenCalledTimes(1);
});

// The previewer keeps a strip free at its top for the document's menu
// button; the banner used to start UNDER it, leaving the button alone in an
// empty row (reported with a screenshot: "merge to inline to save space").
test("in the menu button's strip it takes the strip, short of the button", async () => {
    await act(async () => {
        root.render(
            <MissingFontFamilyBannerComp
                missingFontFamilyList={['Calibri']}
                menuRoom={{ height: 26, width: 64 }}
            />,
        );
    });
    const banner = getBanner()!;
    // Up by exactly the strip, and ending where the button begins: full
    // width plus that margin would run under it.
    expect(banner.style.marginTop).toBe('-26px');
    expect(banner.style.marginRight).toBe('64px');
    expect(banner.classList.contains('w-100')).toBe(false);
    expect(banner.classList.contains('py-0')).toBe(true);

    // Open, its first line stays level with the button.
    await pressHeader();
    expect(banner.classList.contains('pt-0')).toBe(true);
    expect(banner.classList.contains('pb-2')).toBe(true);
    expect(banner.style.marginTop).toBe('-26px');
});
