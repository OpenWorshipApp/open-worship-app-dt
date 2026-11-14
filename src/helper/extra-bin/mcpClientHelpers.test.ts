import { describe, expect, test, vi } from 'vitest';

const { appProviderMock } = vi.hoisted(() => ({
    appProviderMock: {
        systemUtils: { isWindows: false, isMac: true },
    },
}));

vi.mock('../../server/appProvider', () => ({ default: appProviderMock }));

import type { McpPlatformType } from './mcpClientHelpers';
import {
    findMcpClient,
    genMcpClientCommand,
    genMcpClientJson,
    genMcpClientText,
    getMcpPlatform,
    groupMcpClientList,
    MCP_CLIENT_DEFAULT_KEY,
    MCP_CLIENT_LIST,
    MCP_CLIENT_PATH_KEY,
} from './mcpClientHelpers';

// A space (a data folder under "Application Support") and a quote, which a
// POSIX shell must not end the path at.
const MAC_PATH =
    "/Users/ann/Library/Application Support/o'w/extra-bin/mac/mcp/open-worship-app-mcp";
const WIN_PATH =
    'C:\\Users\\Ann\\open-worship-data\\extra-bin\\win\\mcp\\open-worship-app-mcp.exe';
const MAC_QUOTED =
    "'/Users/ann/Library/Application Support/o'\\''w/extra-bin/mac/mcp/open-worship-app-mcp'";

function genText(key: string, binPath: string, platform: McpPlatformType) {
    const result = genMcpClientText(key, binPath, platform);
    expect(result.client.key).toBe(key);
    return result;
}

