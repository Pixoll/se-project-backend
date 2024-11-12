import { Router } from "express";
import { readFileSync } from "fs";
import path from "path";
import swaggerUi from "swagger-ui-express";
import yaml from "yaml";
import logger from "./logger";

export default function loadSwaggerV1Docs(router: Router, v1Path: string): void {
    const swaggerSpecs = yaml.parse(readFileSync(path.join(__dirname, "../docs.yaml"), "utf-8"));

    router.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpecs));

    logger.log(`API v1 documentation available at ${v1Path}/docs.`);
}
