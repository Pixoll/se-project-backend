"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = {
    log(...messages) {
        console.log(prefix("INFO"), ...messages);
    },
    warn(...messages) {
        console.warn(prefix("WARN"), ...messages);
    },
    error(...messages) {
        console.error(prefix("ERROR"), ...messages);
    },
};
function prefix(logType) {
    const now = new Date().toISOString().replace(/T|Z$/g, " ").trim();
    return `[${now}] [API] [${logType}]`;
}
//# sourceMappingURL=logger.js.map