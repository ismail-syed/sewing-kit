import 'core-js/features/array/flat';
import 'core-js/features/array/flat-map';

import {resolve, dirname} from 'path';
import {Readable, Writable} from 'stream';

// import fs from 'fs';
// import {
//   mkdir,
//   // mkdirp,
//   // mkdirpSync,
//   rmdir,
//   writeFile,
//   writeFileSync,
//   readFile,
//   // pathExists,
//   // emptyDir,
// } from 'fs';
import {vol, Volume, fs} from 'memfs';
import toTree from 'tree-node-cli';

// import {patchFsExtra} from '../patch-fs-extra';
import {patchFs} from 'fs-monkey';

const commandMap = {
  build: () => import('../../packages/cli/src/build').then(({build}) => build),
};

type CommandMap = typeof commandMap;

class TestOutputStream extends Writable {
  private buffer = '';

  _write(buffer: Buffer) {
    this.buffer += buffer.toString();
  }

  toString() {
    return this.buffer;
  }
}

export class Workspace {
  private commandFinished = false;
  constructor(public readonly root: string) {}

  async run<K extends keyof CommandMap>(command: K, args: string[] = []) {
    const stdout = new TestOutputStream();
    const stderr = new TestOutputStream();
    const stdin = new Readable();
    patchFs(vol);

    try {
      await (await commandMap[command]())([...args, '--root', this.root], {
        __internal: {stdin, stdout, stderr},
      });
    } finally {
      this.commandFinished = true;
      // vol.reset();
    }
  }

  writeConfig(contents: string) {
    vol.writeFileSync(resolve(this.root, 'sewing-kit.config.js'), contents);
  }

  async writeFile(file: string, contents: string) {
    const path = this.resolvePath(file);
    vol.mkdirpSync(dirname(path));
    vol.writeFileSync(path, contents);
  }

  contents(file: string) {
    if (!this.commandFinished) {
      return null;
    }

    return vol.readFileSync(this.resolvePath(file), 'utf8');
  }

  contains(file: string) {
    if (!this.commandFinished) {
      return null;
    }

    return vol.existsSync(this.resolvePath(file));
  }

  resolvePath(file: string) {
    return resolve(this.root, file);
  }

  debug() {
    // eslint-disable-next-line no-console
    console.log(toTree(this.root, {allFiles: true}));
  }
}

export async function withWorkspace(
  name: string,
  useWorkspace: (workspace: Workspace) => void | Promise<void>,
) {
  const root = resolve(__dirname, '../../tmp');
  const directory = resolve(root, name);
  const workspace = new Workspace(directory);

  try {
    vol.mkdirSync(directory, {recursive: true});
    await useWorkspace(workspace);
  } finally {
    // fs.rmdirSync(directory, {recursive: true});
  }
}

withWorkspace.extend = (
  extend: (workspace: Workspace) => void | Promise<void>,
) => {
  return (
    name: string,
    useWorkspace: (workspace: Workspace) => void | Promise<void>,
  ) => {
    return withWorkspace(name, async (workspace: Workspace) => {
      await extend(workspace);
      await useWorkspace(workspace);
    });
  };
};
