import { Request, Response } from "express";
import logger from "../logger";
import { getTokenData, Token, TokenType } from "../tokens";

export abstract class Endpoint {
    protected constructor(public readonly path: string) {
    }

    protected sendOk<R extends Response>(
        response: R,
        ...[data]: IfUnknown<ResponseBodyType<R>, [], [data: ResponseBodyType<R>]>
    ): void {
        response.status(HTTPStatus.OK).send(data);
    }

    protected sendStatus<R extends Response>(
        response: R,
        status: HTTPStatus,
        ...[data]: IfUnknown<ResponseBodyType<R>, [], [data: ResponseBodyType<R>]>
    ): void {
        response.status(status).send(data);
    }

    protected sendError(response: Response, status: HTTPStatus, message: string): void {
        response.status(status).send({
            status,
            message,
        });
    }

    protected getToken(request: Request): Token | null {
        const bearerToken = request.headers.authorization ?? "";

        if (!/^Bearer [A-Za-z0-9_-]{86}$/.test(bearerToken)) {
            return null;
        }

        const token = bearerToken.slice(7);
        const tokenData = getTokenData(token);
        return tokenData ?? null;
    }
}

export function GetMethod<T extends EndpointMethod>(options: string | MethodDecoratorOptions = {}): TypedDecorator<T> {
    if (typeof options === "string") {
        options = { path: options };
    }

    return makeMethodDecorator(GetMethod.name, Method.GET, options);
}

export function PostMethod<T extends EndpointMethod>(options: string | MethodDecoratorOptions = {}): TypedDecorator<T> {
    if (typeof options === "string") {
        options = { path: options };
    }

    return makeMethodDecorator(PostMethod.name, Method.POST, options);
}

export function PutMethod<T extends EndpointMethod>(options: string | MethodDecoratorOptions = {}): TypedDecorator<T> {
    if (typeof options === "string") {
        options = { path: options };
    }

    return makeMethodDecorator(PutMethod.name, Method.PUT, options);
}

export function PatchMethod<T extends EndpointMethod>(options: string | MethodDecoratorOptions = {}): TypedDecorator<T> {
    if (typeof options === "string") {
        options = { path: options };
    }

    return makeMethodDecorator(PatchMethod.name, Method.PATCH, options);
}

export function DeleteMethod<T extends EndpointMethod>(options: string | MethodDecoratorOptions = {}): TypedDecorator<T> {
    if (typeof options === "string") {
        options = { path: options };
    }

    return makeMethodDecorator(DeleteMethod.name, Method.DELETE, options);
}

export const methodDecoratorNames = [
    GetMethod.name,
    PostMethod.name,
    PutMethod.name,
    PatchMethod.name,
    DeleteMethod.name,
] as const;

// noinspection JSUnusedGlobalSymbols
export enum Method {
    GET = "GET",
    POST = "POST",
    PUT = "PUT",
    PATCH = "PATCH",
    DELETE = "DELETE",
}

// noinspection JSUnusedGlobalSymbols
export enum HTTPStatus {
    /**
     * **Continue**
     *
     * This interim response indicates that the client should continue the request or ignore the response if the request is
     * already finished.
     */
    CONTINUE = 100,
    /**
     * **Switching Protocols**
     *
     * This code is sent in response to an Upgrade request header from the client and indicates the protocol the server is
     * switching to.
     */
    SWITCHING_PROTOCOLS = 101,
    /**
     * **Processing**
     *
     * This code indicates that the server has received and is processing the request, but no response is available yet.
     */
    PROCESSING = 102,
    /**
     * **Early Hints**
     *
     * This status code is primarily intended to be used with the Link header, letting the user agent start preloading
     * resources while the server prepares a response or pre-connect to an origin from which the page will need resources.
     */
    EARLY_HINTS = 103,

