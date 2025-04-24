import * as vscode from 'vscode';
import { ServerManager } from '../mcp/serverManager';
import { MCPServerConfig } from '../mcp/client';

export class ServerTreeProvider implements vscode.TreeDataProvider<ServerTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ServerTreeItem | undefined | null | void> = new vscode.EventEmitter<ServerTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<ServerTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor(private readonly serverManager: ServerManager) {}

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: ServerTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: ServerTreeItem): Promise<ServerTreeItem[]> {
        if (element) {
            // If we have a parent element, we could show child items here
            return [];
        } else {
            // Root level - show all servers
            const servers = this.serverManager.getAllServers();
            return servers.map(server => {
                const client = this.serverManager.getClient(server.id);
                const isConnected = client?.isConnected() || false;
                
                return new ServerTreeItem(
                    server,
                    isConnected ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed,
                    isConnected
                );
            });
        }
    }
}

export class ServerTreeItem extends vscode.TreeItem {
    constructor(
        public readonly server: MCPServerConfig,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        private readonly connected: boolean
    ) {
        super(server.name, collapsibleState);
        
        this.tooltip = `${server.url} (${server.protocol})`;
        this.description = connected ? 'Connected' : 'Disconnected';
        
        this.iconPath = new vscode.ThemeIcon(
            connected ? 'plug' : 'debug-disconnect',
            connected ? new vscode.ThemeColor('terminal.ansiGreen') : new vscode.ThemeColor('terminal.ansiRed')
        );
        
        this.contextValue = connected ? 'connectedServer' : 'disconnectedServer';
    }
}
