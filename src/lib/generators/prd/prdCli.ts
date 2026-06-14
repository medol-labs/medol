import { readFileSync } from 'node:fs';
import { parseMedolFile } from '../../medolProject';
import { generatePrd } from './prdGenerator';
import { renderPrdMarkdown } from './prdMarkdownRenderer';

const args = process.argv.slice(2);
const input = args.find((arg) => !arg.startsWith('--'));
const outputTrace = args.includes('--trace');
const outputJson = args.includes('--json');

if (!input) {
  console.error('Usage: npm run prd:generate -- ./model.medol [--trace|--json]');
  process.exitCode = 1;
} else {
  const sourceText = readFileSync(input, 'utf8');
  const model = parseMedolFile(input);
  const result = generatePrd(model, { sourceText });

  if (outputTrace) {
    console.log(JSON.stringify(result.trace, null, 2));
  } else if (outputJson) {
    console.log(JSON.stringify(result.document, null, 2));
  } else {
    console.log(renderPrdMarkdown(result.document));
  }
}
