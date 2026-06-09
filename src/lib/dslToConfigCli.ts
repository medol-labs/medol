import { readFileSync } from 'node:fs';
import { medolToConfig } from './dslToConfig';

const input = process.argv[2];

if (!input) {
  console.error('Usage: npm run medol:to-config -- ./model.medol');
  process.exitCode = 1;
} else {
  console.log(JSON.stringify(medolToConfig(readFileSync(input, 'utf8')), null, 2));
}
