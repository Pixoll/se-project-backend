// noinspection JSUnusedGlobalSymbols
export default {
    log(...messages: unknown[]): void {
        console.log(prefix("INFO"), ...messages);
    },
    warn(...messages: unknown[]): void {
        console.warn(prefix("WARN"), ...messages);
    },
    error(...messages: unknown[]): void {
        console.error(prefix("ERROR"), ...messages);
    },
};

function prefix(logType: "INFO" | "WARN" | "ERROR"): string {
    const now = new Date().toISOString().replace(/T|Z$/g, " ").trim();
    return `[${now}] [API] [${logType}]`;
}
