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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCPClient = void 0;
const ws_1 = __importDefault(require("ws"));
const axios_1 = __importDefault(require("axios"));
const vscode = __importStar(require("vscode"));
const logger_1 = require("../utils/logger");
class MCPClient {
    constructor(serverConfig, context) {
        this.serverConfig = serverConfig;
        this.context = context;
        this.ws = null;
        this.connected = false;
        this.reconnectAttempts = 0;
        this.MAX_RECONNECT_ATTEMPTS = 5;
        this.RECONNECT_INTERVAL = 3000; // 3 seconds
        this.logger = new logger_1.Logger(`MCP-Client:${serverConfig.id}`);
    }
    async connect() {
        try {
            if (this.serverConfig.protocol === 'ws') {
                return await this.connectWebSocket();
            }
            else if (this.serverConfig.protocol === 'http') {
                return await this.connectHTTP();
            }
            else {
                throw new Error(`Protocol ${this.serverConfig.protocol} not implemented yet`);
            }
        }
        catch (error) {
            this.logger.error(`Connection failed: ${error.message}`);
            return false;
        }
    }
    async connectWebSocket() {
        return new Promise((resolve, reject) => {
            try {
                const options = {};
                if (this.serverConfig.authToken) {
                    options.headers = {
                        'Authorization': `Bearer ${this.serverConfig.authToken}`
                    };
                }
                this.ws = new ws_1.default(this.serverConfig.url, options);
                this.ws.on('open', () => {
                    this.connected = true;
                    this.reconnectAttempts = 0;
                    this.logger.info(`Connected to ${this.serverConfig.name}`);
                    vscode.window.showInformationMessage(`Connected to MCP server: ${this.serverConfig.name}`);
                    resolve(true);
                });
                this.ws.on('message', (data) => {
                    this.handleMessage(data);
                });
                this.ws.on('error', (error) => {
                    this.logger.error(`WebSocket error: ${error.message}`);
                    if (!this.connected) {
                        reject(error);
                    }
                });
                this.ws.on('close', (code, reason) => {
                    this.connected = false;
                    this.logger.warn(`Connection closed: ${code} - ${reason}`);
                    this.attemptReconnect();
                });
            }
            catch (error) {
                this.logger.error(`Failed to create WebSocket: ${error.message}`);
                reject(error);
            }
        });
    }
    async connectHTTP() {
        try {
            const headers = {};
            if (this.serverConfig.authToken) {
                headers['Authorization'] = `Bearer ${this.serverConfig.authToken}`;
            }
            const response = await axios_1.default.post(`${this.serverConfig.url}/connect`, { clientId: `vscode-mcp-agent-${vscode.env.machineId}` }, { headers });
            if (response.status === 200) {
                this.connected = true;
                this.logger.info(`Connected to ${this.serverConfig.name} via HTTP`);
                vscode.window.showInformationMessage(`Connected to MCP server: ${this.serverConfig.name}`);
                return true;
            }
            return false;
        }
        catch (error) {
            this.logger.error(`HTTP connection failed: ${error.message}`);
            return false;
        }
    }
    disconnect() {
        if (!this.connected) {
            return;
        }
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this.connected = false;
        this.logger.info(`Disconnected from ${this.serverConfig.name}`);
    }
    isConnected() {
        return this.connected;
    }
    attemptReconnect() {
        if (this.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
            this.logger.error(`Max reconnection attempts (${this.MAX_RECONNECT_ATTEMPTS}) reached`);
            vscode.window.showErrorMessage(`Failed to reconnect to ${this.serverConfig.name} after ${this.MAX_RECONNECT_ATTEMPTS} attempts`);
            return;
        }
        this.reconnectAttempts++;
        this.logger.info(`Attempting to reconnect (${this.reconnectAttempts}/${this.MAX_RECONNECT_ATTEMPTS})...`);
        setTimeout(() => {
            this.connect().catch(error => {
                this.logger.error(`Reconnection attempt failed: ${error.message}`);
            });
        }, this.RECONNECT_INTERVAL);
    }
    handleMessage(data) {
        try {
            const message = JSON.parse(data.toString());
            this.logger.debug(`Received message: ${message.type}`);
            // Emit event for message handlers
            vscode.commands.executeCommand('codepadi.messageReceived', this.serverConfig.id, message);
            // Handle different message types
            switch (message.type) {
                case 'ping':
                    this.sendMessage('pong', {});
                    break;
                case 'executeCommand':
                    this.handleRemoteCommand(message.payload);
                    break;
                case 'requestFile':
                    this.handleFileRequest(message.payload);
                    break;
                default:
                    this.logger.debug(`Unhandled message type: ${message.type}`);
            }
        }
        catch (error) {
            this.logger.error(`Failed to parse message: ${error.message}`);
        }
    }
    sendMessage(type, payload) {
        if (!this.connected || !this.ws) {
            this.logger.warn('Cannot send message: not connected');
            return false;
        }
        try {
            const message = {
                type,
                payload,
                timestamp: Date.now()
            };
            this.ws.send(JSON.stringify(message));
            this.logger.debug(`Sent message: ${type}`);
            return true;
        }
        catch (error) {
            this.logger.error(`Failed to send message: ${error.message}`);
            return false;
        }
    }
    async handleRemoteCommand(payload) {
        try {
            const { command, args } = payload;
            this.logger.info(`Executing remote command: ${command}`);
            // Execute VS Code command
            const result = await vscode.commands.executeCommand(command, ...args);
            // Send back the result
            this.sendMessage('commandResult', {
                commandId: payload.commandId,
                success: true,
                result
            });
        }
        catch (error) {
            this.logger.error(`Failed to execute command: ${error.message}`);
            this.sendMessage('commandResult', {
                commandId: payload.commandId,
                success: false,
                error: error.message
            });
        }
    }
    async handleFileRequest(payload) {
        try {
            const { path, requestId } = payload;
            this.logger.info(`File requested: ${path}`);
            // Check if file exists and read it
            const uri = vscode.Uri.file(path);
            const document = await vscode.workspace.openTextDocument(uri);
            const content = document.getText();
            // Send back the file content
            this.sendMessage('fileContent', {
                requestId,
                path,
                content,
                success: true
            });
        }
        catch (error) {
            this.logger.error(`Failed to handle file request: ${error.message}`);
            this.sendMessage('fileContent', {
                requestId: payload.requestId,
                path: payload.path,
                success: false,
                error: error.message
            });
        }
    }
}
exports.MCPClient = MCPClient;
//# sourceMappingURL=client.js.map