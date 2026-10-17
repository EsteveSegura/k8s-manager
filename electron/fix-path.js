const { execFileSync } = require('node:child_process');

const MARKER = '__K8S_MANAGER_PATH__';

// Replaces process.env.PATH with the one from the user's login shell. The
// markers let us ignore anything the shell rc files print to stdout. On any
// failure the current PATH is kept, so startup never breaks because of this.
function fixPath() {
  if (process.platform === 'win32') return;

  const shell = process.env.SHELL || (process.platform === 'darwin' ? '/bin/zsh' : '/bin/sh');
  try {
    const output = execFileSync(shell, ['-ilc', `printf '${MARKER}%s${MARKER}' "$PATH"`], {
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const shellPath = output.split(MARKER)[1];
    if (shellPath) process.env.PATH = shellPath;
  } catch {
    // Keep the inherited PATH.
  }
}

module.exports = { fixPath };
