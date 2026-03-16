import { Elysia, t } from 'elysia';

export function createApp() {
    return new Elysia().get(
        '/hello',
        ({ query }) => `hello ${query.username}`,
        {
            query: t.Object({
                username: t.Optional(t.String({ default: 'friend' })),
            }),
        },
    );
}

const port = Number(process.env.PORT ?? 3003);

if (import.meta.main) {
    createApp().listen(port);

    console.log(`fit-api listening on http://localhost:${port}`);
}
