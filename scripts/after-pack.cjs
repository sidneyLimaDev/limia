const { execFileSync } = require('node:child_process');
const { readdirSync, statSync } = require('node:fs');
const path = require('node:path');

function walk(directory) {
  for (const entry of readdirSync(directory)) {
    const filePath = path.join(directory, entry);
    const stats = statSync(filePath);
    if (stats.isDirectory()) walk(filePath);
    else {
      try {
        execFileSync('codesign', ['--remove-signature', filePath], { stdio: 'ignore' });
      } catch {
      }
    }
  }
}

exports.default = async function afterPack(context) {
  if (context.electronPlatformName === 'darwin') walk(context.appOutDir);
};