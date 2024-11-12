import { randomBytes } from "crypto";
import { sql } from "kysely";
import { db } from "./db";

// noinspection JSUnusedGlobalSymbols
export enum TokenType {
    INVALID = -1,
    PATIENT,
    MEDIC,
    ADMIN,
}

const tokens = new Map<string, TokenType>();

export async function loadTokens(): Promise<void> {
    const sessionTokens = await db
        .selectFrom("person as p")
        .leftJoin("patient as a", "a.id", "p.id")
        .leftJoin("employee as e", "e.id", "p.id")
        .select([
            "p.session_token as token",
            sql<TokenType>`(
                case
                    when a.id is null and e.id is null then ${TokenType.INVALID}
                    when e.id is null then ${TokenType.PATIENT}
                    when e.type = "medic" then ${TokenType.MEDIC}
                    else ${TokenType.ADMIN}
                end
            )`.as("type"),
        ])
        .execute();

    for (const { token, type } of sessionTokens) {
        if (token) {
            if (type === TokenType.INVALID) {
                throw new TypeError(`Token ${token} is neither from a patient or an employee.`);
            }

            tokens.set(token, type);
        }
    }
}

export async function generateToken(id: number): Promise<string> {
    let token: string;
    do {
        token = randomBytes(64).toString("base64url");
    } while (tokens.has(token));

    await db
        .updateTable("person")
        .where("id", "=", id)
        .set("session_token", token)
        .execute();

    const result = await db
        .selectFrom("person as p")
        .leftJoin("patient as a", "a.id", "p.id")
        .leftJoin("employee as e", "e.id", "p.id")
        .select(sql<TokenType>`(
            case
                when a.id is null and e.id is null then ${TokenType.INVALID}
                when e.id is null then ${TokenType.PATIENT}
                when e.type = "medic" then ${TokenType.MEDIC}
                else ${TokenType.ADMIN}
            end
        )`.as("type"))
        .where("p.id", "=", id)
        .execute();

    tokens.set(token, result[0].type);

    return token;
}

export function doesTokenExist(token: string): boolean {
    return tokens.has(token);
}

export function getTokenType(token: string): TokenType | undefined {
    return tokens.get(token);
}

export async function revokeToken(token: string): Promise<void> {
    if (doesTokenExist(token)) {
        await db
            .updateTable("person")
            .where("session_token", "=", token)
            .set("session_token", null)
            .execute();

        tokens.delete(token);
    }
}
