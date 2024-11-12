"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = loadSwaggerV1Docs;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const yaml_1 = __importDefault(require("yaml"));
const logger_1 = __importDefault(require("./logger"));
function loadSwaggerV1Docs(router, v1Path) {
    const swaggerSpecs = yaml_1.default.parse((0, fs_1.readFileSync)(path_1.default.join(__dirname, "../docs.yaml"), "utf-8"));
    router.use("/docs", swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swaggerSpecs));
    logger_1.default.log(`API v1 documentation available at ${v1Path}/docs.`);
}
//# sourceMappingURL=swagger.js.map