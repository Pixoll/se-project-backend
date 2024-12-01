import cors from "cors";
import detectPort from "detect-port";
import { config as dotenvConfig } from "dotenv";
import express, { Router } from "express";
import qs from "qs";
import { connectDB } from "./db";
import { Endpoint, Method, methodDecoratorNames, v1Endpoints } from "./endpoints";
import logger from "./logger";
import loadSwaggerV1Docs from "./swagger";
import { loadTokens } from "./tokens";

dotenvConfig();

const app = express();
const router = Router();
const PORT = +(process.env.PORT ?? 0) || 3000;

const v1Path = "/api/v1";

app.set("query parser", (str: string) => {
    return qs.parse(str, {
        comma: true,
        allowEmptyArrays: true,
        duplicates: "combine",
    });
});

app.use(cors());
app.use(express.json());

void async function (): Promise<void> {
    connectDB();
    await loadTokens();

    const freePort = await detectPort(PORT);

    if (freePort !== PORT) {
        logger.warn(`Port ${PORT} is currently in use, using ${freePort} instead...`);
    }

    app.listen(freePort, () => {
        logger.log("API listening on port:", freePort);
    });

    loadSwaggerV1Docs(router, v1Path);

    for (const v of Object.values(v1Endpoints)) {
        if (!v || typeof v !== "function" || !(v.prototype instanceof Endpoint) || v.length !== 0) {
            continue;
        }

        const EndpointClass = v as new () => Endpoint;
        const endpoint = new EndpointClass();

        applyEndpointMethods(EndpointClass, endpoint);
    }

    app.use(v1Path, router);
}();

function applyEndpointMethods(EndpointClass: new () => Endpoint, endpoint: Endpoint): void {
    for (const key of Object.getOwnPropertyNames(EndpointClass.prototype)) {
        const member = EndpointClass.prototype[key];

        if (typeof member !== "function" || member.prototype instanceof Endpoint) {
            continue;
        }

        for (const decoratorName of methodDecoratorNames) {
            if (decoratorName in member) {
                const path = endpoint.path + member[decoratorName].path;
                const method = member[decoratorName].method.toLowerCase() as Lowercase<Method>;
                router[method](path, member.bind(endpoint));

                logger.log(`Registered ${method.toUpperCase()} ${path}`);

                break;
            }
        }
    }
}
