import {resolve, dirname} from 'path';

import {vol} from 'memfs';

import glob, {IOptions as GlobOptions} from 'glob';

export class FileSystem {
  constructor(public readonly root: string) {}

  read(file: string) {
    return vol.readFileSync(this.resolvePath(file), 'utf8');
  }

  async write(file: string, contents: string) {
    const resolved = this.resolvePath(file);
    vol.mkdirpSync(dirname(resolved));
    vol.writeFileSync(resolved, contents);
  }

  async copy(from: string, to: string, options?: CopyOptions) {
    const resolvedFrom = this.resolvePath(from);
    const resolvedTo = this.resolvePath(to);

    await vol.copyFile(resolvedFrom, resolvedTo, options);
  }

  async hasFile(file: string) {
    return vol.existsSync(file);
  }

  async hasDirectory(dir: string) {
    return vol.existsSync(dir);
  }

  async glob(pattern: string, options: Omit<GlobOptions, 'cwd'> = {}) {
    // vol.
    // return glob.sync(pattern, {...options, cwd: this.root, absolute: true});
    return [];
  }

  buildPath(...paths: string[]) {
    return this.resolvePath('build', ...paths);
  }

  resolvePath(...paths: string[]) {
    return resolve(this.root, ...paths);
  }
}
