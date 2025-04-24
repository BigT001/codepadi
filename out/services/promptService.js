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
exports.PromptService = void 0;
const vscode = __importStar(require("vscode"));
const logger_1 = require("../utils/logger");
class PromptService {
    constructor() {
        this.outputChannels = new Map();
        this.commandHistory = [];
        this.logger = new logger_1.Logger('PromptService');
    }
    /**
     * Show an input prompt to the user and send the command to the server
     */
    async showCommandPrompt(client) {
        // Get server details from the client
        const serverConfig = this.getServerConfig(client);
        const serverName = serverConfig.name;
        // Create quick pick for command history
        const quickPick = vscode.window.createQuickPick();
        quickPick.placeholder = 'Enter command to execute on server';
        quickPick.title = `Server: ${serverName}`;
        // Add history items
        const historyItems = this.commandHistory.map(cmd => ({ label: cmd }));
        quickPick.items = historyItems;
        // Handle selection
        quickPick.onDidAccept(async () => {
            const command = quickPick.value || (quickPick.selectedItems[0]?.label);
            quickPick.hide();
            if (!command) {
                return;
            }
            // Add to history if not already at the top
            if (this.commandHistory.length === 0 || this.commandHistory[0] !== command) {
                this.commandHistory.unshift(command);
                // Limit history size
                if (this.commandHistory.length > 50) {
                    this.commandHistory.pop();
                }
            }
            // Get or create output channel for this server
            let outputChannel = this.outputChannels.get(serverName);
            if (!outputChannel) {
                outputChannel = vscode.window.createOutputChannel(`Codepadi - ${serverName}`);
                this.outputChannels.set(serverName, outputChannel);
            }
            outputChannel.appendLine(`\n[${new Date().toISOString()}] Executing command: ${command}`);
            outputChannel.appendLine('-------------------');
            outputChannel.show();
            // Show a progress notification
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: `Executing command on ${serverName}`,
                cancellable: true
            }, async (progress, token) => {
                progress.report({ increment: 0, message: 'Sending command...' });
                try {
                    // Execute the command
                    const result = await this.executeCommand(client, command);
                    progress.report({ increment: 100, message: 'Command executed' });
                    // Show the result in the output channel
                    this.showCommandResult(outputChannel, result);
                    return result;
                }
                catch (error) {
                    this.logger.error(`Command execution failed: ${error.message}`);
                    outputChannel.appendLine(`ERROR: ${error.message}`);
                    vscode.window.showErrorMessage(`Command execution failed: ${error.message}`);
                    throw error;
                }
            });
        });
        quickPick.show();
    }
    /**
     * Execute a command on the server
     */
    async executeCommand(client, command) {
        return new Promise((resolve, reject) => {
            // Create a unique ID for this command
            const commandId = Date.now().toString();
            // Create a one-time event listener for the command result
            const disposable = vscode.commands.registerCommand(`codepadi.commandResult.${commandId}`, (result) => {
                disposable.dispose(); // Clean up the command
                if (result.success) {
                    resolve(result.result);
                }
                else {
                    reject(new Error(result.error || 'Command execution failed'));
                }
            });
            // Send the command to the server
            const success = client.sendMessage('executeCommand', {
                commandId,
                command,
                callbackCommand: `codepadi.commandResult.${commandId}`
            });
            if (!success) {
                disposable.dispose();
                reject(new Error('Failed to send command to server'));
            }
            // Set a timeout to prevent hanging
            setTimeout(() => {
                disposable.dispose();
                reject(new Error('Command execution timed out'));
            }, 30000); // 30 seconds timeout
        });
    }
    /**
     * Display command result in an output channel
     */
    showCommandResult(outputChannel, result) {
        if (typeof result === 'object') {
            outputChannel.appendLine(JSON.stringify(result, null, 2));
        }
        else {
            outputChannel.appendLine(String(result));
        }
        outputChannel.appendLine('\n');
    }
    /**
     * Get server config from client
     * This is a workaround for accessing the private serverConfig property
     */
    getServerConfig(client) {
        // We can use a trick to get the server config from the client
        // by using the client's toString method or other public methods
        // Option 1: Use a public getter if available
        if (typeof client.getServerConfig === 'function') {
            return client.getServerConfig();
        }
        // Option 2: Extract from the logger namespace
        const loggerNamespace = client.logger?.namespace;
        if (loggerNamespace) {
            const parts = loggerNamespace.split(':');
            if (parts.length > 1) {
                const serverId = parts[1];
                // Get server config from VS Code configuration
                const config = vscode.workspace.getConfiguration('codepadi');
                const servers = config.get('servers', []);
                return servers.find((s) => s.id === serverId) || { name: serverId };
            }
        }
        // Fallback
        return { name: 'Unknown Server' };
    }
}
exports.PromptService = PromptService;
//# sourceMappingURL=promptService.js.map