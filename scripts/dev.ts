import concurrently from 'concurrently';

const commands = [
    {
        command: 'caddy run --config ./Caddyfile.dev',
        name: 'caddy',
        prefixColor: 'blue',
    },
    {
        command: 'bun run --filter auth dev',
        name: 'auth',
        prefixColor: 'green',
    },
    {
        command: 'bun run --filter site dev',
        name: 'site',
        prefixColor: 'yellow',
    },
];

const { result } = concurrently(commands, {
    killOthers: ['failure', 'success'],
    prefix: 'name',
});

try {
    await result;
} catch {
    process.exitCode = 1;
}
