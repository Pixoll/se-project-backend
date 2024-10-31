"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HTTPStatus = exports.Method = exports.methodDecoratorNames = exports.Endpoint = void 0;
exports.GetMethod = GetMethod;
exports.PostMethod = PostMethod;
exports.PutMethod = PutMethod;
exports.PatchMethod = PatchMethod;
exports.DeleteMethod = DeleteMethod;
exports.baseMiddleware = baseMiddleware;
const logger_1 = __importDefault(require("../logger"));
class Endpoint {
    path;
    constructor(path) {
        this.path = path;
    }
    sendOk(response, ...[data]) {
        response.status(HTTPStatus.OK).send(data);
    }
    sendError(response, status, message) {
        sendError(response, status, message);
    }
}
exports.Endpoint = Endpoint;
function GetMethod(path = "") {
    return makeMethodDecorator(GetMethod.name, path);
}
function PostMethod(path = "") {
    return makeMethodDecorator(PostMethod.name, path);
}
function PutMethod(path = "") {
    return makeMethodDecorator(PutMethod.name, path);
}
function PatchMethod(path = "") {
    return makeMethodDecorator(PatchMethod.name, path);
}
function DeleteMethod(path = "") {
    return makeMethodDecorator(DeleteMethod.name, path);
}
exports.methodDecoratorNames = [
    GetMethod.name,
    PostMethod.name,
    PutMethod.name,
    PatchMethod.name,
    DeleteMethod.name,
];
var Method;
(function (Method) {
    Method["GET"] = "GET";
    Method["POST"] = "POST";
    Method["PUT"] = "PUT";
    Method["PATCH"] = "PATCH";
    Method["DELETE"] = "DELETE";
})(Method || (exports.Method = Method = {}));
var HTTPStatus;
(function (HTTPStatus) {
    HTTPStatus[HTTPStatus["CONTINUE"] = 100] = "CONTINUE";
    HTTPStatus[HTTPStatus["SWITCHING_PROTOCOLS"] = 101] = "SWITCHING_PROTOCOLS";
    HTTPStatus[HTTPStatus["PROCESSING"] = 102] = "PROCESSING";
    HTTPStatus[HTTPStatus["EARLY_HINTS"] = 103] = "EARLY_HINTS";
    HTTPStatus[HTTPStatus["OK"] = 200] = "OK";
    HTTPStatus[HTTPStatus["CREATED"] = 201] = "CREATED";
    HTTPStatus[HTTPStatus["ACCEPTED"] = 202] = "ACCEPTED";
    HTTPStatus[HTTPStatus["NON_AUTHORITATIVE_INFORMATION"] = 203] = "NON_AUTHORITATIVE_INFORMATION";
    HTTPStatus[HTTPStatus["NO_CONTENT"] = 204] = "NO_CONTENT";
    HTTPStatus[HTTPStatus["RESET_CONTENT"] = 205] = "RESET_CONTENT";
    HTTPStatus[HTTPStatus["PARTIAL_CONTENT"] = 206] = "PARTIAL_CONTENT";
    HTTPStatus[HTTPStatus["MULTI_STATUS"] = 207] = "MULTI_STATUS";
    HTTPStatus[HTTPStatus["ALREADY_REPORTED"] = 208] = "ALREADY_REPORTED";
    HTTPStatus[HTTPStatus["IM_USED"] = 226] = "IM_USED";
    HTTPStatus[HTTPStatus["MULTIPLE_CHOICES"] = 300] = "MULTIPLE_CHOICES";
    HTTPStatus[HTTPStatus["MOVED_PERMANENTLY"] = 301] = "MOVED_PERMANENTLY";
    HTTPStatus[HTTPStatus["FOUND"] = 302] = "FOUND";
    HTTPStatus[HTTPStatus["SEE_OTHER"] = 303] = "SEE_OTHER";
    HTTPStatus[HTTPStatus["NOT_MODIFIED"] = 304] = "NOT_MODIFIED";
    HTTPStatus[HTTPStatus["USE_PROXY"] = 305] = "USE_PROXY";
    HTTPStatus[HTTPStatus["TEMPORARY_REDIRECT"] = 307] = "TEMPORARY_REDIRECT";
    HTTPStatus[HTTPStatus["PERMANENT_REDIRECT"] = 308] = "PERMANENT_REDIRECT";
    HTTPStatus[HTTPStatus["BAD_REQUEST"] = 400] = "BAD_REQUEST";
    HTTPStatus[HTTPStatus["UNAUTHORIZED"] = 401] = "UNAUTHORIZED";
    HTTPStatus[HTTPStatus["PAYMENT_REQUIRED"] = 402] = "PAYMENT_REQUIRED";
    HTTPStatus[HTTPStatus["FORBIDDEN"] = 403] = "FORBIDDEN";
    HTTPStatus[HTTPStatus["NOT_FOUND"] = 404] = "NOT_FOUND";
    HTTPStatus[HTTPStatus["METHOD_NOT_ALLOWED"] = 405] = "METHOD_NOT_ALLOWED";
    HTTPStatus[HTTPStatus["NOT_ACCEPTABLE"] = 406] = "NOT_ACCEPTABLE";
    HTTPStatus[HTTPStatus["PROXY_AUTHENTICATION_REQUIRED"] = 407] = "PROXY_AUTHENTICATION_REQUIRED";
    HTTPStatus[HTTPStatus["REQUEST_TIMEOUT"] = 408] = "REQUEST_TIMEOUT";
    HTTPStatus[HTTPStatus["CONFLICT"] = 409] = "CONFLICT";
    HTTPStatus[HTTPStatus["GONE"] = 410] = "GONE";
    HTTPStatus[HTTPStatus["LENGTH_REQUIRED"] = 411] = "LENGTH_REQUIRED";
    HTTPStatus[HTTPStatus["PRECONDITION_FAILED"] = 412] = "PRECONDITION_FAILED";
    HTTPStatus[HTTPStatus["CONTENT_TOO_LARGE"] = 413] = "CONTENT_TOO_LARGE";
    HTTPStatus[HTTPStatus["URI_TOO_LONG"] = 414] = "URI_TOO_LONG";
    HTTPStatus[HTTPStatus["UNSUPPORTED_MEDIA_TYPE"] = 415] = "UNSUPPORTED_MEDIA_TYPE";
    HTTPStatus[HTTPStatus["RANGE_NOT_SATISFIABLE"] = 416] = "RANGE_NOT_SATISFIABLE";
    HTTPStatus[HTTPStatus["EXPECTATION_FAILED"] = 417] = "EXPECTATION_FAILED";
    HTTPStatus[HTTPStatus["IM_A_TEAPOT"] = 418] = "IM_A_TEAPOT";
    HTTPStatus[HTTPStatus["ENHANCE_YOUR_CALM"] = 420] = "ENHANCE_YOUR_CALM";
    HTTPStatus[HTTPStatus["MISDIRECTED_REQUEST"] = 421] = "MISDIRECTED_REQUEST";
    HTTPStatus[HTTPStatus["UNPROCESSABLE_CONTENT"] = 422] = "UNPROCESSABLE_CONTENT";
    HTTPStatus[HTTPStatus["LOCKED"] = 423] = "LOCKED";
    HTTPStatus[HTTPStatus["FAILED_DEPENDENCY"] = 424] = "FAILED_DEPENDENCY";
    HTTPStatus[HTTPStatus["TOO_EARLY"] = 425] = "TOO_EARLY";
    HTTPStatus[HTTPStatus["UPGRADE_REQUIRED"] = 426] = "UPGRADE_REQUIRED";
    HTTPStatus[HTTPStatus["PRECONDITION_REQUIRED"] = 428] = "PRECONDITION_REQUIRED";
    HTTPStatus[HTTPStatus["TOO_MANY_REQUESTS"] = 429] = "TOO_MANY_REQUESTS";
    HTTPStatus[HTTPStatus["REQUEST_HEADER_FIELDS_TOO_LARGE"] = 431] = "REQUEST_HEADER_FIELDS_TOO_LARGE";
    HTTPStatus[HTTPStatus["UNAVAILABLE_FOR_LEGAL_REASONS"] = 451] = "UNAVAILABLE_FOR_LEGAL_REASONS";
    HTTPStatus[HTTPStatus["INTERNAL_SERVER_ERROR"] = 500] = "INTERNAL_SERVER_ERROR";
    HTTPStatus[HTTPStatus["NOT_IMPLEMENTED"] = 501] = "NOT_IMPLEMENTED";
    HTTPStatus[HTTPStatus["BAD_GATEWAY"] = 502] = "BAD_GATEWAY";
    HTTPStatus[HTTPStatus["SERVICE_UNAVAILABLE"] = 503] = "SERVICE_UNAVAILABLE";
    HTTPStatus[HTTPStatus["GATEWAY_TIMEOUT"] = 504] = "GATEWAY_TIMEOUT";
    HTTPStatus[HTTPStatus["HTTP_VERSION_NOT_SUPPORTED"] = 505] = "HTTP_VERSION_NOT_SUPPORTED";
    HTTPStatus[HTTPStatus["INSUFFICIENT_STORAGE"] = 507] = "INSUFFICIENT_STORAGE";
    HTTPStatus[HTTPStatus["LOOP_DETECTED"] = 508] = "LOOP_DETECTED";
    HTTPStatus[HTTPStatus["NETWORK_AUTHENTICATION_REQUIRED"] = 511] = "NETWORK_AUTHENTICATION_REQUIRED";
})(HTTPStatus || (exports.HTTPStatus = HTTPStatus = {}));
function baseMiddleware(request, response, next) {
    const method = request.method;
    logger_1.default.log(`${method} ${request.path}:`, {
        ...Object.keys(request.query).length > 0 && { query: request.query },
        ...request.body && Object.keys(request.body).length > 0 && { body: request.body },
    });
    if (method === Method.POST && request.headers["content-type"] !== "application/json") {
        sendError(response, HTTPStatus.BAD_REQUEST, "Content-Type header must be 'application/json'.");
        return;
    }
    next();
}
function sendError(response, status, message) {
    response.status(status).send({
        status,
        message,
    });
}
class DecoratorContextError extends Error {
    target;
    propertyKey;
    descriptor;
    constructor(message, decoratorName, target, propertyKey, descriptor) {
        super(`${decoratorName} decorator used in the wrong context. ${message}`);
        this.target = target;
        this.propertyKey = propertyKey;
        this.descriptor = descriptor;
    }
}
function makeMethodDecorator(name, path) {
    return function (target, propertyKey, descriptor) {
        const decoratorErrorArgs = [name, target, propertyKey, descriptor];
        if (typeof descriptor.value !== "function") {
            throw new DecoratorContextError("Attached element must be a function.", ...decoratorErrorArgs);
        }
        if (!(target instanceof Endpoint)) {
            throw new DecoratorContextError(`Target class must extend ${Endpoint.name} class.`, ...decoratorErrorArgs);
        }
        for (const decoratorName of exports.methodDecoratorNames) {
            if (decoratorName in descriptor.value && decoratorName !== name) {
                throw new DecoratorContextError("Target element cannot contain more than one method decorator.", ...decoratorErrorArgs);
            }
        }
        if (name in descriptor.value) {
            const props = descriptor.value[name];
            props.path = path;
            return;
        }
        Object.assign(descriptor.value, {
            [name]: { path },
        });
    };
}
//# sourceMappingURL=base.js.map