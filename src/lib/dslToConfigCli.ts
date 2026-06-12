import { readFileSync } from 'node:fs';
import { MedolValidationError, medolToConfig } from './dslToConfig';

const input = process.argv[2];

if (!input) {
  console.error('Usage: npm run medol:to-config -- ./model.medol');
  process.exitCode = 1;
} else {
  try {
    console.log(JSON.stringify(medolToConfig(readFileSync(input, 'utf8')), null, 2));
  } catch (error) {
    console.error(error instanceof MedolValidationError ? error.message : error);
    process.exitCode = 1;
  }
}
