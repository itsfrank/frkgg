import { describe, expect, it } from 'bun:test';

import { createApp } from './index';

describe('createApp', () => {
    it('returns the authenticated viewer in integrated mode', async () => {
        const app = createApp({ standalone: false });
        const response = await app.handle(
            new Request('http://localhost/api/me', {
                headers: {
                    'x-auth-id': '123',
                    'x-auth-user': 'frank',
                    'x-auth-email': 'frank@example.com',
                },
            }),
        );

        expect(await response.json()).toEqual({
            id: 123,
            username: 'frank',
            email: 'frank@example.com',
        });
    });

    it('returns a personalized hello from the authenticated viewer in integrated mode', async () => {
        const app = createApp({ standalone: false });
        const response = await app.handle(
            new Request('http://localhost/api/hello', {
                headers: {
                    'x-auth-id': '123',
                    'x-auth-user': 'frank',
                    'x-auth-email': 'frank@example.com',
                },
            }),
        );

        expect(await response.text()).toBe('hello frank');
    });

    it('rejects requests without forwarded auth headers in integrated mode', async () => {
        const app = createApp({ standalone: false });
        const response = await app.handle(
            new Request('http://localhost/api/me'),
        );

        expect(response.status).toBe(401);
        expect(await response.text()).toBe('Unauthorized');
    });

    it('returns the mock user in standalone mode', async () => {
        const app = createApp({ standalone: true });
        const response = await app.handle(
            new Request('http://localhost/api/me'),
        );

        expect(await response.json()).toEqual({
            id: 1,
            username: 'dev-user',
            email: 'dev-user@example.com',
        });
    });

    it('supports overriding the standalone mock user', async () => {
        const app = createApp({
            standalone: true,
            standaloneUserId: 77,
            standaloneUsername: 'workbench',
            standaloneEmail: 'workbench@example.com',
        });
        const response = await app.handle(
            new Request('http://localhost/api/hello'),
        );

        expect(await response.text()).toBe('hello workbench');
    });

    it('keeps explicit auth headers in standalone mode', async () => {
        const app = createApp({ standalone: true });
        const response = await app.handle(
            new Request('http://localhost/api/me', {
                headers: {
                    'x-auth-id': '456',
                    'x-auth-user': 'header-user',
                    'x-auth-email': 'header-user@example.com',
                },
            }),
        );

        expect(await response.json()).toEqual({
            id: 456,
            username: 'header-user',
            email: 'header-user@example.com',
        });
    });

    it('rejects requests with a missing user id in integrated mode', async () => {
        const app = createApp({ standalone: false });
        const response = await app.handle(
            new Request('http://localhost/api/me', {
                headers: {
                    'x-auth-user': 'frank',
                    'x-auth-email': 'frank@example.com',
                },
            }),
        );

        expect(response.status).toBe(401);
        expect(await response.text()).toBe('Unauthorized');
    });

    it('throws when the standalone user id is invalid', () => {
        expect(() =>
            createApp({
                standalone: true,
                standaloneUserId: 'abc',
            }),
        ).toThrow(
            'FIT_STANDALONE_USER_ID must be a positive integer when standalone mode is enabled',
        );
    });
});
