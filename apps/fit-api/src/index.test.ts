import { describe, expect, it } from 'bun:test';

import { createApp } from './index';

describe('createApp', () => {
    it('returns a personalized hello', async () => {
        const app = createApp();
        const response = await app.handle(
            new Request('http://localhost/hello?username=frank'),
        );

        expect(await response.text()).toBe('hello frank');
    });

    it('falls back to friend', async () => {
        const app = createApp();
        const response = await app.handle(
            new Request('http://localhost/hello'),
        );

        expect(await response.text()).toBe('hello friend');
    });
});
