import { jwt } from '@elysiajs/jwt';
import { err, ok, type Result } from '@frkgg/shared';
import { type Cookie, Elysia, t } from 'elysia';

type AuthPayload = {
    subject: string;
    email: string;
};

type AppConfig = {
    accessTokenSecret: string;
    refreshTokenSecret: string;
    accessTokenTtl?: string;
    refreshTokenTtl?: string;
};

export function createApp(appConfig: AppConfig) {
    const accessJwtPlugin = jwt({
        name: 'jwtAccess',
        secret: appConfig.accessTokenSecret,
    });
    const refreshJwtPlugin = jwt({
        name: 'jwtRefresh',
        secret: appConfig.refreshTokenSecret,
    });

    const refreshTokenStore = new Map<string, AuthPayload>();

    type AccessJwt = typeof accessJwtPlugin.decorator.jwtAccess;
    type RefreshJwt = typeof refreshJwtPlugin.decorator.jwtRefresh;

    async function signNewTokens(
        jwtAccess: AccessJwt,
        jwtRefresh: RefreshJwt,
        auth: AuthPayload,
    ) {
        const accessTokenTtl = appConfig.accessTokenTtl ?? '10s';
        const refreshTokenTtl = appConfig.refreshTokenTtl ?? '30s';

        const newAccessToken = await jwtAccess.sign({
            ...auth,
            exp: accessTokenTtl,
            jti: crypto.randomUUID(),
        });
        const newRefreshToken = await jwtRefresh.sign({
            subject: auth.subject,
            exp: refreshTokenTtl,
            jti: crypto.randomUUID(),
        });
        return {
            access: newAccessToken,
            refresh: newRefreshToken,
        };
    }

    function issueCookies(
        accessToken: string,
        refreshToken: string,
        accessCookie: Cookie<string | undefined>,
        refreshCookie: Cookie<string | undefined>,
    ) {
        accessCookie.value = accessToken;
        accessCookie.httpOnly = true;
        accessCookie.secure = false;
        accessCookie.sameSite = 'lax';
        accessCookie.path = '/';
        accessCookie.domain = 'localhost';

        refreshCookie.value = refreshToken;
        refreshCookie.httpOnly = true;
        refreshCookie.secure = false;
        refreshCookie.sameSite = 'lax';
        refreshCookie.path = '/';
        refreshCookie.domain = 'localhost';
    }

    function clearCookies(
        accessCookie: Cookie<string | undefined>,
        refreshCookie: Cookie<string | undefined>,
    ) {
        accessCookie.value = '';
        accessCookie.httpOnly = true;
        accessCookie.secure = false;
        accessCookie.sameSite = 'lax';
        accessCookie.path = '/';
        accessCookie.domain = 'localhost';
        accessCookie.maxAge = 0;
        accessCookie.expires = new Date(0);

        refreshCookie.value = '';
        refreshCookie.httpOnly = true;
        refreshCookie.secure = false;
        refreshCookie.sameSite = 'lax';
        refreshCookie.path = '/';
        refreshCookie.domain = 'localhost';
        refreshCookie.maxAge = 0;
        refreshCookie.expires = new Date(0);
    }

    async function refreshTokens(
        jwtAccess: AccessJwt,
        jwtRefresh: RefreshJwt,
        accessCookie: Cookie<string | undefined>,
        refreshCookie: Cookie<string | undefined>,
    ): Promise<
        Result<
            { auth: AuthPayload; accessToken: string; refreshToken: string },
            { code: number; message?: string }
        >
    > {
        if (!refreshCookie.value)
            return err({ code: 401, message: 'Unauthorized: no refresh' });

        const refreshToken = await jwtRefresh.verify(refreshCookie.value);
        if (!refreshToken)
            return err({ code: 401, message: 'Unauthorized: refresh invalid' });

        const refreshAuth = refreshTokenStore.get(refreshCookie.value);
        if (!refreshAuth)
            return err({
                code: 401,
                message: 'Unauthorized: no refresh entry',
            });

        if (refreshToken.subject !== refreshAuth.subject)
            return err({
                code: 401,
                message: 'Unauthorized: refresh subject mismatch',
            });

        const { access: newAccessToken, refresh: newRefreshToken } =
            await signNewTokens(jwtAccess, jwtRefresh, refreshAuth);

        refreshTokenStore.set(newRefreshToken, refreshAuth);
        refreshTokenStore.delete(refreshCookie.value);
        issueCookies(
            newAccessToken,
            newRefreshToken,
            accessCookie,
            refreshCookie,
        );

        return ok({
            auth: refreshAuth,
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
        });
    }

    return new Elysia()
        .use(accessJwtPlugin)
        .use(refreshJwtPlugin)
        .guard({
            cookie: t.Cookie({
                accessCookie: t.Optional(t.String()),
                refreshCookie: t.Optional(t.String()),
            }),
        })
        .get(
            '/login',
            async ({
                jwtAccess,
                jwtRefresh,
                cookie: { accessCookie, refreshCookie },
            }) => {
                const auth = {
                    subject: 'frk',
                    email: 'me@frk.gg',
                };

                const { access: accessToken, refresh: refreshToken } =
                    await signNewTokens(jwtAccess, jwtRefresh, auth);

                issueCookies(
                    accessToken,
                    refreshToken,
                    accessCookie,
                    refreshCookie,
                );

                refreshTokenStore.set(refreshToken, auth);
                return {
                    access: accessToken,
                    refresh: refreshToken,
                };
            },
        )
        .get('/logout', ({ cookie: { accessCookie, refreshCookie } }) => {
            if (refreshCookie.value)
                refreshTokenStore.delete(refreshCookie.value);

            clearCookies(accessCookie, refreshCookie);
            return { ok: true };
        })
        .get(
            '/refresh',
            async ({
                jwtAccess,
                jwtRefresh,
                status,
                cookie: { accessCookie, refreshCookie },
            }) => {
                const res = await refreshTokens(
                    jwtAccess,
                    jwtRefresh,
                    accessCookie,
                    refreshCookie,
                );

                if (!res.ok) return status(res.error.code, res.error.message);
                return {
                    accessToken: res.value.accessToken,
                    refreshToken: res.value.refreshToken,
                };
            },
        )
        .derive(
            async ({
                jwtAccess,
                jwtRefresh,
                status,
                cookie: { accessCookie, refreshCookie },
            }) => {
                const accessToken = await jwtAccess.verify(accessCookie.value);
                if (accessToken) {
                    return {
                        auth: accessToken as AuthPayload,
                    };
                }

                const res = await refreshTokens(
                    jwtAccess,
                    jwtRefresh,
                    accessCookie,
                    refreshCookie,
                );

                if (!res.ok) return status(res.error.code, res.error.message);
                return { auth: res.value.auth };
            },
        )
        .get('/auth', () => {
            return { ok: true };
        })
        .get('/me', async ({ auth }) => {
            return {
                subject: auth.subject,
                email: auth.email,
            };
        });
}

if (import.meta.main) {
    const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;
    const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET;

    if (!ACCESS_TOKEN_SECRET) throw new Error('ACCESS_TOKEN_SECRET is not set');
    if (!REFRESH_TOKEN_SECRET)
        throw new Error('REFRESH_TOKEN_SECRET is not set');

    const app = createApp({
        accessTokenSecret: ACCESS_TOKEN_SECRET,
        refreshTokenSecret: REFRESH_TOKEN_SECRET,
    });
    app.listen(3000);
    console.log(
        `auth server running at: ${app.server?.hostname}:${app.server?.port}`,
    );
}
