import { Router } from "express";
import { readFileSync } from "fs";
import path from "path";
import swaggerUi from "swagger-ui-express";
import logger from "./logger";

export default function loadSwaggerV1Docs(router: Router, v1Path: string): void {
    const swaggerSpecs = JSON.parse(readFileSync(path.join(__dirname, "../docs.json"), "utf-8"));

    router.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpecs));

    logger.log(`API v1 documentation available at ${v1Path}/docs.`);
}
