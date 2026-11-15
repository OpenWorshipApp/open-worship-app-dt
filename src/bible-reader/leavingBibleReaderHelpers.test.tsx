import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const h = vi.hoisted(() => ({
    showAppConfirm: vi.fn(
        async (_title: string, _body: ReactElement, _options?: any) => true,
    ),
}));

vi.mock('../popup-widget/popupWidgetHelpers', () => ({
    showAppConfirm: h.showAppConfirm,
}));
vi.mock('../lang/langHelpers', () => ({
    tran: (text: string) => text,
}));

import { askLeavingBibleReader } from './leavingBibleReaderHelpers';

describe('askLeavingBibleReader', () => {
    beforeEach(() => {
        h.showAppConfirm.mockClear();
    });

    test('asks before leaving, and Enter alone never leaves', async () => {
        h.showAppConfirm.mockResolvedValueOnce(false);
        expect(await askLeavingBibleReader()).toBe(false);
        const [title, , options] = h.showAppConfirm.mock.calls[0];
        expect(title).toBe('Leave the Bible Reader?');
        expect(options).toEqual({
            enterToOk: false,
            cancelButtonLabel: 'Stay in Bible Reader',
            confirmButtonLabel: 'Go Back to Presenter',
        });
    });

    test('answers what the person pressed', async () => {
        h.showAppConfirm.mockResolvedValueOnce(true);
        expect(await askLeavingBibleReader()).toBe(true);
    });

    test('says nothing is lost and shows the tab that comes back', async () => {
        await askLeavingBibleReader();
        const body = h.showAppConfirm.mock.calls[0][1];
        const html = renderToStaticMarkup(body);
        expect(html).toContain(
            'Your passages will still be here when you come back.',
        );
        expect(html).toContain(
            'To come back, click this tab at the top left of the Presenter:',
        );
        expect(html).toContain('📖 Bible Reader');
        expect(html).toContain('var(--app-color-reader)');
    });
});
