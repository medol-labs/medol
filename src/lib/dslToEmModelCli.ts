import { emModelToJson } from './emModelExport';
import { parseMedolFile } from './medolProject';

const input = process.argv[2];

if (!input) {
  console.error('Usage: npm run medol:to-model -- ./model.medol');
  process.exitCode = 1;
} else {
  console.log(emModelToJson(parseMedolFile(input)));
}
