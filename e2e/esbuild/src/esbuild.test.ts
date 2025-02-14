import {
  checkFilesDoNotExist,
  checkFilesExist,
  cleanupProject,
  newProject,
  readFile,
  runCLI,
  runCommand,
  uniq,
  updateFile,
  updateProjectConfig,
} from '@nrwl/e2e/utils';

describe('EsBuild Plugin', () => {
  let proj: string;
  beforeEach(() => (proj = newProject()));
  afterEach(() => cleanupProject());

  it('should setup and build projects using build', async () => {
    const myPkg = uniq('my-pkg');
    runCLI(`generate @nrwl/js:lib ${myPkg} --bundler=esbuild`);
    updateFile(`libs/${myPkg}/src/index.ts`, `console.log('Hello');\n`);
    updateProjectConfig(myPkg, (json) => {
      json.targets.build.options.assets = [`libs/${myPkg}/assets/*`];
      return json;
    });
    updateFile(`libs/${myPkg}/assets/a.md`, 'file a');
    updateFile(`libs/${myPkg}/assets/b.md`, 'file b');

    runCLI(`build ${myPkg}`);

    expect(runCommand(`node dist/libs/${myPkg}/main.js`)).toMatch(/Hello/);

    checkFilesExist(`dist/libs/${myPkg}/package.json`);
    expect(readFile(`dist/libs/${myPkg}/assets/a.md`)).toMatch(/file a/);
    expect(readFile(`dist/libs/${myPkg}/assets/b.md`)).toMatch(/file b/);

    /* CJS format is not used by default, but passing --format=esm,cjs generates with it.
     */
    checkFilesDoNotExist(`dist/libs/${myPkg}/main.cjs`);
    runCLI(`build ${myPkg} --format=esm,cjs`);
    checkFilesExist(`dist/libs/${myPkg}/main.cjs`);

    /* Metafile is not generated by default, but passing --metafile generates it.
     */
    checkFilesDoNotExist(`dist/libs/${myPkg}/meta.json`);
    runCLI(`build ${myPkg} --metafile`);
    checkFilesExist(`dist/libs/${myPkg}/meta.json`);

    /* Type errors are turned on by default
     */
    updateFile(
      `libs/${myPkg}/src/index.ts`,
      `
      const x: number = 'a'; // type error
      console.log('Bye');
    `
    );
    expect(() => runCLI(`build ${myPkg}`)).toThrow();
    expect(() => runCLI(`build ${myPkg} --skipTypeCheck`)).not.toThrow();
    expect(runCommand(`node dist/libs/${myPkg}/main.js`)).toMatch(/Bye/);
  }, 300_000);

  it('should bundle in workspace libs', async () => {
    const parentLib = uniq('parent-lib');
    const childLib = uniq('child-lib');
    runCLI(`generate @nrwl/js:lib ${parentLib} --bundler=esbuild`);
    runCLI(`generate @nrwl/js:lib ${childLib} --buildable=false`);
    updateFile(
      `libs/${parentLib}/src/index.ts`,
      `import '@${proj}/${childLib}';`
    );
    updateFile(
      `libs/${childLib}/src/index.ts`,
      `console.log('Hello from lib');\n`
    );

    runCLI(`build ${parentLib}`);

    expect(runCommand(`node dist/libs/${parentLib}/main.js`)).toMatch(
      /Hello from lib/
    );
  }, 300_000);
});
