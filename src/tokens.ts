import { randomBytes } from "crypto";
import { sql } from "kysely";
import { db } from "./db";

// noinspection JSUnusedGlobalSymbols
export enum TokenType {
    PATIENT,
    MEDIC,
    ADMIN,
}

export type Token = {
    token: string;
    rut: string;
    type: TokenType;
};

const tokens = new Map<string, Token>();

export async function loadTokens(): Promise<void> {
    const patientTokens = await db
        .selectFrom("patient")
        .select([
            "rut",
            "session_token as token",
        ])
        .execute();

    for (const { rut, token } of patientTokens) {
        if (token) {
            tokens.set(token, { token, rut, type: TokenType.PATIENT });
        }
    }

    const employeeTokens = await db
        .selectFrom("employee")
        .select([
            "rut",
            "session_token as token",
            sql<string>`(
                case
                    when type = "medic" then ${TokenType.MEDIC}
                    else ${TokenType.ADMIN}
                end
            )`.as("type"),
        ])
        .execute();

    for (const { rut, token, type } of employeeTokens) {
        if (token) {
            tokens.set(token, { token, rut, type: +type });
        }
    }
}

export async function generateToken(rut: string, type: TokenType): Promise<string> {
    let token: string;
    do {
        token = randomBytes(64).toString("base64url");
    } while (tokens.has(token));

    await db
        .updateTable(type === TokenType.PATIENT ? "patient" : "employee")
        .where("rut", "=", rut)
        .set("session_token", token)
        .execute();

    tokens.set(token, { token, rut, type });

    return token;
}

export function getTokenData(token: string): Token | undefined {
    return tokens.get(token);
}

export async function revokeToken(token: string): Promise<void> {
    const { type } = tokens.get(token) ?? { type: null };

    if (type !== null) {
        await db
            .updateTable(type === TokenType.PATIENT ? "patient" : "employee")
            .where("session_token", "=", token)
            .set("session_token", null)
            .execute();

        tokens.delete(token);
    }
}
