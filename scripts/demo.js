// `npm run demo` — starts the app in demo mode (no Supabase, no AI key needed) and opens it in the browser.
const { spawn } = require('node:child_process');

const port = process.env.PORT || '8081';
const child = spawn('npx', ['expo', 'start', '--web', '--clear', '--port', port], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, EXPO_PUBLIC_DEMO: '1' },
});
child.on('exit', (code) => process.exit(code ?? 0));
