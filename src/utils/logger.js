const fs = require('fs');
const path = require('path');

let logStream = null;
let currentLogFilePath = null;

function stringifyArgument(arg) {
    if (arg instanceof Error) {
        return `${arg.message}\n${arg.stack}`;
    }
    if (typeof arg === 'object') {
        try {
            return JSON.stringify(arg, null, 2);
        } catch (error) {
            return String(arg);
        }
    }
    return String(arg);
}

function formatLine(level, args) {
    const timestamp = new Date().toISOString().replace('T', ' ').replace('Z', '');
    const message = args.map(stringifyArgument).join(' ');
    return `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
}

function writeToFile(level, args) {
    if (!logStream) {
        return;
    }
    const line = formatLine(level, args);
    logStream.write(line);
}

function setupLogging(options = {}) {
    if (logStream) {
        return currentLogFilePath;
    }

    const logFilePath = options.logFilePath
        ? path.resolve(options.logFilePath)
        : path.resolve(process.cwd(), 'logs', 'activity.log');

    fs.mkdirSync(path.dirname(logFilePath), { recursive: true });
    logStream = fs.createWriteStream(logFilePath, { flags: 'a', encoding: 'utf8' });
    currentLogFilePath = logFilePath;

    const originalConsole = {
        log: console.log,
        info: console.info,
        warn: console.warn,
        error: console.error
    };

    ['log', 'info', 'warn', 'error'].forEach((level) => {
        console[level] = (...args) => {
            writeToFile(level, args);
            originalConsole[level](...args);
        };
    });

    process.on('exit', () => {
        if (logStream) {
            logStream.end();
        }
    });

    console.log(`📝 Логирование включено. Файл: ${logFilePath}`);
    return logFilePath;
}

function getLogFilePath() {
    return currentLogFilePath;
}

module.exports = {
    setupLogging,
    getLogFilePath
};

