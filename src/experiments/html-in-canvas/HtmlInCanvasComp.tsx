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
    const groupList = [...new Set(DEMO_LIST.map((item) => item.group))];

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
                    borderRight: `1px solid ${COLOR.border}`,
                    overflowY: 'auto',
                    padding: '8px 0',
                }}
            >
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
                            {DEMO_LIST.filter((item) => {
                                return item.group === group;
                            }).map((item) => {
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
