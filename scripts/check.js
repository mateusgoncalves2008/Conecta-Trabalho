'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const sourceDirectories = ['backend', 'frontend/js', 'scripts'];
const files = [];

function collectJavaScript(directory) {
  const absoluteDirectory = path.join(projectRoot, directory);
  if (!fs.existsSync(absoluteDirectory)) return;

  for (const entry of fs.readdirSync(absoluteDirectory, { withFileTypes: true })) {
    const absolutePath = path.join(absoluteDirectory, entry.name);
    if (entry.isDirectory()) {
      collectJavaScript(path.relative(projectRoot, absolutePath));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(absolutePath);
    }
  }
}

for (const directory of sourceDirectories) collectJavaScript(directory);

files.sort();
let failed = false;

for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.error) {
    console.error('Não foi possível verificar ' + path.relative(projectRoot, file) + ':', result.error.message);
    failed = true;
  } else if (result.status !== 0) {
    failed = true;
  }
}

if (failed) process.exitCode = 1;
else console.log('Sintaxe válida em ' + files.length + ' arquivos JavaScript.');
