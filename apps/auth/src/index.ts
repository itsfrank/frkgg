import { err, ok, type Result } from '@frkgg/shared';
import { jwt } from '@elysiajs/jwt';
import { type Cookie, Elysia, t } from 'elysia';

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET;

if (!ACCESS_TOKEN_SECRET) throw new Error('ACCESS_TOKEN_SECRET is not set');
if (!REFRESH_TOKEN_SECRET) throw new Error('REFRESH_TOKEN_SECRET is not set');

type AccessPayload = {
    subject: string;
    email: string;
};

const refreshTokenStore = new Map<string, string>();

const accessJwtPlugin = jwt({
    name: 'jwtAccess',
    secret: ACCESS_TOKEN_SECRET,
});

const refreshJwtPlugin = jwt({
    name: 'jwtRefresh',
    secret: REFRESH_TOKEN_SECRET,
});

type AccessJwt = typeof accessJwtPlugin.decorator.jwtAccess;
type RefreshJwt = typeof refreshJwtPlugin.decorator.jwtRefresh;

async function signNewTokens(
    jwtAccess: AccessJwt,
    jwtRefresh: RefreshJwt,
    auth: AccessPayload,
) {
    const newAccessToken = await jwtAccess.sign({
        ...auth,
        exp: '10s',
    });
    const newRefreshToken = await jwtRefresh.sign({
        subject: auth.subject,
        exp: '30s',
    });
    return {
        access: newAccessToken,
        refresh: newRefreshToken,
    };
}

function issuesCookies(
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
    accessCookie.httpOnly = true;
    accessCookie.secure = false;
    accessCookie.sameSite = 'lax';
    accessCookie.path = '/';
    accessCookie.domain = 'localhost';
}

async function refreshTokens(
    jwtAccess: AccessJwt,
    jwtRefresh: RefreshJwt,
    accessCookie: Cookie<string | undefined>,
    refreshCookie: Cookie<string | undefined>,
    auth: AccessPayload,
): Promise<
    Result<
        { access: string; refresh: string },
        { code: number; message?: string }
    >
> {
    if (!refreshCookie.value)
        return err({ code: 401, message: 'Unauthorized: no refresh' });

    const refreshToken = await jwtRefresh.verify(refreshCookie.value);
    if (!refreshToken)
        return err({ code: 401, message: 'Unauthorized: refresh invalid' });

    const refreshEntry = refreshTokenStore.get(refreshCookie.value);
    if (!refreshEntry)
        return err({ code: 401, message: 'Unauthorized: no refresh entry' });

    if (refreshToken.subject !== refreshEntry)
        return err({
            code: 401,
            message: 'Unauthorized: refresh subject mismatch',
        });

    const { access: newAccessToken, refresh: newRefreshToken } =
        await signNewTokens(jwtAccess, jwtRefresh, auth);

    refreshTokenStore.set(newRefreshToken, auth.subject);
    refreshTokenStore.delete(refreshCookie.value);
    issuesCookies(newAccessToken, newRefreshToken, accessCookie, refreshCookie);

    return ok({
        access: newAccessToken,
        refresh: newRefreshToken,
    });
}

const app = new Elysia()
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

            issuesCookies(
                accessToken,
                refreshToken,
                accessCookie,
                refreshCookie,
            );

            refreshTokenStore.set(refreshToken, auth.subject);
            return {
                access: accessToken,
                refresh: refreshToken,
            };
        },
    )
    .get('/logout', ({ cookie: { refreshCookie } }) => {
        if (refreshCookie.value) refreshTokenStore.delete(refreshCookie.value);
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
            const auth = {
                subject: 'frk',
                email: 'me@frk.gg',
            };
            const res = await refreshTokens(
                jwtAccess,
                jwtRefresh,
                accessCookie,
                refreshCookie,
                auth,
            );

            if (!res.ok) return status(res.error.code, res.error.message);
            return res.value;
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
                    auth: accessToken as AccessPayload,
                };
            }

            const auth = {
                subject: 'frk',
                email: 'me@frk.gg',
            };

            const res = await refreshTokens(
                jwtAccess,
                jwtRefresh,
                accessCookie,
                refreshCookie,
                auth,
            );

            if (!res.ok) return status(res.error.code, res.error.message);
            return { auth: auth };
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
    })
    .listen(3000);

console.log(
    `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
