import { Elysia } from 'elysia';

export function createApp() {
    return new Elysia()
        .derive(({ request, status }) => {
            const username = request.headers.get('x-auth-user');
            const email = request.headers.get('x-auth-email');

            if (!username || !email) {
                return status(401, 'Unauthorized');
            }

            return {
                auth: {
                    username,
                    email,
                },
            };
        })
        .get('/api/me', ({ auth }) => ({
            username: auth.username,
            email: auth.email,
        }))
        .get('/api/hello', ({ auth }) => `hello ${auth.username}`);
}

const port = Number(process.env.PORT ?? 3003);

if (import.meta.main) {
    createApp().listen(port);

    console.log(`fit-api listening on http://localhost:${port}`);
}
