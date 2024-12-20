import { Request, Response } from "express";
import { Clinic, db, isValidEmail, isValidPhone } from "../../db";
import { TokenType } from "../../tokens";
import { SnakeToCamelRecord } from "../../types";
import { Endpoint, GetMethod, HTTPStatus, PatchMethod } from "../base";
import { Validator } from "../validator";

export class ClinicEndpoint extends Endpoint {
    private clinicUpdateValidator: Validator<Partial<ClinicObject>>;

    public constructor() {
        super("/clinic");

        this.clinicUpdateValidator = new Validator<Partial<ClinicObject>>({
            name: async (value, key) => {
                const valid = typeof value === "undefined" || typeof value === "string";
                return valid ? {
                    ok: true,
                } : {
                    ok: false,
                    status: HTTPStatus.BAD_REQUEST,
                    message: `Invalid ${key}.`,
                };
            },
            email: async (value, key) => {
                const valid = typeof value === "undefined" || (typeof value === "string" && isValidEmail(value));
                return valid ? {
                    ok: true,
                } : {
                    ok: false,
                    status: HTTPStatus.BAD_REQUEST,
                    message: `Invalid ${key}.`,
                };
            },
            phone: async (value, key) => {
                const valid = typeof value === "undefined" || (typeof value === "number" && isValidPhone(value));
                return valid ? {
                    ok: true,
                } : {
                    ok: false,
                    status: HTTPStatus.BAD_REQUEST,
                    message: `Invalid ${key}.`,
                };
            },
            address: async (value, key) => {
                const valid = typeof value === "undefined" || typeof value === "string";
                return valid ? {
                    ok: true,
                } : {
                    ok: false,
                    status: HTTPStatus.BAD_REQUEST,
                    message: `Invalid ${key}.`,
                };
            },
            openingTime: async (value, key) => {
                const valid = typeof value === "undefined" || (
                    typeof value === "string" && /^[0-2][0-9]:[0-5][0-9]$/.test(value)
                );
                return valid ? {
                    ok: true,
                } : {
                    ok: false,
                    status: HTTPStatus.BAD_REQUEST,
                    message: `Invalid ${key}.`,
                };
            },
            closingTime: async (value, key) => {
                const valid = typeof value === "undefined" || (
                    typeof value === "string" && /^[0-2][0-9]:[0-5][0-9]$/.test(value)
                );
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

    @GetMethod()
    public async getClinic(_request: Request, response: Response<ClinicObject>): Promise<void> {
        const clinic = await db
            .selectFrom("clinic")
            .select([
                "name",
                "email",
                "phone",
                "address",
                "opening_time as openingTime",
                "closing_time as closingTime",
            ])
            .executeTakeFirst();

        if (!clinic) {
            throw new Error("Clinic not found.");
        }

        this.sendOk(response, clinic);
    }

    @PatchMethod({ requiresAuthorization: TokenType.ADMIN })
    public async updateClinic(request: Request<unknown, unknown, Partial<ClinicObject>>, response: Response): Promise<void> {
        const clinic = await db
            .selectFrom("clinic")
            .select("id")
            .executeTakeFirst();

        if (!clinic) {
            throw new Error("Clinic not found.");
        }

        const validationResult = await this.clinicUpdateValidator.validate(request.body);

        if (!validationResult.ok) {
            this.sendError(response, validationResult.status, validationResult.message);
            return;
        }

        if (Object.keys(validationResult.value).length === 0) {
            this.sendStatus(response, HTTPStatus.NOT_MODIFIED);
            return;
        }

        const {
            name,
            email,
            phone,
            address,
            openingTime,
            closingTime,
        } = validationResult.value;

        let update = db
            .updateTable("clinic")
            .where("id", "=", clinic.id);

        if (name) {
            update = update.set("name", name);
        }

        if (email) {
            update = update.set("email", email);
        }

        if (phone) {
            update = update.set("phone", phone);
        }

        if (address) {
            update = update.set("address", address);
        }

        if (openingTime) {
            update = update.set("opening_time", openingTime);
        }

        if (closingTime) {
            update = update.set("closing_time", closingTime);
        }

        const modified = await update.execute();

        if (modified[0].numChangedRows === 0n) {
            this.sendStatus(response, HTTPStatus.NOT_MODIFIED);
            return;
        }

        this.sendStatus(response, HTTPStatus.NO_CONTENT);
    }
}

type ClinicObject = SnakeToCamelRecord<Omit<Clinic, "id">>;
