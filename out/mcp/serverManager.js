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
exports.ServerManager = void 0;
const vscode = __importStar(require("vscode"));
const client_1 = require("./client");
const logger_1 = require("../utils/logger");
class ServerManager {
    constructor(context) {
        this.context = context;
        this.clients = new Map();
        this.logger = new logger_1.Logger('ServerManager');
        this.loadSavedServers();
    }
    loadSavedServers() {
        const config = vscode.workspace.getConfiguration('codepadi');
        const servers = config.get('servers', []);
        servers.forEach(server => {
            this.addServer(server, false);
        });
        this.logger.info(`Loaded ${servers.length} saved servers`);
    }
    async addServer(serverConfig, save = true) {
        if (this.clients.has(serverConfig.id)) {
            this.logger.warn(`Server with ID ${serverConfig.id} already exists`);
            return false;
        }
        const client = new client_1.MCPClient(serverConfig, this.context);
        this.clients.set(serverConfig.id, client);
        // Save server config to extension storage
        this.context.globalState.update(`server.${serverConfig.id}`, serverConfig);
        if (save) {
            await this.saveServers();
        }
        this.logger.info(`Added server: ${serverConfig.name} (${serverConfig.id})`);
        return true;
    }
    async removeServer(serverId) {
        const client = this.clients.get(serverId);
        if (!client) {
            this.logger.warn(`Server with ID ${serverId} not found`);
            return false;
        }
        if (client.isConnected()) {
            client.disconnect();
        }
        this.clients.delete(serverId);
        // Remove from extension storage
        this.context.globalState.update(`server.${serverId}`, undefined);
        await this.saveServers();
        this.logger.info(`Removed server with ID ${serverId}`);
        return true;
    }
    async saveServers() {
        const servers = [];
        this.clients.forEach((client, id) => {
            const serverConfig = this.context.globalState.get(`server.${id}`);
            if (serverConfig) {
                servers.push(serverConfig);
            }
        });
        const config = vscode.workspace.getConfiguration('codepadi');
        await config.update('servers', servers, vscode.ConfigurationTarget.Global);
        this.logger.info(`Saved ${servers.length} servers to configuration`);
    }
    async connectToServer(serverId) {
        const client = this.clients.get(serverId);
        if (!client) {
            this.logger.warn(`Server with ID ${serverId} not found`);
            return false;
        }
        if (client.isConnected()) {
            this.logger.info(`Already connected to server ${serverId}`);
            return true;
        }
        const success = await client.connect();
        if (success) {
            this.logger.info(`Successfully connected to server ${serverId}`);
        }
        else {
            this.logger.error(`Failed to connect to server ${serverId}`);
        }
        return success;
    }
    disconnectFromServer(serverId) {
        const client = this.clients.get(serverId);
        if (!client) {
            this.logger.warn(`Server with ID ${serverId} not found`);
            return false;
        }
        if (!client.isConnected()) {
            this.logger.info(`Not connected to server ${serverId}`);
            return true;
        }
        client.disconnect();
        this.logger.info(`Disconnected from server ${serverId}`);
        return true;
    }
    getClient(serverId) {
        return this.clients.get(serverId);
    }
    getAllServers() {
        const servers = [];
        this.clients.forEach((_, id) => {
            const serverConfig = this.context.globalState.get(`server.${id}`);
            if (serverConfig) {
                servers.push(serverConfig);
            }
        });
        return servers;
    }
    getConnectedServers() {
        const servers = [];
        this.clients.forEach((client, id) => {
            if (client.isConnected()) {
                const serverConfig = this.context.globalState.get(`server.${id}`);
                if (serverConfig) {
                    servers.push(serverConfig);
                }
            }
        });
        return servers;
    }
}
exports.ServerManager = ServerManager;
//# sourceMappingURL=serverManager.js.map