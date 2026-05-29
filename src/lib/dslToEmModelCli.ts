import { readFileSync } from 'node:fs';
import { dslToEmModelJson } from './emModelExport';

const input = process.argv[2];

if (!input) {
  console.error('Usage: npm run dsl:to-model -- ./model.em');
  process.exitCode = 1;
} else {
  console.log(dslToEmModelJson(readFileSync(input, 'utf8')));
}
