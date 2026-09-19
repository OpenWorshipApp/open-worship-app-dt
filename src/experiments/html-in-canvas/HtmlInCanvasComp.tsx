/**
 * HTML-in-Canvas playground.
 *
 * Every demo here is a live, runnable version of something documented in
 * ./README.md. Open it with `html/experiment.html` (dev URL
 * `https://localhost:3000/experiment.html`).
 *
 * The demos live in the sibling files; this one is just the shell.
 *
 * The API is flag-gated. Nothing renders unless Chromium was started with
 * `--enable-blink-features=CanvasDrawElement` (or `--enable-features=...`);
 * see the unsupported screen below for where to put it.
 */
import { useMemo, useState } from 'react';

import { COLOR, checkIsSupported } from './htmlInCanvasHelpers';
import { DEMO_LIST } from './demoList';
import DemoSourceComp from './DemoSourceComp';
import type { DemoType } from './htmlInCanvasTypes';

function toSearchTermList(searchText: string) {
    return searchText.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

/**
 * Matches the title, group, id and the `<file>#<symbol>` source references, so
 * `filter` finds a demo by what it is called, where it lives or which API it
 * demonstrates. Every term must hit (AND), order free.
 */
function checkIsMatch(item: DemoType, termList: string[]) {
    const haystack = [item.title, item.group, item.id, ...item.sourceList]
        .join(' ')
        .toLowerCase();
    return termList.every((term) => {
        return haystack.includes(term);
    });
}

function UnsupportedComp() {
    return (
        <div
            style={{
                background: COLOR.bg,
                color: COLOR.text,
                height: '100%',
                padding: 24,
                font: '13px sans-serif',
                lineHeight: 1.7,
                boxSizing: 'border-box',
            }}
        >
            <h3 style={{ margin: '0 0 12px' }}>
                HTML-in-Canvas is not enabled
            </h3>
            <p style={{ color: COLOR.muted, margin: '0 0 12px' }}>
                <code>CanvasRenderingContext2D.drawElementImage</code> is
                missing. The API ships in this app&apos;s Chromium (150) but is
                off by default. Add the switch before{' '}
                <code>app.whenReady()</code> in <code>electron/index.ts</code>:
            </p>
            <pre
                style={{
                    background: COLOR.panel,
                    border: `1px solid ${COLOR.border}`,
                    borderRadius: 4,
                    padding: 12,
                    fontSize: 12,
                    overflowX: 'auto',
                }}
            >
                {
                    "app.commandLine.appendSwitch(\n    'enable-blink-features',\n    'CanvasDrawElement',\n);"
                }
            </pre>
            <p style={{ color: COLOR.muted }}>
                <code>--enable-features=CanvasDrawElement</code> works too.
                Restart the app afterwards. See <code>./README.md</code> for the
                full research write-up.
            </p>
        </div>
    );
}

export default function HtmlInCanvasComp() {
    const [selectedId, setSelectedId] = useState(DEMO_LIST[0].id);
    const [searchText, setSearchText] = useState('');
    const isSupported = useMemo(() => {
        return checkIsSupported();
    }, []);

    if (!isSupported) {
        return <UnsupportedComp />;
    }

    const demo =
        DEMO_LIST.find((item) => {
            return item.id === selectedId;
        }) ?? DEMO_LIST[0];
    const termList = toSearchTermList(searchText);
    const matchedList =
        termList.length === 0
            ? DEMO_LIST
            : DEMO_LIST.filter((item) => {
                  return checkIsMatch(item, termList);
              });
    const groupList = [...new Set(matchedList.map((item) => item.group))];

    return (
        <div
            style={{
                display: 'flex',
                height: '100%',
                background: COLOR.bg,
                color: COLOR.text,
                font: '13px sans-serif',
            }}
        >
            <div
                style={{
                    width: 168,
                    flexShrink: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    borderRight: `1px solid ${COLOR.border}`,
                    padding: '8px 0',
                }}
            >
                <div style={{ flexShrink: 0, padding: '0 8px 8px' }}>
                    <input
                        type="search"
                        value={searchText}
                        placeholder="Filter demos…"
                        onChange={(event) => {
                            setSearchText(event.target.value);
                        }}
                        onKeyDown={(event) => {
                            if (event.key === 'Escape') {
                                setSearchText('');
                            } else if (
                                event.key === 'Enter' &&
                                matchedList.length > 0
                            ) {
                                setSelectedId(matchedList[0].id);
                            }
                        }}
                        style={{
                            width: '100%',
                            boxSizing: 'border-box',
                            background: COLOR.panel,
                            border: `1px solid ${COLOR.border}`,
                            borderRadius: 4,
                            color: COLOR.text,
                            font: 'inherit',
                            fontSize: 12,
                            padding: '4px 6px',
                            outline: 'none',
                        }}
                    />
                    {termList.length > 0 ? (
                        <div
                            style={{
                                fontSize: 10,
                                color:
                                    matchedList.length > 0
                                        ? COLOR.muted
                                        : COLOR.warn,
                                padding: '4px 2px 0',
                            }}
                        >
                            {matchedList.length > 0
                                ? `${matchedList.length} of ${DEMO_LIST.length}` +
                                  ' · enter opens the first'
                                : 'no match'}
                        </div>
                    ) : null}
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {groupList.map((group) => {
                        return (
                            <div key={group} style={{ marginBottom: 6 }}>
                                <div
                                    style={{
                                        fontSize: 10,
                                        textTransform: 'uppercase',
                                        letterSpacing: 1,
                                        color: COLOR.muted,
                                        padding: '4px 10px',
                                    }}
                                >
                                    {group}
                                </div>
                                {matchedList
                                    .filter((item) => {
                                        return item.group === group;
                                    })
                                    .map((item) => {
                                        const isActive = item.id === demo.id;
                                        return (
                                            <div
                                                key={item.id}
                                                onClick={() => {
                                                    setSelectedId(item.id);
                                                }}
                                                style={{
                                                    padding: '5px 10px',
                                                    fontSize: 12,
                                                    cursor: 'pointer',
                                                    background: isActive
                                                        ? COLOR.panelSoft
                                                        : 'transparent',
                                                    borderLeft: `3px solid ${
                                                        isActive
                                                            ? COLOR.accent
                                                            : 'transparent'
                                                    }`,
                                                    color: isActive
                                                        ? COLOR.text
                                                        : COLOR.muted,
                                                }}
                                            >
                                                {item.title}
                                            </div>
                                        );
                                    })}
                            </div>
                        );
                    })}
                </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
                <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>
                    {demo.title}
                </h3>
                <div
                    style={{
                        fontSize: 11,
                        color: COLOR.muted,
                        marginBottom: 12,
                    }}
                >
                    Chromium{' '}
                    {navigator.userAgent.match(/Chrome\/(\d+)/)?.[1] ?? '?'} ·
                    dpr {devicePixelRatio} · see ./README.md
                </div>
                <demo.Comp key={demo.id} />
                <DemoSourceComp
                    key={`${demo.id}-source`}
                    sourceList={demo.sourceList}
                />
            </div>
        </div>
    );
}
