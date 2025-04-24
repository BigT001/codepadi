const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const { Logger } = require('../utils/logger');

class GRPCClient {
    constructor(serverConfig, context) {
        this.serverConfig = serverConfig;
        this.context = context;
        this.logger = new Logger(`GRPC-Client:${serverConfig.id}`);
        this.client = null;
    }
    
    async connect() {
        try {
            // Load proto file
            const protoPath = path.join(this.context.extensionPath, 'proto', 'mcp.proto');
            const packageDefinition = protoLoader.loadSync(protoPath, {
                keepCase: true,
                longs: String,
                enums: String,
                defaults: true,
                oneofs: true
            });
            
            const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
            const mcpService = protoDescriptor.mcp.MCPService;
            
            // Create client
            this.client = new mcpService(
                this.serverConfig.url,
                this.serverConfig.authToken ? 
                    grpc.credentials.createSsl() : 
                    grpc.credentials.createInsecure()
            );
            
            // Test connection
            return new Promise((resolve) => {
                this.client.ping({}, (error) => {
                    if (error) {
                        this.logger.error(`gRPC connection failed: ${error.message}`);
                        resolve(false);
                    } else {
                        this.logger.info('gRPC connection established');
                        resolve(true);
                    }
                });
            });
        } catch (error) {
            this.logger.error(`gRPC connection failed: ${error.message}`);
            return false;
        }
    }
    
    async executeCommand(command) {
        if (!this.client) {
            return { success: false, error: 'Not connected' };
        }
        
        return new Promise((resolve) => {
            this.client.executeCommand({ command }, (error, response) => {
                if (error) {
                    this.logger.error(`Command execution failed: ${error.message}`);
                    resolve({ success: false, error: error.message });
                } else {
                    resolve({ success: true, result: response });
                }
            });
        });
    }
}

module.exports = { GRPCClient };
