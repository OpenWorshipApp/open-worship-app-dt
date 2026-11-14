// What an AI client takes to start the extra-bin pack's MCP server, for every
// client the Settings → Extra Binaries → AI agents (MCP) row offers
// (2026-11-13, the user: _for mcp connection, let user choose tool specific
// like chatgpt clause or just binary file path and so on_, then _provide
// maximum options for user_, and the story _as a user I want to copy mcp
// connection for my tool beside claude_).
//
// A leaf on purpose: every text is derived from the one path the panel
// already read. Nothing here reads or writes a file, and nothing is kept.
//
// Each row was checked against the client's own documentation on 2026-11-13
// (a file path a client's documents do not give for one platform is the
// usual place for it there); `args: []` goes in every one, as Warp requires
// and the rest allow.
// The ChatGPT app itself starts no program on the computer (it reaches only
// remote connectors), so ChatGPT is offered through Codex, OpenAI's agent
// that comes with a ChatGPT plan.

import appProvider from '../../server/appProvider';

// The name the server goes by in a client: the one `.mcp.json`, the
// robot-test skill and the npm package's README use, so the tools arrive as
// `mcp__owa-devtools__*` whichever way it was installed.
export const MCP_CLIENT_SERVER_NAME = 'owa-devtools';

export const MCP_CLIENT_SETTING_NAME = 'extra-bin-mcp-client';
export const MCP_CLIENT_DEFAULT_KEY = 'claude-code';
export const MCP_CLIENT_PATH_KEY = 'program-path';

export type McpPlatformType = 'mac' | 'windows' | 'linux';

export function getMcpPlatform(): McpPlatformType {
    if (appProvider.systemUtils.isWindows) {
        return 'windows';
    }
    if (appProvider.systemUtils.isMac) {
        return 'mac';
    }
    return 'linux';
}

/**
 * Quoted for the shell it will meet: single quotes on macOS and Linux (a data
 * folder under "Application Support" has a space), double quotes on Windows,
 * where cmd.exe knows no others and PowerShell takes them as well.
 */
function quoteForShell(text: string, isWindows: boolean) {
    return isWindows ? `"${text}"` : `'${text.replaceAll("'", "'\\''")}'`;
}

/** What a person pastes into a terminal to give Claude Code the server. */
export function genMcpClientCommand(
    mcpBinPath: string,
    isWindows = appProvider.systemUtils.isWindows,
) {
    return (
        `claude mcp add ${MCP_CLIENT_SERVER_NAME} -- ` +
        quoteForShell(mcpBinPath, isWindows)
    );
}

function toJson(value: unknown) {
    return JSON.stringify(value, null, 2);
}

function toMcpServersJson(server: Record<string, unknown>) {
    return toJson({ mcpServers: { [MCP_CLIENT_SERVER_NAME]: server } });
}

/**
 * The same, for a client configured with JSON: the `mcpServers` shape most of
 * them read (Claude Desktop, Cursor, Windsurf, Cline ...).
 */
export function genMcpClientJson(mcpBinPath: string) {
    return toMcpServersJson({ command: mcpBinPath, args: [] });
}

// A JSON string is a valid TOML basic string and a valid YAML double-quoted
// scalar, so a Windows path's backslashes and a path's spaces come out right
// in both without a TOML or YAML library.
function toQuoted(text: string) {
    return JSON.stringify(text);
}

export type McpClientGroupType = 'command' | 'file' | 'other';

export const MCP_CLIENT_GROUP_LIST: readonly McpClientGroupType[] = [
    'command',
    'file',
    'other',
];

export type McpClientType = {
    key: string;
    // The product's own name, the same in every language; the program-path
    // row is named by the panel.
    name: string;
    group: McpClientGroupType;
    // The file the text goes in. A path starting `~/` is under the person's
    // home folder on every platform; a platform missing from a map has no
    // such file there. Absent for a command (a terminal takes it) and for a
    // client set up in its own window.
    where?: string | Partial<Record<McpPlatformType, string>>;
    // Offered only on these platforms.
    platforms?: readonly McpPlatformType[];
    genText: (mcpBinPath: string, platform: McpPlatformType) => string;
};

function genMcpServersText(mcpBinPath: string) {
    return genMcpClientJson(mcpBinPath);
}

