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
exports.ServerTreeItem = exports.ServerTreeProvider = void 0;
const vscode = __importStar(require("vscode"));
class ServerTreeProvider {
    constructor(serverManager) {
        this.serverManager = serverManager;
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }
    refresh() {
        this._onDidChangeTreeData.fire();
    }
    getTreeItem(element) {
        return element;
    }
    async getChildren(element) {
        if (element) {
            // If we have a parent element, we could show child items here
            return [];
        }
        else {
            // Root level - show all servers
            const servers = this.serverManager.getAllServers();
            return servers.map(server => {
                const client = this.serverManager.getClient(server.id);
                const isConnected = client?.isConnected() || false;
                return new ServerTreeItem(server, isConnected ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.Collapsed, isConnected);
            });
        }
    }
}
exports.ServerTreeProvider = ServerTreeProvider;
class ServerTreeItem extends vscode.TreeItem {
    constructor(server, collapsibleState, connected) {
        super(server.name, collapsibleState);
        this.server = server;
        this.collapsibleState = collapsibleState;
        this.connected = connected;
        this.tooltip = `${server.url} (${server.protocol})`;
        this.description = connected ? 'Connected' : 'Disconnected';
        this.iconPath = new vscode.ThemeIcon(connected ? 'plug' : 'debug-disconnect', connected ? new vscode.ThemeColor('terminal.ansiGreen') : new vscode.ThemeColor('terminal.ansiRed'));
        this.contextValue = connected ? 'connectedServer' : 'disconnectedServer';
    }
}
exports.ServerTreeItem = ServerTreeItem;
//# sourceMappingURL=serverTreeProvider.js.map