describe('mcpClientHelpers', () => {
    test('names the platform the app runs on', () => {
        const { systemUtils } = appProviderMock;
        expect(getMcpPlatform()).toBe('mac');
        systemUtils.isMac = false;
        expect(getMcpPlatform()).toBe('linux');
        systemUtils.isWindows = true;
        expect(getMcpPlatform()).toBe('windows');
        systemUtils.isWindows = false;
        systemUtils.isMac = true;
    });

    test('every client has a key of its own and a text for each path', () => {
        const keys = MCP_CLIENT_LIST.map((client) => client.key);
        expect(new Set(keys).size).toBe(keys.length);
        for (const client of MCP_CLIENT_LIST) {
            for (const [binPath, platform] of [
                [MAC_PATH, 'mac'],
                [WIN_PATH, 'windows'],
                [MAC_PATH, 'linux'],
            ] as const) {
                const text = client.genText(binPath, platform);
                expect(text, client.key).not.toBe('');
                if (text.trimStart().startsWith('{')) {
                    // A JSON text parses, and carries the path as it is.
                    expect(JSON.stringify(JSON.parse(text))).toContain(
                        JSON.stringify(binPath).slice(1, -1),
                    );
                }
            }
        }
    });

    test('a terminal command quotes the path for the shell it meets', () => {
        expect(genText('claude-code', MAC_PATH, 'mac').text).toBe(
            `claude mcp add owa-devtools -- ${MAC_QUOTED}`,
        );
        expect(genText('claude-code', WIN_PATH, 'windows').text).toBe(
            `claude mcp add owa-devtools -- "${WIN_PATH}"`,
        );
        expect(genText('claude-code-user', MAC_PATH, 'linux').text).toBe(
            `claude mcp add --scope user owa-devtools -- ${MAC_QUOTED}`,
        );
        expect(genText('codex', WIN_PATH, 'windows').text).toBe(
            `codex mcp add owa-devtools -- "${WIN_PATH}"`,
        );
        expect(genText('gemini-cli', MAC_PATH, 'mac').text).toBe(
            `gemini mcp add -s user owa-devtools ${MAC_QUOTED}`,
        );
        expect(genText('copilot-cli-command', WIN_PATH, 'windows').text).toBe(
            `copilot mcp add owa-devtools -- "${WIN_PATH}"`,
        );
        expect(genText('opencode-cli', MAC_PATH, 'mac').text).toBe(
            `opencode mcp add owa-devtools --global -- ${MAC_QUOTED}`,
        );
        // A command goes in a terminal, not a file.
        expect(genText('codex', MAC_PATH, 'mac').where).toBeNull();
        // The same as the command the row always had.
        expect(genMcpClientCommand(WIN_PATH, true)).toBe(
            genText('claude-code', WIN_PATH, 'windows').text,
        );
    });

    test('a settings file text is the shape that client reads', () => {
        expect(
            JSON.parse(genText('claude-desktop', WIN_PATH, 'windows').text),
        ).toEqual({
            mcpServers: { 'owa-devtools': { command: WIN_PATH, args: [] } },
        });
        // VS Code's recommended file, and its older workspace file.
        expect(JSON.parse(genText('vscode', WIN_PATH, 'windows').text)).toEqual(
            {
                mcpServers: {
                    'owa-devtools': {
                        type: 'stdio',
                        command: WIN_PATH,
                        args: [],
                        tools: ['*'],
                    },
                },
            },
        );
        expect(
            JSON.parse(genText('vscode-workspace', WIN_PATH, 'windows').text),
        ).toEqual({
            servers: {
                'owa-devtools': { type: 'stdio', command: WIN_PATH, args: [] },
            },
        });
        expect(
            JSON.parse(genText('copilot-cli', MAC_PATH, 'mac').text).mcpServers[
                'owa-devtools'
            ].type,
        ).toBe('local');
        // opencode's V2 shape: servers under `mcp.servers`.
        expect(
            JSON.parse(genText('opencode', MAC_PATH, 'mac').text).mcp,
        ).toEqual({
            servers: {
                'owa-devtools': { type: 'local', command: [MAC_PATH] },
            },
        });
        expect(JSON.parse(genText('zed', MAC_PATH, 'mac').text)).toEqual({
            context_servers: {
                'owa-devtools': { command: MAC_PATH, args: [] },
            },
        });
        expect(JSON.parse(genText('amp', MAC_PATH, 'mac').text)).toEqual({
            'amp.mcpServers': {
                'owa-devtools': { command: MAC_PATH, args: [] },
            },
        });
        // TOML and YAML take the path as a JSON-style quoted string, so a
        // Windows path's backslashes are escaped and its spaces kept.
        expect(genText('codex-config', WIN_PATH, 'windows').text).toBe(
            '[mcp_servers.owa-devtools]\n' +
                'command = "C:\\\\Users\\\\Ann\\\\open-worship-data\\\\extra-bin\\\\win\\\\mcp\\\\open-worship-app-mcp.exe"\n' +
                'args = []',
        );
        expect(genText('continue', MAC_PATH, 'mac').text).toBe(
            'mcpServers:\n' +
                '  - name: owa-devtools\n' +
                '    type: stdio\n' +
                `    command: ${JSON.stringify(MAC_PATH)}`,
        );
        expect(genText('goose', MAC_PATH, 'mac').text).toContain(
            `    cmd: ${JSON.stringify(MAC_PATH)}\n`,
        );
        expect(genMcpClientJson(WIN_PATH)).toBe(
            genText('mcp-servers-json', WIN_PATH, 'windows').text,
        );
    });

    test('says which file the text goes in, as that platform writes it', () => {
        expect(genText('cursor', MAC_PATH, 'mac').where).toBe(
            '~/.cursor/mcp.json',
        );
        expect(genText('cursor', WIN_PATH, 'windows').where).toBe(
            '%USERPROFILE%\\.cursor\\mcp.json',
        );
        expect(genText('claude-desktop', MAC_PATH, 'mac').where).toBe(
            '~/Library/Application Support/Claude/claude_desktop_config.json',
        );
        expect(genText('claude-desktop', WIN_PATH, 'windows').where).toBe(
            '%APPDATA%\\Claude\\claude_desktop_config.json',
        );
        expect(genText('claude-desktop', MAC_PATH, 'linux').where).toBe(
            '~/.config/Claude/claude_desktop_config.json',
        );
        expect(genText('windsurf', WIN_PATH, 'windows').where).toBe(
            '%APPDATA%\\devin\\mcp_config.json',
        );
        // A client set up in its own window names no file.
        expect(genText('jetbrains', MAC_PATH, 'mac').where).toBeNull();
    });

    test('the program path is the path alone', () => {
        const result = genText(MCP_CLIENT_PATH_KEY, WIN_PATH, 'windows');
        expect(result.text).toBe(WIN_PATH);
        expect(result.where).toBeNull();
    });

    test('offers a client only where it runs, and falls back to Claude Code', () => {
        const toKeys = (platform: McpPlatformType) => {
            return groupMcpClientList(platform).flatMap(({ clientList }) => {
                return clientList.map((client) => client.key);
            });
        };
        expect(toKeys('windows')).toContain('visual-studio');
        expect(toKeys('mac')).not.toContain('visual-studio');
        expect(toKeys('linux')).toContain('claude-desktop');
        // Every client is in one group, in the catalogue's order.
        expect(toKeys('windows').length + 0).toBe(
            MCP_CLIENT_LIST.filter((client) => {
                return client.platforms?.includes('windows') ?? true;
            }).length,
        );
        expect(groupMcpClientList('mac').map(({ group }) => group)).toEqual([
            'command',
            'file',
            'other',
        ]);
        expect(findMcpClient('visual-studio', 'mac').key).toBe(
            MCP_CLIENT_DEFAULT_KEY,
        );
        expect(findMcpClient('gone-client', 'linux').key).toBe(
            MCP_CLIENT_DEFAULT_KEY,
        );
        expect(genMcpClientText('', MAC_PATH, 'mac').text).toBe(
            `claude mcp add owa-devtools -- ${MAC_QUOTED}`,
        );
    });
});
