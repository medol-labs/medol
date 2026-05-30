import { readFileSync } from 'node:fs';
import { dslToCodegenModel } from './dslToConfig';

const input = process.argv[2];

if (!input) {
  console.error('Usage: npm run dsl:to-codegen-model -- ./model.em');
  process.exitCode = 1;
} else {
  console.log(JSON.stringify(dslToCodegenModel(readFileSync(input, 'utf8')), null, 2));
}
