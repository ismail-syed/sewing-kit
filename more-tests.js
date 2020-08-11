const {resolve} = require('path');
const {readFileSync, writeFileSync} = require('fs-extra');

let contents = ``;

const file = resolve(__dirname, 'tmp.txt');
const output = resolve(__dirname, 'output.txt');
const fileContents = readFileSync(file);
console.log(fileContents.toString());

for (let i = 1; i < 51; i++) {
  contents += `
  describe('@sewing-kit/plugin-package-esmodules ${i}', () => {
    ${fileContents}
  });
  `;

  writeFileSync(output, contents);
}
