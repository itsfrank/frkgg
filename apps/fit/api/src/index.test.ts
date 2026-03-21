import { describe, expect, it } from 'bun:test';

import { createApp } from './index';

describe('createApp', () => {
    it('returns the authenticated viewer in integrated mode', async () => {
        const app = createApp({ standalone: false });
        const response = await app.handle(
            new Request('http://localhost/api/me', {
                headers: {
                    'x-auth-user': 'frank',
                    'x-auth-email': 'frank@example.com',
                },
            }),
        );

        expect(await response.json()).toEqual({
            username: 'frank',
            email: 'frank@example.com',
        });
    });

    it('returns a personalized hello from the authenticated viewer in integrated mode', async () => {
        const app = createApp({ standalone: false });
        const response = await app.handle(
            new Request('http://localhost/api/hello', {
                headers: {
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
            username: 'dev-user',
            email: 'dev-user@example.com',
        });
    });

    it('supports overriding the standalone mock user', async () => {
        const app = createApp({
            standalone: true,
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
                    'x-auth-user': 'header-user',
                    'x-auth-email': 'header-user@example.com',
                },
            }),
        );

        expect(await response.json()).toEqual({
            username: 'header-user',
            email: 'header-user@example.com',
        });
    });
});
