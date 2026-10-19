import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { parseMedolFile } from '../../medolProject';
import { generatePrd } from './prdGenerator';
import { renderPrdMarkdown } from './prdMarkdownRenderer';

const args = process.argv.slice(2);
const input = args.find((arg) => !arg.startsWith('--'));
const outputTrace = args.includes('--trace');
const outputJson = args.includes('--json');
const outputUseCases = args.includes('--use-cases');
const outputPath = args.find((arg) => arg.startsWith('--out='))?.slice('--out='.length);

if (!input) {
  console.error('Usage: npm run prd:generate -- ./model.medol [--trace|--json|--use-cases] [--out=path]');
  process.exitCode = 1;
} else {
  const sourceText = readFileSync(input, 'utf8');
  const model = parseMedolFile(input);
  const result = generatePrd(model, { sourceText });

  const output = outputUseCases
    ? JSON.stringify({
        schemaVersion: 1,
        sourceHash: result.trace.dslHash,
        generatedAt: result.trace.generatedAt,
        useCases: result.document.useCases
      }, null, 2)
    : outputTrace
      ? JSON.stringify(result.trace, null, 2)
      : outputJson
        ? JSON.stringify(result.document, null, 2)
        : renderPrdMarkdown(result.document);
  if (outputPath) {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${output.trimEnd()}\n`, 'utf8');
    console.error(`Wrote ${outputPath}`);
  } else {
    console.log(output);
  }
}