    /**
     * **OK**
     *
     * The request succeeded.
     */
    OK = 200,
    /**
     * **Created**
     *
     * The request succeeded, and a new resource was created as a result. This is typically the response sent after POST
     * requests, or some PUT requests.
     */
    CREATED = 201,
    /**
     * **Accepted**
     *
     * The request has been received but not yet acted upon. It is noncommittal, since there is no way in HTTP to later send
     * an asynchronous response indicating the outcome of the request. It is intended for cases where another process or
     * server handles the request, or for batch processing.
     */
    ACCEPTED = 202,
    /**
     * **Non-Authoritative Information**
     *
     * This response code means the returned metadata is not exactly the same as is available from the origin server, but is
     * collected from a local or a third-party copy. This is mostly used for mirrors or backups of another resource. Except
     * for that specific case, the 200 OK response is preferred to this status.
     */
    NON_AUTHORITATIVE_INFORMATION = 203,
    /**
     * **No Content**
     *
     * There is no content to send for this request, but the headers may be useful. The user agent may update its cached
     * headers for this resource with the new ones.
     */
    NO_CONTENT = 204,
    /**
     * **Reset Content**
     *
     * Tells the user agent to reset the document which sent this request.
     */
    RESET_CONTENT = 205,
    /**
     * **Partial Content**
     *
     * This response code is used when the Range header is sent from the client to request only part of a resource.
     */
    PARTIAL_CONTENT = 206,
    /**
     * **Multi-Status**
     *
     * Conveys information about multiple resources, for situations where multiple status codes might be appropriate.
     */
    MULTI_STATUS = 207,
    /**
     * **Already Reported**
     *
     * Used inside a <dav:propstat> response element to avoid repeatedly enumerating the internal members of multiple
     * bindings to the same collection.
     */
    ALREADY_REPORTED = 208,
    /**
     * **IM Used**
     *
     * The server has fulfilled a GET request for the resource, and the response is a representation of the result of one or
     * more instance-manipulations applied to the current instance.
     */
    IM_USED = 226,

    /**
     * **Multiple Choices**
     *
     * The request has more than one possible response. The user agent or user should choose one of them.
     */
    MULTIPLE_CHOICES = 300,
    /**
     * **Moved Permanently**
     *
     * The URL of the requested resource has been changed permanently. The new URL is given in the response.
     */
    MOVED_PERMANENTLY = 301,
    /**
     * **Found**
     *
     * This response code means that the URI of requested resource has been changed temporarily. Further changes in the URI
     * might be made in the future. Therefore, this same URI should be used by the client in future requests.
     */
    FOUND = 302,
    /**
     * **See Other**
     *
     * The server sent this response to direct the client to get the requested resource at another URI with a GET request.
     */
    SEE_OTHER = 303,
    /**
     * **Not Modified**
     *
     * This is used for caching purposes. It tells the client that the response has not been modified, so the client can
     * continue to use the same cached version of the response.
     */
    NOT_MODIFIED = 304,
    /**
     * **Use Proxy**
     *
     * Defined in a previous version of the HTTP specification to indicate that a requested response must be accessed by a
     * proxy.
     *
     * @deprecated It has been deprecated due to security concerns regarding in-band configuration of a proxy.
     */
    USE_PROXY = 305,
    /**
     * **Temporary Redirect**
     *
     * The server sends this response to direct the client to get the requested resource at another URI with the same method
     * that was used in the prior request.
     */
    TEMPORARY_REDIRECT = 307,
    /**
     * **Permanent Redirect**
     *
     * This means that the resource is now permanently located at another URI, specified by the Location: HTTP Response
     * header.
     */
    PERMANENT_REDIRECT = 308,

