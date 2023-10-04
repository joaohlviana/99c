'use strict';

const { join } = require('path');
const { promisify } = require('util');
const execa = require('execa');
const fs = require('fs-extra');
const glob = promisify(require('glob').glob);

async function run() {
  const packageDirs = await glob('packages/**/*', { ignore: '**/node_modules/**' });

  console.log('Linking all packages');

  const packages = packageDirs
    .filter((dir) => fs.pathExistsSync(join(dir, 'package.json')))
    .map((dir) => {
      return {
        dir,
        pkgJSON: fs.readJSONSync(join(dir, 'package.json')),
      };
    });

  await Promise.all(packages.map(({ dir }) => execa('yarn', ['link'], { cwd: dir })));

  const packageNames = packages.map((p) => p.pkgJSON.name).join(' ');
  console.log(`Package names: \n ${packageNames}\n`);
}

run().catch((error) => console.error(error));