/** `<cli> mcp add ...` with the path quoted for this platform's shell. */
function genAddCommand(before: string, after = '') {
    return (mcpBinPath: string, platform: McpPlatformType) => {
        return (
            `${before} ` +
            quoteForShell(mcpBinPath, platform === 'windows') +
            after
        );
    };
}

function genTypedMcpServersText(type: string, extra = {}) {
    return (mcpBinPath: string) => {
        return toMcpServersJson({
            type,
            command: mcpBinPath,
            args: [],
            ...extra,
        });
    };
}

function genServersText(mcpBinPath: string) {
    return toJson({
        servers: {
            [MCP_CLIENT_SERVER_NAME]: {
                type: 'stdio',
                command: mcpBinPath,
                args: [],
            },
        },
    });
}

const NAME = MCP_CLIENT_SERVER_NAME;

export const MCP_CLIENT_LIST: readonly McpClientType[] = [
    // A terminal command: the client writes its own settings. Each is the
    // client's documented `mcp add`, at the scope that reaches every folder
    // where the client has one.
    {
        key: MCP_CLIENT_DEFAULT_KEY,
        name: 'Claude Code',
        group: 'command',
        genText: (mcpBinPath, platform) => {
            return genMcpClientCommand(mcpBinPath, platform === 'windows');
        },
    },
    {
        key: 'claude-code-user',
        name: 'Claude Code (--scope user)',
        group: 'command',
        genText: genAddCommand(`claude mcp add --scope user ${NAME} --`),
    },
    {
        key: 'codex',
        name: 'Codex (ChatGPT)',
        group: 'command',
        genText: genAddCommand(`codex mcp add ${NAME} --`),
    },
    {
        key: 'gemini-cli',
        name: 'Gemini CLI',
        group: 'command',
        genText: genAddCommand(`gemini mcp add -s user ${NAME}`),
    },
    {
        key: 'qwen-code-cli',
        name: 'Qwen Code',
        group: 'command',
        genText: genAddCommand(`qwen mcp add -s user ${NAME}`),
    },
    {
        key: 'copilot-cli-command',
        name: 'GitHub Copilot CLI',
        group: 'command',
        genText: genAddCommand(`copilot mcp add ${NAME} --`),
    },
    {
        key: 'cline-cli',
        name: 'Cline CLI',
        group: 'command',
        genText: genAddCommand(`cline mcp add ${NAME} --yes --`),
    },
    {
        key: 'devin-cli',
        name: 'Devin CLI',
        group: 'command',
        genText: genAddCommand(`devin mcp add -s user ${NAME} --`),
    },
    {
        key: 'opencode-cli',
        name: 'opencode',
        group: 'command',
        genText: genAddCommand(`opencode mcp add ${NAME} --global --`),
    },
    {
        key: 'amp-cli',
        name: 'Amp',
        group: 'command',
        genText: genAddCommand(`amp mcp add ${NAME} --`),
    },
    // A settings file: the text goes in the file named under it.
    {
        key: 'claude-desktop',
        name: 'Claude Desktop',
        group: 'file',
        where: {
            mac: '~/Library/Application Support/Claude/claude_desktop_config.json',
            windows: '%APPDATA%\\Claude\\claude_desktop_config.json',
            linux: '~/.config/Claude/claude_desktop_config.json',
        },
        genText: genMcpServersText,
    },
    {
        key: 'codex-config',
        name: 'Codex (ChatGPT)',
        group: 'file',
        where: '~/.codex/config.toml',
        genText: (mcpBinPath) => {
            return (
                `[mcp_servers.${NAME}]\n` +
                `command = ${toQuoted(mcpBinPath)}\n` +
                'args = []'
            );
        },
    },
    {
        key: 'gemini-settings',
        name: 'Gemini CLI',
        group: 'file',
        where: '~/.gemini/settings.json',
        genText: genMcpServersText,
    },
    {
        key: 'antigravity',
        name: 'Antigravity',
        group: 'file',
        where: '~/.gemini/config/mcp_config.json',
        genText: genMcpServersText,
    },
    {
        key: 'qwen-code',
        name: 'Qwen Code',
        group: 'file',
        where: '~/.qwen/settings.json',
        genText: genMcpServersText,
    },
    {
        key: 'cursor',
        name: 'Cursor',
        group: 'file',
        where: '~/.cursor/mcp.json',
        genText: genTypedMcpServersText('stdio'),
    },
    {
        // Windsurf's documentation now lives with Devin Desktop, whose
        // user file the editor reads.
        key: 'windsurf',
        name: 'Windsurf (Devin Desktop)',
        group: 'file',
        where: {
            mac: '~/.config/devin/mcp_config.json',
            linux: '~/.config/devin/mcp_config.json',
            windows: '%APPDATA%\\devin\\mcp_config.json',
        },
        genText: genMcpServersText,
    },
    {
        // The file VS Code's own documentation recommends since its
        // `mcp.json` became the deprecated "local harness".
        key: 'vscode',
        name: 'VS Code (GitHub Copilot)',
        group: 'file',
        where: '~/.copilot/mcp-config.json',
        genText: genTypedMcpServersText('stdio', { tools: ['*'] }),
    },
    {
        key: 'vscode-workspace',
        name: 'VS Code (.vscode/mcp.json)',
        group: 'file',
        where: '.vscode/mcp.json',
        genText: genServersText,
    },
    {
        key: 'visual-studio',
        name: 'Visual Studio (GitHub Copilot)',
        group: 'file',
        where: '~/.mcp.json',
        platforms: ['windows'],
        genText: genServersText,
    },
    {
        key: 'copilot-cli',
        name: 'GitHub Copilot CLI',
        group: 'file',
        where: '~/.copilot/mcp-config.json',
        genText: genTypedMcpServersText('local', { tools: ['*'] }),
    },
    {
        key: 'zed',
        name: 'Zed',
        group: 'file',
        where: {
            mac: '~/.config/zed/settings.json',
            linux: '~/.config/zed/settings.json',
            windows: '%APPDATA%\\Zed\\settings.json',
        },
        genText: (mcpBinPath) => {
            return toJson({
                context_servers: {
                    [NAME]: { command: mcpBinPath, args: [] },
                },
            });
        },
    },
    {
        key: 'cline',
        name: 'Cline',
        group: 'file',
        where: 'cline_mcp_settings.json',
        genText: genMcpServersText,
    },
    {
        key: 'roo-code',
        name: 'Roo Code',
        group: 'file',
        where: 'mcp_settings.json',
        genText: genMcpServersText,
    },
    {
        key: 'kilo-code',
        name: 'Kilo Code',
        group: 'file',
        where: '~/.config/kilo/kilo.jsonc',
        genText: (mcpBinPath) => {
            return toJson({
                mcp: {
                    [NAME]: {
                        type: 'local',
                        command: [mcpBinPath],
                        enabled: true,
                    },
                },
            });
        },
    },
    {
        key: 'kiro',
        name: 'Kiro',
        group: 'file',
        where: '~/.kiro/settings/mcp.json',
        genText: genMcpServersText,
    },
    {
        // Set up in its own window (Settings > MCP > Add > Create Manually);
        // it refuses a command with a space in it.
        key: 'trae',
        name: 'Trae',
        group: 'file',
        genText: genMcpServersText,
    },
    {
        // Settings | Tools | AI Assistant | Model Context Protocol: no file.
        key: 'jetbrains',
        name: 'JetBrains AI Assistant',
        group: 'file',
        genText: genMcpServersText,
    },
    {
        key: 'junie',
        name: 'JetBrains Junie',
        group: 'file',
        where: '~/.junie/mcp/mcp.json',
        genText: genMcpServersText,
    },
    {
        key: 'lm-studio',
        name: 'LM Studio',
        group: 'file',
        where: '~/.lmstudio/mcp.json',
        genText: genMcpServersText,
    },
    {
        key: 'warp',
        name: 'Warp',
        group: 'file',
        where: '~/.warp/.mcp.json',
        genText: genMcpServersText,
    },
    {
        key: 'anythingllm',
        name: 'AnythingLLM',
        group: 'file',
        where: {
            mac:
                '~/Library/Application Support/anythingllm-desktop/storage/' +
                'plugins/anythingllm_mcp_servers.json',
            windows:
                '%APPDATA%\\anythingllm-desktop\\storage\\plugins\\' +
                'anythingllm_mcp_servers.json',
            linux:
                '~/.config/anythingllm-desktop/storage/plugins/' +
                'anythingllm_mcp_servers.json',
        },
        genText: genMcpServersText,
    },
    {
        key: 'augment',
        name: 'Augment (Auggie)',
        group: 'file',
        where: '~/.augment/settings.json',
        genText: genMcpServersText,
    },
    {
        key: 'factory-droid',
        name: 'Factory Droid',
        group: 'file',
        where: '~/.factory/mcp.json',
        genText: genTypedMcpServersText('stdio'),
    },
    {
        key: 'continue',
        name: 'Continue',
        group: 'file',
        where: '~/.continue/config.yaml',
        genText: (mcpBinPath) => {
            return (
                'mcpServers:\n' +
                `  - name: ${NAME}\n` +
                '    type: stdio\n' +
                `    command: ${toQuoted(mcpBinPath)}`
            );
        },
    },
    {
        key: 'goose',
        name: 'Goose',
        group: 'file',
        where: {
            mac: '~/.config/goose/config.yaml',
            linux: '~/.config/goose/config.yaml',
            windows: '%APPDATA%\\Block\\goose\\config\\config.yaml',
        },
        genText: (mcpBinPath) => {
            return (
                'extensions:\n' +
                `  ${NAME}:\n` +
                '    type: stdio\n' +
                `    name: ${NAME}\n` +
                '    enabled: true\n' +
                `    cmd: ${toQuoted(mcpBinPath)}\n` +
                '    args: []\n' +
                '    env_keys: []\n' +
                '    envs: {}\n' +
                '    timeout: 300'
            );
        },
    },
    {
        key: 'opencode',
        name: 'opencode',
        group: 'file',
        where: '~/.config/opencode/opencode.json',
        genText: (mcpBinPath) => {
            return toJson({
                $schema: 'https://opencode.ai/config.json',
                mcp: {
                    servers: {
                        [NAME]: { type: 'local', command: [mcpBinPath] },
                    },
                },
            });
        },
    },
    {
        key: 'amp',
        name: 'Amp',
        group: 'file',
        where: '~/.config/amp/settings.json',
        genText: (mcpBinPath) => {
            return toJson({
                'amp.mcpServers': {
                    [NAME]: { command: mcpBinPath, args: [] },
                },
            });
        },
    },
    // Neither a command nor one client's file.
    {
        key: 'mcp-servers-json',
        name: 'JSON (mcpServers)',
        group: 'other',
        genText: genMcpServersText,
    },
    {
        key: MCP_CLIENT_PATH_KEY,
        name: 'open-worship-app-mcp',
        group: 'other',
        genText: (mcpBinPath) => {
            return mcpBinPath;
        },
    },
];

