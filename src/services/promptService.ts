import * as vscode from 'vscode';
import { MCPClient } from '../mcp/client';
import { Logger } from '../utils/logger';

export class PromptService {
    private logger: Logger;
    private outputChannels: Map<string, vscode.OutputChannel> = new Map();
    private commandHistory: string[] = [];
    
    constructor() {
        this.logger = new Logger('PromptService');
    }
    
    /**
     * Show an input prompt to the user and send the command to the server
     */
    public async showCommandPrompt(client: MCPClient): Promise<void> {
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
                } catch (error: any) {
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
    private async executeCommand(client: MCPClient, command: string): Promise<any> {
        return new Promise((resolve, reject) => {
            // Create a unique ID for this command
            const commandId = Date.now().toString();
            
            // Create a one-time event listener for the command result
            const disposable = vscode.commands.registerCommand(`codepadi.commandResult.${commandId}`, (result) => {
                disposable.dispose(); // Clean up the command
                
                if (result.success) {
                    resolve(result.result);
                } else {
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
    private showCommandResult(outputChannel: vscode.OutputChannel, result: any): void {
        if (typeof result === 'object') {
            outputChannel.appendLine(JSON.stringify(result, null, 2));
        } else {
            outputChannel.appendLine(String(result));
        }
        
        outputChannel.appendLine('\n');
    }
    
    /**
     * Get server config from client
     * This is a workaround for accessing the private serverConfig property
     */
    private getServerConfig(client: MCPClient): any {
        // We can use a trick to get the server config from the client
        // by using the client's toString method or other public methods
        
        // Option 1: Use a public getter if available
        if (typeof (client as any).getServerConfig === 'function') {
            return (client as any).getServerConfig();
        }
        
        // Option 2: Extract from the logger namespace
        const loggerNamespace = (client as any).logger?.namespace;
        if (loggerNamespace) {
            const parts = loggerNamespace.split(':');
            if (parts.length > 1) {
                const serverId = parts[1];
                // Get server config from VS Code configuration
                const config = vscode.workspace.getConfiguration('codepadi');
                const servers = config.get('servers', []);
                return servers.find((s: any) => s.id === serverId) || { name: serverId };
            }
        }
        
        // Fallback
        return { name: 'Unknown Server' };
    }
}
