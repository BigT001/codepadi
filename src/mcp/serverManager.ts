import * as vscode from 'vscode';
import { MCPClient, MCPServerConfig } from './client';
import { Logger } from '../utils/logger';


export class ServerManager {
    private clients: Map<string, MCPClient> = new Map();
    private logger: Logger;
    
    constructor(private readonly context: vscode.ExtensionContext) {
        this.logger = new Logger('ServerManager');
        this.loadSavedServers();
    }
    
    private loadSavedServers(): void {
        const config = vscode.workspace.getConfiguration('codepadi');
        const servers = config.get<MCPServerConfig[]>('servers', []);
        
        servers.forEach(server => {
            this.addServer(server, false);
        });
        
        this.logger.info(`Loaded ${servers.length} saved servers`);
    }
    
    public async addServer(serverConfig: MCPServerConfig, save: boolean = true): Promise<boolean> {
        if (this.clients.has(serverConfig.id)) {
            this.logger.warn(`Server with ID ${serverConfig.id} already exists`);
            return false;
        }
        
        const client = new MCPClient(serverConfig, this.context);
        this.clients.set(serverConfig.id, client);
        
        // Save server config to extension storage
        this.context.globalState.update(`server.${serverConfig.id}`, serverConfig);
        
        if (save) {
            await this.saveServers();
        }
        
        this.logger.info(`Added server: ${serverConfig.name} (${serverConfig.id})`);
        return true;
    }
    
    public async removeServer(serverId: string): Promise<boolean> {
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
    
    private async saveServers(): Promise<void> {
        const servers: MCPServerConfig[] = [];
        
        this.clients.forEach((client, id) => {
            const serverConfig = this.context.globalState.get<MCPServerConfig>(`server.${id}`);
            if (serverConfig) {
                servers.push(serverConfig);
            }
        });
        
        const config = vscode.workspace.getConfiguration('codepadi');
        await config.update('servers', servers, vscode.ConfigurationTarget.Global);
        
        this.logger.info(`Saved ${servers.length} servers to configuration`);
    }
    
    public async connectToServer(serverId: string): Promise<boolean> {
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
        } else {
            this.logger.error(`Failed to connect to server ${serverId}`);
        }
        
        return success;
    }
    
    public disconnectFromServer(serverId: string): boolean {
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
    
    public getClient(serverId: string): MCPClient | undefined {
        return this.clients.get(serverId);
    }
    
    public getAllServers(): MCPServerConfig[] {
        const servers: MCPServerConfig[] = [];
        
        this.clients.forEach((_, id) => {
            const serverConfig = this.context.globalState.get<MCPServerConfig>(`server.${id}`);
            if (serverConfig) {
                servers.push(serverConfig);
            }
        });
        
        return servers;
    }
    
    public getConnectedServers(): MCPServerConfig[] {
        const servers: MCPServerConfig[] = [];
        
        this.clients.forEach((client, id) => {
            if (client.isConnected()) {
                const serverConfig = this.context.globalState.get<MCPServerConfig>(`server.${id}`);
                if (serverConfig) {
                    servers.push(serverConfig);
                }
            }
        });
        
        return servers;
    }
}
