#!/usr/bin/env node
// Asks ONE question in the help window of ONE development instance, found by
// a piece of its userDataPath, over raw CDP -- the way a person types it: the
// box's words through React's own setter, then Send. Prints every tool call
// the window makes (the model's arguments, read off the network) and the
// answer with the buttons under it (owa-enhance-bible-note-chatbot, §4).
//
//   node .claude/skills/owa-enhance-bible-note-chatbot/scripts/ask-note-chat.mjs <userDataPath part> "<question>" [waitSeconds]
//
// A SCRATCH profile only (memory scratch-dev-instance-beside-user-app): it
// refuses a packaged instance and the person's own development profile
// (`open-worship-app-dev`). The help window must already be open on the
// note -- its caution's Open is the person's press unless the conversation
// allowed it (CLAUDE.md, Agent access).
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const [, , userDataPart, question, waitSeconds = '120'] = process.argv;
let instance = null;
for (const file of readdirSync(join(tmpdir(), 'open-worship-app-cdp'))) {
    const data = JSON.parse(
        readFileSync(join(tmpdir(), 'open-worship-app-cdp', file), 'utf8'),
    );
    if (String(data.userDataPath ?? '').includes(userDataPart)) instance = data;
}
if (instance === null || instance.isDev !== true) {
    console.error('No development instance matches', userDataPart);
    process.exit(1);
}
if (/open-worship-app-dev[\/]?$/i.test(String(instance.userDataPath))) {
    console.error(
        "That is the person's own development profile: use a scratch one.",
    );
    process.exit(1);
}
const targets = await (
    await fetch(`http://127.0.0.1:${instance.port}/json/list`)
).json();
const target = targets.find(
    (one) => one.type === 'page' && one.url.includes('chatbot.html'),
);
if (!target) {
    console.error('no help window');
    process.exit(1);
}
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve) => socket.addEventListener('open', resolve));
let id = 0;
function evaluate(expression) {
    return new Promise((resolve) => {
        const myId = ++id;
        const onMessage = (event) => {
            const message = JSON.parse(event.data);
            if (message.id === myId) {
                socket.removeEventListener('message', onMessage);
                resolve(message.result?.result?.value);
            }
        };
        socket.addEventListener('message', onMessage);
        socket.send(
            JSON.stringify({
                id: myId,
                method: 'Runtime.evaluate',
                params: { expression, returnByValue: true, awaitPromise: true },
            }),
        );
    });
}
socket.send(
    JSON.stringify({ id: 900000, method: 'Network.enable', params: {} }),
);
socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    const body =
        message.method === 'Network.requestWillBeSent'
            ? message.params?.request?.postData
            : null;
    if (typeof body === 'string' && body.includes('tools/call')) {
        try {
            const parsed = JSON.parse(body);
            console.log(
                'TOOL',
                parsed.params?.name,
                JSON.stringify(parsed.params?.arguments).slice(0, 1500),
            );
        } catch {}
    }
});
const countExpression = `document.querySelectorAll('article.cue').length`;
const before = await evaluate(countExpression);
const typed = await evaluate(`(() => {
    const box = document.querySelector('textarea');
    if (!box) return 'no box';
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    setter.call(box, ${JSON.stringify(question)});
    box.dispatchEvent(new Event('input', { bubbles: true }));
    return 'typed';
})()`);
await new Promise((resolve) => setTimeout(resolve, 300));
const sent = await evaluate(`(() => {
    // The box's own Send, by its place in the form -- not its words, which are the window's language.
    const button = document.querySelector('button.chat-send[type=submit]:not(.chat-add)');
    if (!button) return 'no send';
    button.click();
    return 'sent';
})()`);
console.log(typed, sent);
const started = Date.now();
let last = '';
while (Date.now() - started < Number(waitSeconds) * 1000) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const state = await evaluate(`(() => {
        const isBusy = [...document.querySelectorAll('button')].some((one) => (one.innerText || '').trim().toUpperCase() === 'STOP');
        const cues = [...document.querySelectorAll('article.cue')];
        return JSON.stringify({ isBusy, count: cues.length });
    })()`);
    const { isBusy, count } = JSON.parse(state);
    if (!isBusy && count >= before + 2) {
        break;
    }
    last = state;
}
const answer = await evaluate(`(() => {
    const cues = [...document.querySelectorAll('article.cue')];
    const lastCue = cues[cues.length - 1];
    if (!lastCue) return '';
    const buttons = [...lastCue.querySelectorAll('button')].map((one) => (one.innerText || one.title || '').trim()).filter(Boolean);
    return (lastCue.innerText || '').slice(0, 2500) + '\\n-- buttons: ' + buttons.join(' | ');
})()`);
console.log(`(${Math.round((Date.now() - started) / 1000)} s)`);
console.log(answer);
socket.close();
process.exit(0);
