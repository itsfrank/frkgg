import { describe, expect, mock, test } from 'bun:test';

import { createApp } from './index';

type MockResponseInit = {
    ok?: boolean;
    status?: number;
    body: unknown;
};

function createFetchMock(responses: MockResponseInit[]) {
    return mock(async () => {
        const next = responses.shift();
        if (!next) throw new Error('Unexpected fetch call');

        return new Response(JSON.stringify(next.body), {
            status: next.status ?? (next.ok === false ? 500 : 200),
            headers: {
                'Content-Type': 'application/json',
            },
        });
    });
}

function createTestApp(
    overrides?: Partial<Parameters<typeof createApp>[0]>,
    nowValue = 1_700_000_000_000,
) {
    return createApp({
        domain: 'frk.localhost',
        accessTokenSecret: 'test-access-secret',
        refreshTokenSecret: 'test-refresh-secret',
        githubClientId: 'github-client-id',
        githubClientSecret: 'github-client-secret',
        fetchImpl: createFetchMock([]),
        now: () => nowValue,
        ...overrides,
    });
}

function getSetCookie(response: Response, name: string) {
    return response.headers
        .getSetCookie()
        .find((entry) => entry.startsWith(`${name}=`));
}

function getCookieValue(response: Response, name: string) {
    const cookie = getSetCookie(response, name);
    if (!cookie) return undefined;

    const [cookieValue] = cookie.split(';', 1);
    return cookieValue?.slice(`${name}=`.length);
}

function getCookieHeader(response: Response) {
    return response.headers
        .getSetCookie()
        .map((cookie) => cookie.split(';', 1)[0])
        .join('; ');
}

async function startLogin(
    app: ReturnType<typeof createTestApp>,
    returnTo = '/private?tab=1',
) {
    const response = await app.handle(
        new Request(
            `http://localhost/login/github?returnTo=${encodeURIComponent(returnTo)}`,
        ),
    );
    const location = response.headers.get('location');
    if (!location) throw new Error('Missing login redirect location');

    const url = new URL(location);
    const state = url.searchParams.get('state');
    if (!state) throw new Error('Missing OAuth state');

    return {
        response,
        location,
        state,
    };
}

async function completeGithubLogin(
    app: ReturnType<typeof createTestApp>,
    options?: {
        returnTo?: string;
        code?: string;
    },
) {
    const { state } = await startLogin(app, options?.returnTo);
    const code = options?.code ?? 'github-code';

    const response = await app.handle(
        new Request(
            `http://localhost/oauth/github/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`,
        ),
    );

    return {
        response,
        cookieHeader: getCookieHeader(response),
        accessCookie: getCookieValue(response, 'accessCookie'),
        refreshCookie: getCookieValue(response, 'refreshCookie'),
    };
}