export function checkIsMcpClientOnPlatform(
    client: McpClientType,
    platform: McpPlatformType,
) {
    return (
        client.platforms === undefined || client.platforms.includes(platform)
    );
}

/** The picker's groups in order, each with its clients for this platform. */
export function groupMcpClientList(platform: McpPlatformType) {
    return MCP_CLIENT_GROUP_LIST.map((group) => {
        return {
            group,
            clientList: MCP_CLIENT_LIST.filter((client) => {
                return (
                    client.group === group &&
                    checkIsMcpClientOnPlatform(client, platform)
                );
            }),
        };
    });
}

/** A file under the home folder as the person types it on their platform. */
function toPlatformWhere(where: string, platform: McpPlatformType) {
    if (platform !== 'windows' || !where.startsWith('~/')) {
        return where;
    }
    return `%USERPROFILE%\\${where.slice(2).replaceAll('/', '\\')}`;
}

export function findMcpClientWhere(
    client: McpClientType,
    platform: McpPlatformType,
) {
    const { where } = client;
    if (where === undefined) {
        return null;
    }
    const platformWhere = typeof where === 'string' ? where : where[platform];
    if (platformWhere === undefined) {
        return null;
    }
    return toPlatformWhere(platformWhere, platform);
}

/**
 * The client a remembered key names, or Claude Code when it names none here
 * (a key from an older list, or a client this platform does not have).
 */
export function findMcpClient(key: string, platform: McpPlatformType) {
    const client = MCP_CLIENT_LIST.find((item) => {
        return item.key === key && checkIsMcpClientOnPlatform(item, platform);
    });
    return (
        client ??
        (MCP_CLIENT_LIST.find((item) => {
            return item.key === MCP_CLIENT_DEFAULT_KEY;
        }) as McpClientType)
    );
}

/** What the row shows and Copy puts on the clipboard for one client. */
export function genMcpClientText(
    key: string,
    mcpBinPath: string,
    platform: McpPlatformType = getMcpPlatform(),
) {
    const client = findMcpClient(key, platform);
    return {
        client,
        text: client.genText(mcpBinPath, platform),
        where: findMcpClientWhere(client, platform),
    };
}
