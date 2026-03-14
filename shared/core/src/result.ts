export type Ok<T> = {
    ok: true;
    value: T;
};

export type Err<E> = {
    ok: false;
    error: E;
};

export type Result<T, E> = Ok<T> | Err<E>;

export function ok<T, E>(value: T): Result<T, E> {
    return {
        ok: true,
        value,
    };
}

export function err<T, E>(error: E): Result<T, E> {
    return {
        ok: false,
        error,
    };
}

