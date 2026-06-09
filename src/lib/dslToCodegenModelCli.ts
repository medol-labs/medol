import { readFileSync } from 'node:fs';
import { medolToCodegenModel } from './dslToConfig';

const input = process.argv[2];

if (!input) {
  console.error('Usage: npm run medol:to-codegen-model -- ./model.medol');
  process.exitCode = 1;
} else {
  console.log(JSON.stringify(medolToCodegenModel(readFileSync(input, 'utf8')), null, 2));
}
