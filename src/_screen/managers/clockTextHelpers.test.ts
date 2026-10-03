// @vitest-environment jsdom
import { afterEach, describe, expect, test } from 'vitest';

import { setClockDataset, setClockText } from './clockTextHelpers';
import CountdownController from './CountdownController';

describe('setClockText', () => {
    test('leaves an unchanged digit group untouched and writes a changed one', () => {
        const div = document.createElement('div');
        const textNode = document.createTextNode('05');
        div.appendChild(textNode);

        setClockText(div, '05');
        // The same node: nothing was replaced, so nothing re-laid out.
        expect(div.firstChild).toBe(textNode);

        setClockText(div, '04');
        expect(div.textContent).toBe('04');
        expect(div.firstChild).not.toBe(textNode);
    });

    test('tolerates a group the widget does not have', () => {
        expect(() => {
            setClockText(null, 'PM');
        }).not.toThrow();
    });
});

describe('setClockDataset', () => {
    test('writes the attribute only when its value changes', () => {
        const div = document.createElement('div');
        const records: MutationRecord[] = [];
        const observer = new MutationObserver((list) => {
            records.push(...list);
        });
        observer.observe(div, { attributes: true });

        setClockDataset(div, 'timeDiff', '3');
        setClockDataset(div, 'timeDiff', '3');
        setClockDataset(div, 'timeDiff', '2');
        records.push(...observer.takeRecords());
        observer.disconnect();

        expect(div.dataset.timeDiff).toBe('2');
        expect(records).toHaveLength(2);
    });
});

describe('CountdownController', () => {
    // Attached, and one at a time: jsdom's selector engine hangs on the
    // controller's child-combinator query against a detached node, and two
    // attached containers would share the `#hour`/`#minute`/`#second` ids
    // (see `screenInfrastructure.test.tsx`).
    function genAttachedContainer() {
        document.body.innerHTML = '';
        const container = document.createElement('div');
        container.className = 'foreground-countdown-container';
        container.innerHTML =
            '<div><div id="hour"></div><div id="minute"></div>' +
            '<div id="second"></div></div>';
        document.body.appendChild(container);
        return container;
    }

    afterEach(() => {
        document.body.innerHTML = '';
    });

    test('marks the box in whole seconds and "0" once the time is up', () => {
        const running = CountdownController.init(
            genAttachedContainer(),
            new Date(Date.now() + 90_500),
        );
        expect(running.divBox.dataset.timeDiff).toBe('91');
        expect(running.divMinute.textContent).toBe('01');

        const done = CountdownController.init(
            genAttachedContainer(),
            new Date(Date.now() - 1000),
        );
        expect(done.divBox.dataset.timeDiff).toBe('0');
        expect(done.divSecond.textContent).toBe('00');
    });
});