    /**
     * **Bad Request**
     *
     * The server cannot or will not process the request due to something that is perceived to be a client error (e.g.,
     * malformed request syntax, invalid request message framing, or deceptive request routing).
     */
    BAD_REQUEST = 400,
    /**
     * **Unauthorized**
     *
     * Although the HTTP standard specifies "unauthorized", semantically this response means "unauthenticated". That is, the
     * client must authenticate itself to get the requested response.
     */
    UNAUTHORIZED = 401,
    /**
     * **Payment Required**
     *
     * This response code is reserved for future use. The initial aim for creating this code was using it for digital payment
     * systems, however this status code is used very rarely and no standard convention exists.
     */
    PAYMENT_REQUIRED = 402,
    /**
     * **Forbidden**
     *
     * The client does not have access rights to the content; that is, it is unauthorized, so the server is refusing to give
     * the requested resource. Unlike 401 Unauthorized, the client's identity is known to the server.
     */
    FORBIDDEN = 403,
    /**
     * **Not Found**
     *
     * The server cannot find the requested resource. In the browser, this means the URL is not recognized.
     */
    NOT_FOUND = 404,
    /**
     * **Method Not Allowed**
     *
     * The request method is known by the server but is not supported by the target resource. For example, an API may not
     * allow calling DELETE to remove a resource.
     */
    METHOD_NOT_ALLOWED = 405,
    /**
     * **Not Acceptable**
     *
     * This response is sent when the web server, after performing server-driven content negotiation, doesn't find any
     * content that conforms to the criteria given by the user agent.
     */
    NOT_ACCEPTABLE = 406,
    /**
     * **Proxy Authentication Required**
     *
     * This is similar to `401 Unauthorized` but authentication is needed to be done by a proxy.
     */
    PROXY_AUTHENTICATION_REQUIRED = 407,
    /**
     * **Request Timeout**
     *
     * This response is sent on an idle connection by some servers, even without any previous request by the client. It means
     * that the server would like to shut down this unused connection.
     */
    REQUEST_TIMEOUT = 408,
    /**
     * **Conflict**
     *
     * This response is sent when a request conflicts with the current state of the server.
     */
    CONFLICT = 409,
    /**
     * **Gone**
     *
     * This response is sent when the requested content has been permanently deleted from server, with no forwarding address.
     */
    GONE = 410,
    /**
     * **Length Required**
     *
     * Server rejected the request because the Content-Length header field is not defined and the server requires it.
     */
    LENGTH_REQUIRED = 411,
    /**
     * **Precondition Failed**
     *
     * The client has indicated preconditions in its headers which the server does not meet.
     */
    PRECONDITION_FAILED = 412,
    /**
     * **Content Too Large**
     *
     * Request entity is larger than limits defined by server. The server might close the connection or return a Retry-After
     * header field.
     */
    CONTENT_TOO_LARGE = 413,
    /**
     * **URI Too Long**
     *
     * The URI requested by the client is longer than the server is willing to interpret.
     */
    URI_TOO_LONG = 414,
    /**
     * **Unsupported Media Type**
     *
     * The media format of the requested data is not supported by the server, so the server is rejecting the request.
     */
    UNSUPPORTED_MEDIA_TYPE = 415,
    /**
     * **Range Not Satisfiable**
     *
     * The range specified by the Range header field in the request cannot be fulfilled. It's possible that the range is
     * outside the size of the target URI's data.
     */
    RANGE_NOT_SATISFIABLE = 416,
    /**
     * **Expectation Failed**
     *
     * This response code means the expectation indicated by the Expect request header field cannot be met by the server.
     */
    EXPECTATION_FAILED = 417,
    /**
     * **I'm a Teapot**
     *
     * The server refuses the attempt to brew coffee with a teapot.
     */
    IM_A_TEAPOT = 418,
    /**
     * **Enhance your Calm**
     *
     * Unofficial status code, used in Twitter API to indicate that the client is being rate limited for making too many
     * requests.
     */
    ENHANCE_YOUR_CALM = 420,
    /**
     * **Misdirected Request**
     *
     * The request was directed at a server that is not able to produce a response. This can be sent by a server that is not
     * configured to produce responses for the combination of scheme and authority that are included in the request URI.
     */
    MISDIRECTED_REQUEST = 421,
    /**
     * **Unprocessable Content**
     *
     * The request was well-formed but was unable to be followed due to semantic errors.
     */
    UNPROCESSABLE_CONTENT = 422,
    /**
     * **Locked**
     *
     * The resource that is being accessed is locked, meaning it can't be accessed.
     */
    LOCKED = 423,
    /**
     * **Failed Dependency**
     *
     * The request failed due to failure of a previous request.
     */
    FAILED_DEPENDENCY = 424,
    /**
     * **Too Early**
     *
     * Indicates that the server is unwilling to risk processing a request that might be replayed.
     */
    TOO_EARLY = 425,
    /**
     * **Upgrade Required**
     *
     * The server refuses to perform the request using the current protocol but might be willing to do so after the client
     * upgrades to a different protocol.
     */
    UPGRADE_REQUIRED = 426,
    /**
     * **Precondition Required**
     *
     * The origin server requires the request to be conditional. This response is intended to prevent the 'lost update'
     * problem, where a client GETs a resource's state, modifies it and PUTs it back to the server, when meanwhile a third
     * party has modified the state on the server, leading to a conflict.
     */
    PRECONDITION_REQUIRED = 428,
    /**
     * **Too Many Requests**
     *
     * The user has sent too many requests in a given amount of time ("rate limiting").
     */
    TOO_MANY_REQUESTS = 429,
    /**
     * **Request Header Fields Too Large**
     *
     * The server is unwilling to process the request because its header fields are too large. The request may be resubmitted
     * after reducing the size of the request header fields.
     */
    REQUEST_HEADER_FIELDS_TOO_LARGE = 431,
    /**
     * **Unavailable for Legal Reason**
     *
     * The user agent requested a resource that cannot legally be provided, such as a web page censored by a government.
     */
    UNAVAILABLE_FOR_LEGAL_REASONS = 451,

