// Crea una Pull Request en GitHub con la API (sin GitHub CLI, Node puro).
// Uso:  npm run pr -- "Título de la PR" [--body-file ruta.md] [--base main] [--dry-run]
// Token: variable GH_TOKEN (o GITHUB_TOKEN), sesión de GitHub CLI (gh auth) o las
// credenciales que Git tiene guardadas para github.com. La rama debe estar subida
// antes (git push -u origin <rama>).
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

function git(args) {
  const r = spawnSync('git', args, { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} falló: ${r.stderr.trim()}`);
  return r.stdout.trim();
}

function parseArgs(argv) {
  const opts = { title: null, base: 'main', bodyFile: null, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--base') opts.base = argv[++i];
    else if (a === '--body-file') opts.bodyFile = argv[++i];
    else if (a === '--dry-run') opts.dryRun = true;
    else if (!opts.title) opts.title = a;
    else throw new Error(`argumento desconocido: ${a}`);
  }
  return opts;
}

function repoFromRemote(url) {
  const m = url.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?\/?$/);
  if (!m) throw new Error(`el remoto 'origin' no es de GitHub: ${url}`);
  return { owner: m[1], repo: m[2] };
}

function findToken() {
  if (process.env.GH_TOKEN) return { token: process.env.GH_TOKEN, source: 'variable GH_TOKEN' };
  if (process.env.GITHUB_TOKEN) return { token: process.env.GITHUB_TOKEN, source: 'variable GITHUB_TOKEN' };
  const gh = spawnSync('gh', ['auth', 'token', '--hostname', 'github.com'], { encoding: 'utf8' });
  if (gh.status === 0 && gh.stdout.trim()) return { token: gh.stdout.trim(), source: 'sesión de gh' };
  const r = spawnSync('git', ['credential', 'fill'], {
    encoding: 'utf8',
    input: 'protocol=https\nhost=github.com\n\n',
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  });
  const m = r.stdout?.match(/^password=(.+)$/m);
  if (m) return { token: m[1].trim(), source: 'credenciales de Git' };
  return null;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.title) throw new Error('falta el título: npm run pr -- "Título de la PR"');

  const branch = git(['branch', '--show-current']);
  if (!branch) throw new Error('no estás en una rama (HEAD suelto)');
  if (branch === opts.base) throw new Error(`estás en la rama base '${opts.base}': crea una rama para la PR`);

  const { owner, repo } = repoFromRemote(git(['remote', 'get-url', 'origin']));
  const payload = {
    title: opts.title,
    head: branch,
    base: opts.base,
    body: opts.bodyFile ? fs.readFileSync(opts.bodyFile, 'utf8') : '',
  };
  const url = `https://api.github.com/repos/${owner}/${repo}/pulls`;

  const cred = findToken();
  if (opts.dryRun) {
    console.log(`POST ${url}`);
    console.log(JSON.stringify(payload, null, 2));
    console.log(cred ? `token: encontrado (${cred.source})` : 'token: NO encontrado');
    return;
  }
  if (!cred) {
    throw new Error('no hay token: define GH_TOKEN o guarda las credenciales de GitHub en Git');
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cred.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json; charset=utf-8',
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detalle = (data.errors ?? []).map((e) => e.message).join('; ');
    throw new Error(`GitHub respondió ${res.status}: ${data.message ?? ''}${detalle ? ` (${detalle})` : ''}`);
  }
  console.log(data.html_url);
}

main().catch((e) => {
  console.error(`ERROR: ${e.message}`);
  process.exit(1);
});