describe('auth app', () => {
    test('login/github redirects to GitHub and stores returnTo state', async () => {
        const app = createTestApp();

        const { response, location } = await startLogin(app, '/vault?from=hero');

        expect(response.status).toBe(302);
        expect(location).toStartWith(
            'https://github.com/login/oauth/authorize?',
        );

        const authorizeUrl = new URL(location);
        expect(authorizeUrl.searchParams.get('client_id')).toBe(
            'github-client-id',
        );
        expect(authorizeUrl.searchParams.get('redirect_uri')).toBe(
            'https://auth.frk.localhost/oauth/github/callback',
        );
        expect(authorizeUrl.searchParams.get('scope')).toBe(
            'read:user user:email',
        );
        expect(authorizeUrl.searchParams.get('state')).toBeString();
    });

    test('login/github falls back to root for invalid returnTo values', async () => {
        const fetchMock = createFetchMock([
            {
                body: { access_token: 'github-access-token' },
            },
            {
                body: {
                    id: 123,
                    login: 'itsfrank',
                    email: 'me@frk.gg',
                },
            },
        ]);
        const app = createTestApp({
            fetchImpl: fetchMock,
        });

        const { state } = await startLogin(app, 'https://evil.example/steal');
        const callback = await app.handle(
            new Request(
                `http://localhost/oauth/github/callback?code=github-code&state=${state}`,
            ),
        );

        expect(callback.status).toBe(302);
        expect(callback.headers.get('location')).toBe('https://frk.localhost/');
    });

    test('login/github accepts absolute root-domain returnTo values', async () => {
        const app = createTestApp({
            fetchImpl: createFetchMock([
                {
                    body: { access_token: 'github-access-token' },
                },
                {
                    body: {
                        id: 123,
                        login: 'itsfrank',
                        email: 'me@frk.gg',
                    },
                },
            ]),
        });

        const { response } = await completeGithubLogin(app, {
            returnTo: 'https://frk.localhost/account?tab=profile',
        });

        expect(response.status).toBe(302);
        expect(response.headers.get('location')).toBe(
            'https://frk.localhost/account?tab=profile',
        );
    });

    test('login/github accepts absolute subdomain returnTo values', async () => {
        const app = createTestApp({
            fetchImpl: createFetchMock([
                {
                    body: { access_token: 'github-access-token' },
                },
                {
                    body: {
                        id: 123,
                        login: 'itsfrank',
                        email: 'me@frk.gg',
                    },
                },
            ]),
        });

        const { response } = await completeGithubLogin(app, {
            returnTo: 'https://notes.frk.localhost/page?view=full',
        });

        expect(response.status).toBe(302);
        expect(response.headers.get('location')).toBe(
            'https://notes.frk.localhost/page?view=full',
        );
    });

    test('login/github accepts bare subdomain returnTo values without https scheme', async () => {
        const app = createTestApp({
            fetchImpl: createFetchMock([
                {
                    body: { access_token: 'github-access-token' },
                },
                {
                    body: {
                        id: 123,
                        login: 'itsfrank',
                        email: 'me@frk.gg',
                    },
                },
            ]),
        });

        const { response } = await completeGithubLogin(app, {
            returnTo: 'auth.frk.localhost/me',
        });

        expect(response.status).toBe(302);
        expect(response.headers.get('location')).toBe(
            'https://auth.frk.localhost/me',
        );
    });

    test('login/github rejects bare off-domain returnTo values without https scheme', async () => {
        const app = createTestApp({
            fetchImpl: createFetchMock([
                {
                    body: { access_token: 'github-access-token' },
                },
                {
                    body: {
                        id: 123,
                        login: 'itsfrank',
                        email: 'me@frk.gg',
                    },
                },
            ]),
        });

        const { response } = await completeGithubLogin(app, {
            returnTo: 'evil.example/steal',
        });

        expect(response.status).toBe(302);
        expect(response.headers.get('location')).toBe('https://frk.localhost/');
    });

    test('login/github rejects http subdomain returnTo values', async () => {
        const app = createTestApp({
            fetchImpl: createFetchMock([
                {
                    body: { access_token: 'github-access-token' },
                },
                {
                    body: {
                        id: 123,
                        login: 'itsfrank',
                        email: 'me@frk.gg',
                    },
                },
            ]),
        });

        const { response } = await completeGithubLogin(app, {
            returnTo: 'http://notes.frk.localhost/page',
        });

        expect(response.status).toBe(302);
        expect(response.headers.get('location')).toBe('https://frk.localhost/');
    });

    test('login/github rejects protocol-relative returnTo values', async () => {
        const app = createTestApp({
            fetchImpl: createFetchMock([
                {
                    body: { access_token: 'github-access-token' },
                },
                {
                    body: {
                        id: 123,
                        login: 'itsfrank',
                        email: 'me@frk.gg',
                    },
                },
            ]),
        });

        const { response } = await completeGithubLogin(app, {
            returnTo: '//evil.example/path',
        });

        expect(response.status).toBe(302);
        expect(response.headers.get('location')).toBe('https://frk.localhost/');
    });

    test('callback rejects requests missing code or state', async () => {
        const app = createTestApp();

        const missingCode = await app.handle(
            new Request('http://localhost/oauth/github/callback?state=abc'),
        );
        expect(missingCode.status).toBe(400);
        expect(await missingCode.text()).toBe('Missing GitHub OAuth code or state');

        const missingState = await app.handle(
            new Request('http://localhost/oauth/github/callback?code=abc'),
        );
        expect(missingState.status).toBe(400);
        expect(await missingState.text()).toBe('Missing GitHub OAuth code or state');
    });

    test('callback rejects invalid state', async () => {
        const app = createTestApp();

        const callback = await app.handle(
            new Request(
                'http://localhost/oauth/github/callback?code=github-code&state=missing',
            ),
        );

        expect(callback.status).toBe(400);
        expect(await callback.text()).toBe('GitHub OAuth state invalid or expired');
    });

    test('callback rejects expired state', async () => {
        let nowValue = 1_700_000_000_000;
        const app = createApp({
            domain: 'frk.localhost',
            accessTokenSecret: 'test-access-secret',
            refreshTokenSecret: 'test-refresh-secret',
            githubClientId: 'github-client-id',
            githubClientSecret: 'github-client-secret',
            oauthStateTtlMs: 10,
            fetchImpl: createFetchMock([]),
            now: () => nowValue,
        });

        const { state } = await startLogin(app);
        nowValue += 11;

        const callback = await app.handle(
            new Request(
                `http://localhost/oauth/github/callback?code=github-code&state=${state}`,
            ),
        );

        expect(callback.status).toBe(400);
        expect(await callback.text()).toBe('GitHub OAuth state invalid or expired');
    });

    test('callback rejects when GitHub token exchange fails', async () => {
        const app = createTestApp({
            fetchImpl: createFetchMock([
                {
                    ok: false,
                    status: 500,
                    body: { error: 'bad_verification_code' },
                },
            ]),
        });

        const { state } = await startLogin(app);
        const callback = await app.handle(
            new Request(
                `http://localhost/oauth/github/callback?code=github-code&state=${state}`,
            ),
        );

        expect(callback.status).toBe(502);
        expect(await callback.text()).toBe('GitHub token exchange failed');
    });

    test('callback rejects users not in the allowlist', async () => {
        const app = createTestApp({
            fetchImpl: createFetchMock([
                {
                    body: { access_token: 'github-access-token' },
                },
                {
                    body: {
                        id: 456,
                        login: 'someone-else',
                        email: 'someone@example.com',
                    },
                },
            ]),
        });

        const { state } = await startLogin(app);
        const callback = await app.handle(
            new Request(
                `http://localhost/oauth/github/callback?code=github-code&state=${state}`,
            ),
        );

        expect(callback.status).toBe(403);
        expect(await callback.text()).toBe(
            'Forbidden: GitHub user is not allowed',
        );
    });

    test('successful callback sets auth cookies and redirects to returnTo', async () => {
        const fetchMock = createFetchMock([
            {
                body: { access_token: 'github-access-token' },
            },
            {
                body: {
                    id: 123,
                    login: 'itsfrank',
                    email: 'me@frk.gg',
                },
            },
        ]);
        const app = createTestApp({
            fetchImpl: fetchMock,
        });

        const { response, accessCookie, refreshCookie } = await completeGithubLogin(
            app,
            {
                returnTo: '/private?tab=1',
            },
        );

        expect(response.status).toBe(302);
        expect(response.headers.get('location')).toBe(
            'https://frk.localhost/private?tab=1',
        );
        expect(accessCookie).toBeString();
        expect(refreshCookie).toBeString();
        expect(getSetCookie(response, 'accessCookie')).toContain('HttpOnly');
        expect(getSetCookie(response, 'refreshCookie')).toContain('HttpOnly');
    });

    test('callback falls back to a noreply email when GitHub profile and email API do not provide one', async () => {
        const app = createTestApp({
            fetchImpl: createFetchMock([
                {
                    body: { access_token: 'github-access-token' },
                },
                {
                    body: {
                        id: 123,
                        login: 'itsfrank',
                        email: null,
                    },
                },
                {
                    body: [],
                },
            ]),
        });

        const loginResponse = await completeGithubLogin(app);
        const me = await app.handle(
            new Request('http://localhost/me', {
                headers: { cookie: loginResponse.cookieHeader },
            }),
        );

        expect(me.status).toBe(200);
        expect(await me.json()).toEqual({
            subject: 'itsfrank',
            email: 'itsfrank@users.noreply.github.com',
        });
    });

    test('auth succeeds with valid login cookies', async () => {
        const app = createTestApp({
            fetchImpl: createFetchMock([
                {
                    body: { access_token: 'github-access-token' },
                },
                {
                    body: {
                        id: 123,
                        login: 'itsfrank',
                        email: 'me@frk.gg',
                    },
                },
            ]),
        });
        const { cookieHeader } = await completeGithubLogin(app);

        const auth = await app.handle(
            new Request('http://localhost/auth', {
                headers: { cookie: cookieHeader },
            }),
        );

        expect(auth.status).toBe(200);
        expect(await auth.json()).toEqual({ ok: true });
    });

    test('current user returned when access cookie is present', async () => {
        const app = createTestApp({
            fetchImpl: createFetchMock([
                {
                    body: { access_token: 'github-access-token' },
                },
                {
                    body: {
                        id: 123,
                        login: 'itsfrank',
                        email: 'me@frk.gg',
                    },
                },
            ]),
        });
        const { cookieHeader } = await completeGithubLogin(app);

        const me = await app.handle(
            new Request('http://localhost/me', {
                headers: { cookie: cookieHeader },
            }),
        );

        expect(me.status).toBe(200);
        expect(await me.json()).toEqual({
            subject: 'itsfrank',
            email: 'me@frk.gg',
        });
    });

    test('me rejects requests without cookies', async () => {
        const app = createTestApp();

        const me = await app.handle(new Request('http://localhost/me'));

        expect(me.status).toBe(401);
        expect(await me.text()).toBe('Unauthorized: no refresh');
    });

    test('auth rejects requests without cookies', async () => {
        const app = createTestApp();

        const auth = await app.handle(new Request('http://localhost/auth'));

        expect(auth.status).toBe(401);
        expect(await auth.text()).toBe('Unauthorized: no refresh');
    });

    test('refresh rejects requests without a refresh cookie', async () => {
        const app = createTestApp();

        const refresh = await app.handle(
            new Request('http://localhost/refresh'),
        );

        expect(refresh.status).toBe(401);
        expect(await refresh.text()).toBe('Unauthorized: no refresh');
    });

    test('refresh rejects invalid refresh cookies', async () => {
        const app = createTestApp();

        const refresh = await app.handle(
            new Request('http://localhost/refresh', {
                headers: {
                    cookie: 'refreshCookie=not-a-valid-token',
                },
            }),
        );

        expect(refresh.status).toBe(401);
        expect(await refresh.text()).toBe('Unauthorized: refresh invalid');
    });

    test('me refreshes automatically when access token expires but refresh token is still valid', async () => {
        const app = createTestApp(
            {
                accessTokenTtl: '1s',
                refreshTokenTtl: '10s',
                fetchImpl: createFetchMock([
                    {
                        body: { access_token: 'github-access-token' },
                    },
                    {
                        body: {
                            id: 123,
                            login: 'itsfrank',
                            email: 'me@frk.gg',
                        },
                    },
                ]),
            },
        );
        const loginResponse = await completeGithubLogin(app);

        await Bun.sleep(1100);

        const me = await app.handle(
            new Request('http://localhost/me', {
                headers: {
                    cookie: loginResponse.cookieHeader,
                },
            }),
        );

        expect(me.status).toBe(200);
        expect(await me.json()).toEqual({
            subject: 'itsfrank',
            email: 'me@frk.gg',
        });
        expect(getCookieValue(me, 'accessCookie')).not.toBe(
            loginResponse.accessCookie,
        );
        expect(getCookieValue(me, 'refreshCookie')).not.toBe(
            loginResponse.refreshCookie,
        );
    });

    test('refresh rotates access and refresh cookies', async () => {
        const app = createTestApp({
            fetchImpl: createFetchMock([
                {
                    body: { access_token: 'github-access-token' },
                },
                {
                    body: {
                        id: 123,
                        login: 'itsfrank',
                        email: 'me@frk.gg',
                    },
                },
            ]),
        });
        const loginResponse = await completeGithubLogin(app);

        const refresh = await app.handle(
            new Request('http://localhost/refresh', {
                headers: {
                    cookie: loginResponse.cookieHeader,
                },
            }),
        );

        expect(refresh.status).toBe(200);
        expect(await refresh.json()).toEqual({
            accessToken: getCookieValue(refresh, 'accessCookie'),
            refreshToken: getCookieValue(refresh, 'refreshCookie'),
        });
        expect(getCookieValue(refresh, 'accessCookie')).not.toBe(
            loginResponse.accessCookie,
        );
        expect(getCookieValue(refresh, 'refreshCookie')).not.toBe(
            loginResponse.refreshCookie,
        );
    });

    test('old refresh token cannot be reused after rotation', async () => {
        const app = createTestApp({
            fetchImpl: createFetchMock([
                {
                    body: { access_token: 'github-access-token' },
                },
                {
                    body: {
                        id: 123,
                        login: 'itsfrank',
                        email: 'me@frk.gg',
                    },
                },
            ]),
        });
        const firstLogin = await completeGithubLogin(app);

        const refresh = await app.handle(
            new Request('http://localhost/refresh', {
                headers: {
                    cookie: firstLogin.cookieHeader,
                },
            }),
        );

        expect(refresh.status).toBe(200);

        const replay = await app.handle(
            new Request('http://localhost/refresh', {
                headers: {
                    cookie: firstLogin.cookieHeader,
                },
            }),
        );

        expect(replay.status).toBe(401);
        expect(await replay.text()).toBe('Unauthorized: no refresh entry');
    });

    test('new refresh cookie can be used after rotation', async () => {
        const app = createTestApp({
            fetchImpl: createFetchMock([
                {
                    body: { access_token: 'github-access-token' },
                },
                {
                    body: {
                        id: 123,
                        login: 'itsfrank',
                        email: 'me@frk.gg',
                    },
                },
            ]),
        });
        const firstLogin = await completeGithubLogin(app);

        const refresh = await app.handle(
            new Request('http://localhost/refresh', {
                headers: {
                    cookie: firstLogin.cookieHeader,
                },
            }),
        );

        const secondRefresh = await app.handle(
            new Request('http://localhost/refresh', {
                headers: {
                    cookie: getCookieHeader(refresh),
                },
            }),
        );

        expect(secondRefresh.status).toBe(200);
        expect(getCookieValue(secondRefresh, 'refreshCookie')).toBeString();
    });

    test('logout clears both cookies', async () => {
        const app = createTestApp({
            fetchImpl: createFetchMock([
                {
                    body: { access_token: 'github-access-token' },
                },
                {
                    body: {
                        id: 123,
                        login: 'itsfrank',
                        email: 'me@frk.gg',
                    },
                },
            ]),
        });
        const { cookieHeader } = await completeGithubLogin(app);

        const logout = await app.handle(
            new Request('http://localhost/logout', {
                headers: { cookie: cookieHeader },
            }),
        );

        expect(logout.status).toBe(200);
        expect(await logout.json()).toEqual({ ok: true });
        expect(getSetCookie(logout, 'accessCookie')).toContain('Max-Age=0');
        expect(getSetCookie(logout, 'refreshCookie')).toContain('Max-Age=0');
        expect(getCookieValue(logout, 'accessCookie')).toBe('');
        expect(getCookieValue(logout, 'refreshCookie')).toBe('');
    });

    test('logout invalidates the existing refresh token', async () => {
        const app = createTestApp({
            fetchImpl: createFetchMock([
                {
                    body: { access_token: 'github-access-token' },
                },
                {
                    body: {
                        id: 123,
                        login: 'itsfrank',
                        email: 'me@frk.gg',
                    },
                },
            ]),
        });
        const { cookieHeader } = await completeGithubLogin(app);

        const logout = await app.handle(
            new Request('http://localhost/logout', {
                headers: { cookie: cookieHeader },
            }),
        );

        expect(logout.status).toBe(200);

        const refresh = await app.handle(
            new Request('http://localhost/refresh', {
                headers: { cookie: cookieHeader },
            }),
        );

        expect(refresh.status).toBe(401);
        expect(await refresh.text()).toBe('Unauthorized: no refresh entry');
    });

    test('logout is safe without cookies', async () => {
        const app = createTestApp();

        const logout = await app.handle(new Request('http://localhost/logout'));

        expect(logout.status).toBe(200);
        expect(await logout.json()).toEqual({ ok: true });
    });
});
