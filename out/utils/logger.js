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
exports.Logger = void 0;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class Logger {
    constructor(namespace) {
        this.namespace = namespace;
        if (!Logger.outputChannel) {
            Logger.outputChannel = vscode.window.createOutputChannel('Codepadi');
        }
        if (!Logger.logFile) {
            Logger.logFile = this.initializeLogFile();
        }
    }
    initializeLogFile() {
        try {
            const homeDir = process.env.HOME || process.env.USERPROFILE;
            const logDir = path.join(homeDir, '.codepadi', 'logs');
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
            const logFile = path.join(logDir, 'codepadi.log');
            return logFile;
        }
        catch (error) {
            console.error(`Failed to initialize log file: ${error.message}`);
            return '';
        }
    }
    getLogLevel() {
        const config = vscode.workspace.getConfiguration('codepadi');
        return config.get('logLevel', 'info');
    }
    shouldLog(level) {
        const configLevel = this.getLogLevel();
        const levels = ['error', 'warn', 'info', 'debug'];
        const configIndex = levels.indexOf(configLevel);
        const messageIndex = levels.indexOf(level);
        return messageIndex <= configIndex;
    }
    writeToLogFile(level, message) {
        if (!Logger.logFile) {
            return;
        }
        try {
            const timestamp = new Date().toISOString();
            const logEntry = `${timestamp} [${level.toUpperCase()}] [${this.namespace}] ${message}\n`;
            fs.appendFileSync(Logger.logFile, logEntry);
        }
        catch (error) {
            console.error(`Failed to write to log file: ${error.message}`);
        }
    }
    debug(message) {
        if (!this.shouldLog('debug')) {
            return;
        }
        const formattedMessage = `[${this.namespace}] ${message}`;
        Logger.outputChannel.appendLine(`[DEBUG] ${formattedMessage}`);
        this.writeToLogFile('debug', message);
    }
    info(message) {
        if (!this.shouldLog('info')) {
            return;
        }
        const formattedMessage = `[${this.namespace}] ${message}`;
        Logger.outputChannel.appendLine(`[INFO] ${formattedMessage}`);
        this.writeToLogFile('info', message);
    }
    warn(message) {
        if (!this.shouldLog('warn')) {
            return;
        }
        const formattedMessage = `[${this.namespace}] ${message}`;
        Logger.outputChannel.appendLine(`[WARN] ${formattedMessage}`);
        this.writeToLogFile('warn', message);
    }
    error(message) {
        if (!this.shouldLog('error')) {
            return;
        }
        const formattedMessage = `[${this.namespace}] ${message}`;
        Logger.outputChannel.appendLine(`[ERROR] ${formattedMessage}`);
        this.writeToLogFile('error', message);
    }
    static show() {
        Logger.outputChannel.show();
    }
}
exports.Logger = Logger;
//# sourceMappingURL=logger.js.map