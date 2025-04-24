import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class Logger {
    private static outputChannel: vscode.OutputChannel;
    private static logFile: string;
    private readonly namespace: string;

    constructor(namespace: string) {
        this.namespace = namespace;
        
        if (!Logger.outputChannel) {
            Logger.outputChannel = vscode.window.createOutputChannel('Codepadi');
        }
        
        if (!Logger.logFile) {
            Logger.logFile = this.initializeLogFile();
        }
    }

    private initializeLogFile(): string {
        try {
            const homeDir = process.env.HOME || process.env.USERPROFILE;
            const logDir = path.join(homeDir as string, '.codepadi', 'logs');
            
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
            
            const logFile = path.join(logDir, 'codepadi.log');
            return logFile;
        } catch (error: any) {
            console.error(`Failed to initialize log file: ${error.message}`);
            return '';
        }
    }

    private getLogLevel(): string {
        const config = vscode.workspace.getConfiguration('codepadi');
        return config.get('logLevel', 'info');
    }

    private shouldLog(level: string): boolean {
        const configLevel = this.getLogLevel();
        const levels = ['error', 'warn', 'info', 'debug'];
        
        const configIndex = levels.indexOf(configLevel);
        const messageIndex = levels.indexOf(level);
        
        return messageIndex <= configIndex;
    }

    private writeToLogFile(level: string, message: string): void {
        if (!Logger.logFile) {
            return;
        }
        
        try {
            const timestamp = new Date().toISOString();
            const logEntry = `${timestamp} [${level.toUpperCase()}] [${this.namespace}] ${message}\n`;
            
            fs.appendFileSync(Logger.logFile, logEntry);
        } catch (error: any) {
            console.error(`Failed to write to log file: ${error.message}`);
        }
    }

    public debug(message: string): void {
        if (!this.shouldLog('debug')) {
            return;
        }
        
        const formattedMessage = `[${this.namespace}] ${message}`;
        Logger.outputChannel.appendLine(`[DEBUG] ${formattedMessage}`);
        this.writeToLogFile('debug', message);
    }

    public info(message: string): void {
        if (!this.shouldLog('info')) {
            return;
        }
        
        const formattedMessage = `[${this.namespace}] ${message}`;
        Logger.outputChannel.appendLine(`[INFO] ${formattedMessage}`);
        this.writeToLogFile('info', message);
    }

    public warn(message: string): void {
        if (!this.shouldLog('warn')) {
            return;
        }
        
        const formattedMessage = `[${this.namespace}] ${message}`;
        Logger.outputChannel.appendLine(`[WARN] ${formattedMessage}`);
        this.writeToLogFile('warn', message);
    }

    public error(message: string): void {
        if (!this.shouldLog('error')) {
            return;
        }
        
        const formattedMessage = `[${this.namespace}] ${message}`;
        Logger.outputChannel.appendLine(`[ERROR] ${formattedMessage}`);
        this.writeToLogFile('error', message);
    }

    public static show(): void {
        Logger.outputChannel.show();
    }
}
