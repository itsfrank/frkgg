import { describe, expect, test } from 'bun:test';

import { createApp } from './index';

function getCookieHeader(response: Response) {
    const cookies = response.headers.getSetCookie();
    return cookies.map((cookie) => cookie.split(';', 1)[0]).join('; ');
}

describe('auth app', () => {
    test('auth cookies set on login', async () => {
        const app = createApp({
            accessTokenSecret: 'test-access-secret',
            refreshTokenSecret: 'test-refresh-secret',
        });

        const response = await app.handle(
            new Request('http://localhost/login'),
        );
        const cookies = response.headers.getSetCookie();

        expect(response.status).toBe(200);
        expect(
            cookies.some((cookie) => cookie.startsWith('accessCookie=')),
        ).toBe(true);
        expect(
            cookies.some((cookie) => cookie.startsWith('refreshCookie=')),
        ).toBe(true);
    });

    test('current user returned when access cookie is present', async () => {
        const app = createApp({
            accessTokenSecret: 'test-access-secret',
            refreshTokenSecret: 'test-refresh-secret',
        });

        const login = await app.handle(new Request('http://localhost/login'));
        const cookieHeader = getCookieHeader(login);

        const me = await app.handle(
            new Request('http://localhost/me', {
                headers: {
                    cookie: cookieHeader,
                },
            }),
        );

        expect(me.status).toBe(200);
        expect(await me.json()).toEqual({
            subject: 'frk',
            email: 'me@frk.gg',
        });
    });
});
