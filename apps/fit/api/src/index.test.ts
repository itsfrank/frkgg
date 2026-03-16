import { describe, expect, it } from 'bun:test';

import { createApp } from './index';

describe('createApp', () => {
    it('returns the authenticated viewer', async () => {
        const app = createApp();
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

    it('returns a personalized hello from the authenticated viewer', async () => {
        const app = createApp();
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

    it('rejects requests without forwarded auth headers', async () => {
        const app = createApp();
        const response = await app.handle(new Request('http://localhost/api/me'));

        expect(response.status).toBe(401);
        expect(await response.text()).toBe('Unauthorized');
    });
});
