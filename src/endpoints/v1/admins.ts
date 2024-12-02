import { createHash } from "crypto";
import { Request, Response } from "express";
import { sql } from "kysely";
import { db, Employee, isValidEmail, isValidPhone, isValidRut } from "../../db";
import { generateToken, revokeToken, TokenType } from "../../tokens";
import { SnakeToCamelRecord } from "../../types";
import { DeleteMethod, Endpoint, GetMethod, HTTPStatus, PatchMethod, PostMethod } from "../base";
import { Validator } from "../validator";

export class AdminsEndpoint extends Endpoint {
    private readonly adminUpdateValidator: Validator<AdminUpdate>;

    public constructor() {
        super("/admins");

        this.adminUpdateValidator = new Validator<AdminUpdate>({
            firstName: (value, key) => {
                if (typeof value === "undefined") {
                    return {
                        ok: true,
                    };
                }

                const valid = !!value && typeof value === "string";
                return valid ? {
                    ok: true,
                } : {
                    ok: false,
                    status: HTTPStatus.BAD_REQUEST,
                    message: `Invalid ${key}.`,
                };
            },
            secondName: (value, key) => {
                if (typeof value === "undefined") {
                    return {
                        ok: true,
                    };
                }

                const valid = !value || typeof value === "string";
                return valid ? {
                    ok: true,
                } : {
                    ok: false,
                    status: HTTPStatus.BAD_REQUEST,
                    message: `Invalid ${key}.`,
                };
            },
            firstLastName: (value, key) => {
                if (typeof value === "undefined") {
                    return {
                        ok: true,
                    };
                }

                const valid = !!value && typeof value === "string";
                return valid ? {
                    ok: true,
                } : {
                    ok: false,
                    status: HTTPStatus.BAD_REQUEST,
                    message: `Invalid ${key}.`,
                };
            },
            secondLastName: (value, key) => {
                if (typeof value === "undefined") {
                    return {
                        ok: true,
                    };
                }

                const valid = !value || typeof value === "string";
                return valid ? {
                    ok: true,
                } : {
                    ok: false,
                    status: HTTPStatus.BAD_REQUEST,
                    message: `Invalid ${key}.`,
                };
            },
            email: async (value, key) => {
                if (typeof value === "undefined") {
                    return {
                        ok: true,
                    };
                }

                const valid = !!value && typeof value === "string" && isValidEmail(value);

                if (!valid) {
                    return {
                        ok: false,
                        status: HTTPStatus.BAD_REQUEST,
                        message: `Invalid ${key}.`,
                    };
                }

                const employee = await db
                    .selectFrom("employee")
                    .select("rut")
                    .where("email", "=", value)
                    .executeTakeFirst();

                return !employee ? {
                    ok: true,
                } : {
                    ok: false,
                    status: HTTPStatus.CONFLICT,
                    message: `An employee with ${key} ${value} already exists.`,
                };
            },
            phone: async (value, key) => {
                if (typeof value === "undefined") {
                    return {
                        ok: true,
                    };
                }

                const valid = !!value && typeof value === "number" && isValidPhone(value);

                if (!valid) {
                    return {
                        ok: false,
                        status: HTTPStatus.BAD_REQUEST,
                        message: `Invalid ${key}.`,
                    };
                }

                const employee = await db
                    .selectFrom("employee")
                    .select("rut")
                    .where("phone", "=", value)
                    .executeTakeFirst();

                return !employee ? {
                    ok: true,
                } : {
                    ok: false,
                    status: HTTPStatus.CONFLICT,
                    message: `An employee with ${key} ${value} already exists.`,
                };
            },
            birthDate: (value, key) => {
                if (typeof value === "undefined") {
                    return {
                        ok: true,
                    };
                }

                const valid = !!value
                    && typeof value === "string"
                    && /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[1-2][0-9]|3[0-1])$/.test(value);
                return valid ? {
                    ok: true,
                } : {
                    ok: false,
                    status: HTTPStatus.BAD_REQUEST,
                    message: `Invalid ${key}.`,
                };
            },
            gender: (value, key) => {
                if (typeof value === "undefined") {
                    return {
                        ok: true,
                    };
                }

                const valid = !!value && typeof value === "string";
                return valid ? {
                    ok: true,
                } : {
                    ok: false,
                    status: HTTPStatus.BAD_REQUEST,
                    message: `Invalid ${key}.`,
                };
            },
        });
    }

    @GetMethod({ requiresAuthorization: [TokenType.MEDIC, TokenType.ADMIN] })
    public async getAllAdmins(_request: Request, response: Response<Admin[]>): Promise<void> {
        const admins = await db
            .selectFrom("employee")
            .select(({ ref }) => [
                "rut",
                sql<string>`concat(
                    ${ref("first_name")}, " ",
                    ifnull(concat(${ref("second_name")}, " "), ""),
                    ${ref("first_last_name")},
                    ifnull(concat(" ", ${ref("second_last_name")}), "")
                )`.as("fullName"),
                "email",
                "phone",
                "birth_date as birthDate",
                "gender",
            ])
            .where("type", "=", "admin_staff")
            .execute();

        this.sendOk(response, admins);
    }

    @GetMethod({ path: "/:rut", requiresAuthorization: [TokenType.MEDIC, TokenType.ADMIN] })
    public async getAdmin(request: Request<{ rut: string }>, response: Response<Admin>): Promise<void> {
        const { rut } = request.params;

        if (!isValidRut(rut)) {
            this.sendError(response, HTTPStatus.BAD_REQUEST, "Invalid rut.");
            return;
        }

        const admin = await db
            .selectFrom("employee")
            .select(({ ref }) => [
                "rut",
                sql<string>`concat(
                    ${ref("first_name")}, " ",
                    ifnull(concat(${ref("second_name")}, " "), ""),
                    ${ref("first_last_name")},
                    ifnull(concat(" ", ${ref("second_last_name")}), "")
                )`.as("fullName"),
                "email",
                "phone",
                "birth_date as birthDate",
                "gender",
            ])
            .where("rut", "=", rut)
            .where("type", "=", "admin_staff")
            .executeTakeFirst();

        if (!admin) {
            this.sendError(response, HTTPStatus.NOT_FOUND, `Admin ${rut} does not exist.`);
            return;
        }

        this.sendOk(response, admin);
    }

    @PatchMethod({ path: "/:rut", requiresAuthorization: TokenType.ADMIN })
    public async updateMedic(request: Request<{ rut: string }, unknown, AdminUpdate>, response: Response): Promise<void> {
        const { rut } = request.params;

        if (!isValidRut(rut)) {
            this.sendError(response, HTTPStatus.BAD_REQUEST, "Invalid rut.");
            return;
        }

        if (this.getToken(request)!.rut !== rut) {
            this.sendError(response, HTTPStatus.UNAUTHORIZED, "Invalid session token.");
            return;
        }

        const admin = await db
            .selectFrom("employee")
            .select("rut")
            .where("rut", "=", rut)
            .where("type", "=", "admin_staff")
            .executeTakeFirst();

        if (!admin) {
            this.sendError(response, HTTPStatus.NOT_FOUND, `Admin ${rut} does not exist.`);
            return;
        }

        const validationResult = await this.adminUpdateValidator.validate(request.body);

        if (!validationResult.ok) {
            this.sendError(response, validationResult.status, validationResult.message);
            return;
        }

        if (Object.keys(validationResult.value).length === 0) {
            this.sendStatus(response, HTTPStatus.NOT_MODIFIED);
            return;
        }

        const updateResult = await db
            .updateTable("employee")
            .set({
                first_name: validationResult.value.firstName,
                second_name: validationResult.value.secondName || undefined,
                first_last_name: validationResult.value.firstLastName,
                second_last_name: validationResult.value.secondLastName || undefined,
                email: validationResult.value.email,
                phone: validationResult.value.phone,
                birth_date: validationResult.value.birthDate,
                gender: validationResult.value.gender,
            })
            .where("rut", "=", rut)
            .execute();

        if (updateResult[0].numChangedRows === 0n) {
            this.sendStatus(response, HTTPStatus.NOT_MODIFIED);
            return;
        }

        this.sendStatus(response, HTTPStatus.NO_CONTENT);
    }

    @PostMethod("/:rut/session")
    public async createSession(
        request: Request<{ rut: string }, unknown, { password?: string }>,
        response: Response<{ token: string }>
    ): Promise<void> {
        const { rut } = request.params;
        const { password } = request.body;

        if (!password) {
            this.sendError(response, HTTPStatus.BAD_REQUEST, "Request body must contain password.");
            return;
        }

        const admin = await db
            .selectFrom("employee")
            .select(["password", "salt"])
            .where("rut", "=", rut)
            .where("type", "=", "admin_staff")
            .executeTakeFirst();

        if (!admin) {
            this.sendError(response, HTTPStatus.NOT_FOUND, `Admin ${rut} does not exist.`);
            return;
        }

        const encryptedPassword = createHash("sha512").update(password + admin.salt).digest("base64url");

        if (encryptedPassword !== admin.password) {
            this.sendError(response, HTTPStatus.UNAUTHORIZED, "Incorrect password.");
            return;
        }

        const token = await generateToken(rut, TokenType.ADMIN);

        this.sendStatus(response, HTTPStatus.CREATED, { token });
    }

    @DeleteMethod({ path: "/:rut/session", requiresAuthorization: TokenType.ADMIN })
    public async expireSession(request: Request, response: Response): Promise<void> {
        const { token } = this.getToken(request)!;

        await revokeToken(token);

        this.sendStatus(response, HTTPStatus.NO_CONTENT);
    }
}

type Admin = {
    rut: string;
    fullName: string;
    email: string;
    phone: number;
    birthDate: string;
    gender: string;
};

type AdminUpdate = Partial<SnakeToCamelRecord<Omit<Employee,
    | "rut"
    | "type"
    | "password"
    | "salt"
    | "session_token"
>>>;
