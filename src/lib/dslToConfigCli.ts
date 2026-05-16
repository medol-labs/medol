import { readFileSync } from 'node:fs';
import { dslToConfig } from './dslToConfig';

const input = process.argv[2];

if (!input) {
  console.error('Usage: npm run dsl:to-config -- ./model.em');
  process.exitCode = 1;
} else {
  console.log(JSON.stringify(dslToConfig(readFileSync(input, 'utf8')), null, 2));
}
