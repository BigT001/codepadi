const axios = require('axios');
const { Logger } = require('../utils/logger');

class HTTPClient {
    constructor(serverConfig) {
        this.serverConfig = serverConfig;
        this.logger = new Logger(`HTTP-Client:${serverConfig.id}`);
        this.client = axios.create({
            baseURL: serverConfig.url,
            timeout: 10000,
            headers: serverConfig.authToken ? {
                'Authorization': `Bearer ${serverConfig.authToken}`
            } : {}
        });
    }
    
    async executeCommand(command) {
        try {
            const response = await this.client.post('/execute', { command });
            return {
                success: true,
                result: response.data
            };
        } catch (error) {
            this.logger.error(`Command execution failed: ${error.message}`);
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    async getStatus() {
        try {
            const response = await this.client.get('/status');
            return response.data;
        } catch (error) {
            this.logger.error(`Failed to get status: ${error.message}`);
            return { error: error.message };
        }
    }
}

module.exports = { HTTPClient };
