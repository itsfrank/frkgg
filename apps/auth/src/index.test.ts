import { describe, expect, test } from 'bun:test';

import { createApp } from './index';

function createTestApp(overrides?: Partial<Parameters<typeof createApp>[0]>) {
    return createApp({
        domain: 'frk.localhost',
        accessTokenSecret: 'test-access-secret',
        refreshTokenSecret: 'test-refresh-secret',
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

async function login(app: ReturnType<typeof createTestApp>) {
    const response = await app.handle(new Request('http://localhost/login'));

    return {
        response,
        body: await response.json(),
        cookieHeader: getCookieHeader(response),
        accessCookie: getCookieValue(response, 'accessCookie'),
        refreshCookie: getCookieValue(response, 'refreshCookie'),
    };
}

describe('auth app', () => {
    test('login returns tokens and sets both auth cookies with expected attributes', async () => {
        const app = createTestApp();
        const { response, body, accessCookie, refreshCookie } =
            await login(app);

        expect(response.status).toBe(200);
        expect(body).toEqual({
            access: accessCookie,
            refresh: refreshCookie,
        });

        expect(getSetCookie(response, 'accessCookie')).toContain('HttpOnly');
        expect(getSetCookie(response, 'accessCookie')).toContain(
            'SameSite=Lax',
        );
        expect(getSetCookie(response, 'accessCookie')).toContain('Path=/');
        expect(getSetCookie(response, 'accessCookie')).toContain(
            'Domain=frk.localhost',
        );
        expect(getSetCookie(response, 'refreshCookie')).toContain('HttpOnly');
        expect(getSetCookie(response, 'refreshCookie')).toContain(
            'SameSite=Lax',
        );
        expect(getSetCookie(response, 'refreshCookie')).toContain('Path=/');
        expect(getSetCookie(response, 'refreshCookie')).toContain(
            'Domain=frk.localhost',
        );
    });

    test('auth succeeds with valid login cookies', async () => {
        const app = createTestApp();
        const { cookieHeader } = await login(app);

        const auth = await app.handle(
            new Request('http://localhost/auth', {
                headers: { cookie: cookieHeader },
            }),
        );

        expect(auth.status).toBe(200);
        expect(await auth.json()).toEqual({ ok: true });
    });

    test('current user returned when access cookie is present', async () => {
        const app = createTestApp();
        const { cookieHeader } = await login(app);

        const me = await app.handle(
            new Request('http://localhost/me', {
                headers: { cookie: cookieHeader },
            }),
        );

        expect(me.status).toBe(200);
        expect(await me.json()).toEqual({
            subject: 'frk',
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
        const app = createTestApp({
            accessTokenTtl: '1s',
            refreshTokenTtl: '10s',
        });
        const loginResponse = await login(app);

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
            subject: 'frk',
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
        const app = createTestApp();
        const loginResponse = await login(app);

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
        const app = createTestApp();
        const firstLogin = await login(app);

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
        const app = createTestApp();
        const firstLogin = await login(app);

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
        const app = createTestApp();
        const { cookieHeader } = await login(app);

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
        const app = createTestApp();
        const { cookieHeader } = await login(app);

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
