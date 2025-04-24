import WebSocket from 'ws';
import axios from 'axios';
import * as vscode from 'vscode';
import { Logger } from '../utils/logger';

export interface MCPServerConfig {
    id: string;
    name: string;
    url: string;
    authToken?: string;
    protocol: 'ws' | 'http' | 'grpc';
}

export interface MCPMessage {
    type: string;
    payload: any;
    timestamp: number;
}

export class MCPClient {
    private ws: WebSocket | null = null;
    private connected: boolean = false;
    private reconnectAttempts: number = 0;
    private readonly MAX_RECONNECT_ATTEMPTS = 5;
    private readonly RECONNECT_INTERVAL = 3000; // 3 seconds
    private logger: Logger;
    
    constructor(
        private readonly serverConfig: MCPServerConfig,
        private readonly context: vscode.ExtensionContext
    ) {
        this.logger = new Logger(`MCP-Client:${serverConfig.id}`);
    }

    public async connect(): Promise<boolean> {
        try {
            if (this.serverConfig.protocol === 'ws') {
                return await this.connectWebSocket();
            } else if (this.serverConfig.protocol === 'http') {
                return await this.connectHTTP();
            } else {
                throw new Error(`Protocol ${this.serverConfig.protocol} not implemented yet`);
            }
        } catch (error: any) {
            this.logger.error(`Connection failed: ${error.message}`);
            return false;
        }
    }

    private async connectWebSocket(): Promise<boolean> {
        return new Promise((resolve, reject) => {
            try {
                const options: WebSocket.ClientOptions = {};
                
                if (this.serverConfig.authToken) {
                    options.headers = {
                        'Authorization': `Bearer ${this.serverConfig.authToken}`
                    };
                }
                
                this.ws = new WebSocket(this.serverConfig.url, options);
                
                this.ws.on('open', () => {
                    this.connected = true;
                    this.reconnectAttempts = 0;
                    this.logger.info(`Connected to ${this.serverConfig.name}`);
                    vscode.window.showInformationMessage(`Connected to MCP server: ${this.serverConfig.name}`);
                    resolve(true);
                });
                
                this.ws.on('message', (data: WebSocket.Data) => {
                    this.handleMessage(data);
                });
                
                this.ws.on('error', (error: Error) => {
                    this.logger.error(`WebSocket error: ${error.message}`);
                    if (!this.connected) {
                        reject(error);
                    }
                });
                
                this.ws.on('close', (code: number, reason: string) => {
                    this.connected = false;
                    this.logger.warn(`Connection closed: ${code} - ${reason}`);
                    this.attemptReconnect();
                });
                
            } catch (error: any) {
                this.logger.error(`Failed to create WebSocket: ${error.message}`);
                reject(error);
            }
        });
    }


    private async connectHTTP(): Promise<boolean> {
        try {
            const headers: Record<string, string> = {};
            
            if (this.serverConfig.authToken) {
                headers['Authorization'] = `Bearer ${this.serverConfig.authToken}`;
            }
            
            const response = await axios.post(
                `${this.serverConfig.url}/connect`,
                { clientId: `vscode-mcp-agent-${vscode.env.machineId}` },
                { headers }
            );
            
            if (response.status === 200) {
                this.connected = true;
                this.logger.info(`Connected to ${this.serverConfig.name} via HTTP`);
                vscode.window.showInformationMessage(`Connected to MCP server: ${this.serverConfig.name}`);
                return true;
            }
            
            return false;
        } catch (error: any) {
            this.logger.error(`HTTP connection failed: ${error.message}`);
            return false;
        }
    }

    public disconnect(): void {
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

    public isConnected(): boolean {
        return this.connected;
    }

    private attemptReconnect(): void {
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

    private handleMessage(data: WebSocket.Data): void {
        try {
            const message = JSON.parse(data.toString()) as MCPMessage;
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
        } catch (error: any) {
            this.logger.error(`Failed to parse message: ${error.message}`);
        }
    }

    public sendMessage(type: string, payload: any): boolean {
        if (!this.connected || !this.ws) {
            this.logger.warn('Cannot send message: not connected');
            return false;
        }
        
        try {
            const message: MCPMessage = {
                type,
                payload,
                timestamp: Date.now()
            };
            
            this.ws.send(JSON.stringify(message));
            this.logger.debug(`Sent message: ${type}`);
            return true;
        } catch (error: any) {
            this.logger.error(`Failed to send message: ${error.message}`);
            return false;
        }
    }

    private async handleRemoteCommand(payload: any): Promise<void> {
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
        } catch (error: any) {
            this.logger.error(`Failed to execute command: ${error.message}`);
            this.sendMessage('commandResult', {
                commandId: payload.commandId,
                success: false,
                error: error.message
            });
        }
    }

    private async handleFileRequest(payload: any): Promise<void> {
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
        } catch (error: any) {
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
