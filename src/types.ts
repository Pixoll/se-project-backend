export type MapNullToUndefined<T> = {
    [K in keyof T as null extends T[K] ? never : K]: T[K];
} & {
    [K in keyof T as null extends T[K] ? K : never]?: NonNullable<T[K]>;
};

export type SnakeToCamelRecord<T> = {
    [K in keyof T as K extends string ? SnakeToCamelCase<K> : K]: T[K];
};

export type SnakeToCamelCase<S extends string> = S extends `${infer A}_${infer B}`
    ? `${A}${Capitalize<SnakeToCamelCase<B>>}`
    : S;
