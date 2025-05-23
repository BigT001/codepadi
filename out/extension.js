"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const serverManager_1 = require("./mcp/serverManager");
const serverTreeProvider_1 = require("./ui/serverTreeProvider");
const logger_1 = require("./utils/logger");
const promptService_1 = require("./services/promptService");
async function activate(context) {
    // Initialize logger
    const logger = new logger_1.Logger('Extension');
    logger.info('Codepadi extension is now active');
    // Initialize services
    const serverManager = new serverManager_1.ServerManager(context);
    const promptService = new promptService_1.PromptService();
    // Register tree view providers
    const serverTreeProvider = new serverTreeProvider_1.ServerTreeProvider(serverManager);
    const serverTreeView = vscode.window.createTreeView('mcpServers', {
        treeDataProvider: serverTreeProvider,
        showCollapseAll: true
    });
    context.subscriptions.push(serverTreeView);
    // Register commands
    registerCommands(context, serverManager, serverTreeProvider, promptService);
    // Create status bar item
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.text = "$(plug) Codepadi";
    statusBarItem.tooltip = "Codepadi MCP Agent";
    statusBarItem.command = "codepadi.showLogs";
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);
    logger.info('Codepadi extension initialized successfully');
}
function registerCommands(context, serverManager, serverTreeProvider, promptService) {
    // Connect to server command
    context.subscriptions.push(vscode.commands.registerCommand('codepadi.connect', async (treeItem) => {
        let serverId;
        if (treeItem && treeItem.server) {
            serverId = treeItem.server.id;
        }
        else {
            const serverOptions = serverManager.getAllServers().map(server => ({
                label: server.name,
                description: server.url,
                serverId: server.id
            }));
            if (serverOptions.length === 0) {
                const addServer = 'Add Server';
                const result = await vscode.window.showInformationMessage('No MCP servers configured. Would you like to add one?', addServer);
                if (result === addServer) {
                    vscode.commands.executeCommand('codepadi.addServer');
                }
                return;
            }
            const selected = await vscode.window.showQuickPick(serverOptions, {
                placeHolder: 'Select a server to connect to'
            });
            if (selected) {
                serverId = selected.serverId;
            }
        }
        if (serverId) {
            await serverManager.connectToServer(serverId);
            serverTreeProvider.refresh();
        }
    }));
    // Disconnect from server command
    context.subscriptions.push(vscode.commands.registerCommand('codepadi.disconnect', async (treeItem) => {
        let serverId;
        if (treeItem && treeItem.server) {
            serverId = treeItem.server.id;
        }
        else {
            const serverOptions = serverManager.getConnectedServers().map(server => ({
                label: server.name,
                description: server.url,
                serverId: server.id
            }));
            if (serverOptions.length === 0) {
                vscode.window.showInformationMessage('No connected servers to disconnect from.');
                return;
            }
            const selected = await vscode.window.showQuickPick(serverOptions, {
                placeHolder: 'Select a server to disconnect from'
            });
            if (selected) {
                serverId = selected.serverId;
            }
        }
        if (serverId) {
            serverManager.disconnectFromServer(serverId);
            serverTreeProvider.refresh();
        }
    }));
    // Add server command
    context.subscriptions.push(vscode.commands.registerCommand('codepadi.addServer', async () => {
        const name = await vscode.window.showInputBox({
            prompt: 'Enter server name',
            placeHolder: 'My MCP Server'
        });
        if (!name)
            return;
        const url = await vscode.window.showInputBox({
            prompt: 'Enter server URL',
            placeHolder: 'ws://localhost:8080 or http://example.com/mcp'
        });
        if (!url)
            return;
        const protocolOptions = ['ws', 'http', 'grpc'];
        const protocol = await vscode.window.showQuickPick(protocolOptions, {
            placeHolder: 'Select protocol'
        });
        if (!protocol)
            return;
        const authToken = await vscode.window.showInputBox({
            prompt: 'Enter authentication token (optional)',
            password: true
        });
        const serverId = `server-${Date.now()}`;
        await serverManager.addServer({
            id: serverId,
            name,
            url,
            protocol,
            authToken
        });
        serverTreeProvider.refresh();
        const connect = 'Connect Now';
        const result = await vscode.window.showInformationMessage(`Server "${name}" added successfully.`, connect);
        if (result === connect) {
            serverManager.connectToServer(serverId);
            serverTreeProvider.refresh();
        }
    }));
    // Remove server command
    context.subscriptions.push(vscode.commands.registerCommand('codepadi.removeServer', async (treeItem) => {
        let serverId;
        let serverName;
        if (treeItem && treeItem.server) {
            serverId = treeItem.server.id;
            serverName = treeItem.server.name;
        }
        else {
            const serverOptions = serverManager.getAllServers().map(server => ({
                label: server.name,
                description: server.url,
                serverId: server.id
            }));
            if (serverOptions.length === 0) {
                vscode.window.showInformationMessage('No servers to remove.');
                return;
            }
            const selected = await vscode.window.showQuickPick(serverOptions, {
                placeHolder: 'Select a server to remove'
            });
            if (selected) {
                serverId = selected.serverId;
                serverName = selected.label;
            }
        }
        if (serverId && serverName) {
            const confirm = await vscode.window.showWarningMessage(`Are you sure you want to remove server "${serverName}"?`, 'Yes', 'No');
            if (confirm === 'Yes') {
                await serverManager.removeServer(serverId);
                serverTreeProvider.refresh();
            }
        }
    }));
    // Show logs command
    context.subscriptions.push(vscode.commands.registerCommand('codepadi.showLogs', () => {
        logger_1.Logger.show();
    }));
    // Execute command prompt
    context.subscriptions.push(vscode.commands.registerCommand('codepadi.executeCommand', async (treeItem) => {
        let client;
        if (treeItem && treeItem.server) {
            client = serverManager.getClient(treeItem.server.id);
        }
        else {
            const connectedServers = serverManager.getConnectedServers();
            if (connectedServers.length === 0) {
                vscode.window.showInformationMessage('No connected servers available. Please connect to a server first.');
                return;
            }
            if (connectedServers.length === 1) {
                client = serverManager.getClient(connectedServers[0].id);
            }
            else {
                const serverOptions = connectedServers.map(server => ({
                    label: server.name,
                    description: server.url,
                    serverId: server.id
                }));
                const selected = await vscode.window.showQuickPick(serverOptions, {
                    placeHolder: 'Select a server to execute command on'
                });
                if (selected) {
                    client = serverManager.getClient(selected.serverId);
                }
            }
        }
        if (client) {
            await promptService.showCommandPrompt(client);
        }
    }));
}
function deactivate() {
    // Clean up resources when the extension is deactivated
}
//# sourceMappingURL=extension.js.map