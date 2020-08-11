import 'core-js/features/array/flat';
import 'core-js/features/array/flat-map';

import {resolve, dirname} from 'path';
import {Readable, Writable} from 'stream';

import {
  mkdirp,
  mkdirpSync,
  rmdir,
  writeFile,
  writeFileSync,
  readFile,
  pathExists,
  emptyDir,
} from 'fs-extra';
import {vol, Volume} from 'memfs';
import toTree from 'tree-node-cli';

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
  private virtualDiskJSON: {} = {};
  constructor(public readonly root: string) {}

  async run<K extends keyof CommandMap>(command: K, args: string[] = []) {
    const stdout = new TestOutputStream();
    const stderr = new TestOutputStream();
    const stdin = new Readable();

    try {
      this.writeVirtualFsToDisk();
    } catch (error) {
      console.log('Error creating test fixture dir', error);
    }

    try {
      await (await commandMap[command]())([...args, '--root', this.root], {
        __internal: {stdin, stdout, stderr},
      });
    } finally {
      this.commandFinished = true;
    }
  }

  writeConfig(contents: string) {
    this.virtualDiskJSON['sewing-kit.config.js'] = contents;
  }

  async writeFile(file: string, contents: string) {
    this.virtualDiskJSON[file] = contents;
  }

  contents(file: string) {
    if (!this.commandFinished) {
      return null;
    }

    return readFile(this.resolvePath(file), 'utf8');
  }

  contains(file: string) {
    if (!this.commandFinished) {
      return null;
    }

    return pathExists(this.resolvePath(file));
  }

  resolvePath(file: string) {
    return resolve(this.root, file);
  }

  debug() {
    // eslint-disable-next-line no-console
    console.log(toTree(this.root, {allFiles: true}));
  }

  private writeVirtualFsToDisk() {
    for (const [key, value] of Object.entries(this.virtualDiskJSON)) {
      const path = this.resolvePath(key);
      mkdirpSync(dirname(path));
      writeFileSync(path, value);
    }
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
    await mkdirp(directory);
    await useWorkspace(workspace);
  } finally {
    await emptyDir(directory);
    await rmdir(directory);
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
