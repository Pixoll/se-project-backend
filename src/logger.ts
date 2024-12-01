enum LogType {
    INFO = "INFO",
    WARN = "WARN",
    ERROR = "ERROR",
}

const logColors = {
    [LogType.INFO]: "",
    [LogType.WARN]: "\x1b[33m",
    [LogType.ERROR]: "\x1b[31m",
} as const satisfies Record<LogType, string>;

// noinspection JSUnusedGlobalSymbols
export default {
    log(...messages: unknown[]): void {
        console.log(prefix(LogType.INFO), ...messages, "\x1b[0m");
    },
    warn(...messages: unknown[]): void {
        console.warn(prefix(LogType.WARN), ...messages, "\x1b[0m");
    },
    error(...messages: unknown[]): void {
        console.error(prefix(LogType.ERROR), ...messages, "\x1b[0m");
    },
};

function prefix(logType: LogType): string {
    const now = new Date().toISOString().replace(/T|Z$/g, " ").trim();
    return `${logColors[logType]}[${now}] [API] [${logType}]`;
}
