export type NonNullableRecord<T> = {
    [K in keyof T]: NonNullable<T[K]>;
};

export type SnakeToCamelRecord<T> = {
    [K in keyof T as K extends string ? SnakeToCamelCase<K> : K]: T[K];
};

export type SnakeToCamelCase<S extends string> = S extends `${infer A}_${infer B}`
    ? `${A}${Capitalize<SnakeToCamelCase<B>>}`
    : S;