    /**
     * **Server Error**
     *
     * The server has encountered a situation it does not know how to handle.
     */
    INTERNAL_SERVER_ERROR = 500,
    /**
     * **Not Implemented**
     *
     * The request method is not supported by the server and cannot be handled. The only methods that servers are required to
     * support (and therefore that must not return this code) are GET and HEAD.
     */
    NOT_IMPLEMENTED = 501,
    /**
     * **Bad Gateway**
     *
     * This error response means that the server, while working as a gateway to get a response needed to handle the request,
     * got an invalid response.
     */
    BAD_GATEWAY = 502,
    /**
     * **Service Unavailable**
     *
     * The server is not ready to handle the request. Common causes are a server that is down for maintenance or that is
     * overloaded.
     */
    SERVICE_UNAVAILABLE = 503,
    /**
     * **Gateway Timeout**
     *
     * This error response is given when the server is acting as a gateway and cannot get a response in time.
     */
    GATEWAY_TIMEOUT = 504,
    /**
     * **HTTP Version Not Supported**
     *
     * The HTTP version used in the request is not supported by the server.
     */
    HTTP_VERSION_NOT_SUPPORTED = 505,
    /**
     * **Insufficient Storage**
     *
     * The method could not be performed on the resource because the server is unable to store the representation needed to
     * successfully complete the request.
     */
    INSUFFICIENT_STORAGE = 507,
    /**
     * **Loop Detected**
     *
     * The server detected an infinite loop while processing the request.
     */
    LOOP_DETECTED = 508,
    /**
     * **Network Authentication Required**
     *
     * Indicates that the client needs to authenticate to gain network access.
     */
    NETWORK_AUTHENTICATION_REQUIRED = 511,
}

class DecoratorContextError extends Error {
    public constructor(
        message: string,
        decoratorName: string,
        public target: unknown,
        public propertyKey: string,
        public descriptor: PropertyDescriptor
    ) {
        super(`${decoratorName} decorator used in the wrong context. ${message}`);
    }
}

function makeMethodDecorator<T extends EndpointMethod>(
    name: string,
    method: Method,
    options: MethodDecoratorOptions
): TypedDecorator<T> {
    return function (target, propertyKey, descriptor) {
        const decoratorErrorArgs: [string, ...Parameters<TypedDecorator<T>>] = [name, target, propertyKey, descriptor];

        if (typeof descriptor.value !== "function") {
            throw new DecoratorContextError("Attached element must be a function.", ...decoratorErrorArgs);
        }

        if (!(target instanceof Endpoint)) {
            throw new DecoratorContextError(`Target class must extend ${Endpoint.name} class.`, ...decoratorErrorArgs);
        }

        for (const decoratorName of methodDecoratorNames) {
            if (decoratorName in descriptor.value) {
                throw new DecoratorContextError(
                    "Target element cannot contain more than one method decorator.", ...decoratorErrorArgs
                );
            }
        }

        if (typeof options.requiresAuthorization !== "undefined") {
            const oldValue = descriptor.value;

            descriptor.value = (async function (this: Endpoint, request: Request, response: Response): Promise<void> {
                const token = this.getToken(request);

                if (!token || (options.requiresAuthorization !== true && (
                    Array.isArray(options.requiresAuthorization)
                        ? !options.requiresAuthorization.includes(token.type)
                        : token.type !== options.requiresAuthorization
                ))) {
                    this.sendError(response, HTTPStatus.UNAUTHORIZED, "Invalid session token.");
                    return;
                }

                oldValue.apply(this, [request, response]);
            }) as T;
        }

        const oldValue = descriptor.value;

        descriptor.value = (async function (this: Endpoint, request: Request, response: Response): Promise<void> {
            const method = request.method as Method;

            logger.log(`${method} ${request.path}:`, {
                ...Object.keys(request.query).length > 0 && { query: request.query },
                ...request.body && Object.keys(request.body).length > 0 && { body: request.body },
            });

            if (method === Method.POST && request.headers["content-type"] !== "application/json") {
                this.sendError(response, HTTPStatus.BAD_REQUEST, "Content-Type header must be 'application/json'.");
                return;
            }

            oldValue.call(this, request, response)?.catch?.(error => {
                console.error(error);
                this.sendStatus(response, HTTPStatus.INTERNAL_SERVER_ERROR);
            });
        }) as T;

        Object.assign(descriptor.value, {
            [name]: {
                method,
                path: options.path ?? "",
            },
        });
    };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type EndpointMethod = (
    request: Request<any, any, any, any, any>,
    response: Response<any, any>
) => Promise<void> | void;
/* eslint-enable @typescript-eslint/no-explicit-any */

type MethodDecoratorOptions = {
    path?: string;
    requiresAuthorization?: TokenType | TokenType[] | true;
};

type TypedDecorator<T> = (target: unknown, propertyKey: string, descriptor: TypedPropertyDescriptor<T>) => void;

type ResponseBodyType<R extends Response> = R extends Response<infer DT> ? DT : never;

type IfUnknown<T, Y, N> = [unknown] extends [T] ? Y : N;
