import { jwt } from '@elysiajs/jwt';
import { err, ok, type Result } from '@frkgg/shared';
import { type Cookie, Elysia, t } from 'elysia';

import {
    authenticateGithubUser,
    createGithubLoginResponse,
    type FetchLike,
} from './github-oauth';

const DEFAULT_ACCESS_TOKEN_TTL = '10m';
const DEFAULT_REFRESH_TOKEN_TTL = '1d';

type AuthPayload = {
    id: number;
    subject: string;
    email: string;
};

type AppConfig = {
    domain: string;
    accessTokenSecret: string;
    refreshTokenSecret: string;
    githubClientId: string;
    githubClientSecret: string;
    accessTokenTtl?: string;
    refreshTokenTtl?: string;
    oauthStateTtlMs?: number;
    fetchImpl?: FetchLike;
    now?: () => number;
};

export function createApp(appConfig: AppConfig) {
    const siteOrigin = `https://${appConfig.domain}`;
    const authOrigin = `https://auth.${appConfig.domain}`;

    const accessJwtPlugin = jwt({
        name: 'jwtAccess',
        secret: appConfig.accessTokenSecret,
    });
    const refreshJwtPlugin = jwt({
        name: 'jwtRefresh',
        secret: appConfig.refreshTokenSecret,
    });

    const refreshTokenStore = new Map<string, AuthPayload>();
    const oauthStateStore = new Map<
        string,
        {
            returnTo: string;
            expiresAt: number;
        }
    >();
    const fetchImpl = appConfig.fetchImpl ?? fetch;
    const now = appConfig.now ?? Date.now;

    type AccessJwt = typeof accessJwtPlugin.decorator.jwtAccess;
    type RefreshJwt = typeof refreshJwtPlugin.decorator.jwtRefresh;

    async function signNewTokens(
        jwtAccess: AccessJwt,
        jwtRefresh: RefreshJwt,
        auth: AuthPayload,
    ) {
        const accessTokenTtl =
            appConfig.accessTokenTtl ?? DEFAULT_ACCESS_TOKEN_TTL;
        const refreshTokenTtl =
            appConfig.refreshTokenTtl ?? DEFAULT_REFRESH_TOKEN_TTL;

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
        accessCookie.domain = appConfig.domain;

        refreshCookie.value = refreshToken;
        refreshCookie.httpOnly = true;
        refreshCookie.secure = false;
        refreshCookie.sameSite = 'lax';
        refreshCookie.path = '/';
        refreshCookie.domain = appConfig.domain;
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
        accessCookie.domain = appConfig.domain;
        accessCookie.maxAge = 0;
        accessCookie.expires = new Date(0);

        refreshCookie.value = '';
        refreshCookie.httpOnly = true;
        refreshCookie.secure = false;
        refreshCookie.sameSite = 'lax';
        refreshCookie.path = '/';
        refreshCookie.domain = appConfig.domain;
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

    function normalizeReturnTo(returnTo: string | undefined) {
        if (!returnTo) return `${siteOrigin}/`;

        try {
            if (returnTo.startsWith('//')) return `${siteOrigin}/`;

            const hasScheme = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(returnTo);
            const candidateUrl =
                !returnTo.startsWith('/') && !hasScheme
                    ? `https://${returnTo}`
                    : returnTo;

            const targetUrl = new URL(candidateUrl, siteOrigin);
            const isHttps = targetUrl.protocol === 'https:';
            const isExactDomain = targetUrl.hostname === appConfig.domain;
            const isSubdomain = targetUrl.hostname.endsWith(
                `.${appConfig.domain}`,
            );

            if (!isHttps || (!isExactDomain && !isSubdomain)) {
                return `${siteOrigin}/`;
            }

            return targetUrl.toString();
        } catch {
            return `${siteOrigin}/`;
        }
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
            '/login/github',
            ({ query }) => {
                const state = crypto.randomUUID();
                const returnTo = normalizeReturnTo(query.returnTo);
                const expiresAt =
                    now() + (appConfig.oauthStateTtlMs ?? 10 * 60 * 1000);

                oauthStateStore.set(state, { returnTo, expiresAt });

                return createGithubLoginResponse(
                    authOrigin,
                    appConfig.githubClientId,
                    state,
                );
            },
            {
                query: t.Object({
                    returnTo: t.Optional(t.String()),
                }),
            },
        )
        .get(
            '/oauth/github/callback',
            async ({
                jwtAccess,
                jwtRefresh,
                status,
                query,
                cookie: { accessCookie, refreshCookie },
            }) => {
                if (!query.code || !query.state) {
                    return status(400, 'Missing GitHub OAuth code or state');
                }

                const loginState = oauthStateStore.get(query.state);
                oauthStateStore.delete(query.state);

                if (!loginState || loginState.expiresAt < now()) {
                    return status(400, 'GitHub OAuth state invalid or expired');
                }

                const githubAuthRes = await authenticateGithubUser(
                    {
                        authOrigin,
                        githubClientId: appConfig.githubClientId,
                        githubClientSecret: appConfig.githubClientSecret,
                        fetchImpl,
                    },
                    query.code,
                );
                if (!githubAuthRes.ok) {
                    return status(
                        githubAuthRes.error.code,
                        githubAuthRes.error.message,
                    );
                }

                const auth = {
                    id: githubAuthRes.value.id,
                    subject: githubAuthRes.value.login,
                    email: githubAuthRes.value.email,
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

                return new Response(null, {
                    status: 302,
                    headers: {
                        Location: loginState.returnTo,
                    },
                });
            },
            {
                query: t.Object({
                    code: t.Optional(t.String()),
                    state: t.Optional(t.String()),
                }),
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
        .get('/auth', ({ auth, set }) => {
            set.headers['X-Auth-Id'] = String(auth.id);
            set.headers['X-Auth-User'] = auth.subject;
            set.headers['X-Auth-Email'] = auth.email;
            return { ok: true };
        })
        .get('/me', async ({ auth }) => {
            return {
                id: auth.id,
                subject: auth.subject,
                email: auth.email,
            };
        });
}

if (import.meta.main) {
    const DOMAIN = process.env.DOMAIN;
    const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;
    const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET;
    const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
    const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

    if (!DOMAIN) throw new Error('DOMAIN is not set');
    if (!ACCESS_TOKEN_SECRET) throw new Error('ACCESS_TOKEN_SECRET is not set');
    if (!REFRESH_TOKEN_SECRET)
        throw new Error('REFRESH_TOKEN_SECRET is not set');
    if (!GITHUB_CLIENT_ID) throw new Error('GITHUB_CLIENT_ID is not set');
    if (!GITHUB_CLIENT_SECRET)
        throw new Error('GITHUB_CLIENT_SECRET is not set');

    const app = createApp({
        domain: DOMAIN,
        accessTokenSecret: ACCESS_TOKEN_SECRET,
        refreshTokenSecret: REFRESH_TOKEN_SECRET,
        githubClientId: GITHUB_CLIENT_ID,
        githubClientSecret: GITHUB_CLIENT_SECRET,
    });
    app.listen(3000);
    console.log(
        `auth server running at: ${app.server?.hostname}:${app.server?.port}`,
    );
}
