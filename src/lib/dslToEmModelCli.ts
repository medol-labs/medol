import { readFileSync } from 'node:fs';
import { medolToEmModelJson } from './emModelExport';

const input = process.argv[2];

if (!input) {
  console.error('Usage: npm run medol:to-model -- ./model.medol');
  process.exitCode = 1;
} else {
  console.log(medolToEmModelJson(readFileSync(input, 'utf8')));
}
