import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { exportMarkdownToWord, prepareMarkdownForWord } from './modelingDocumentExport';

const execFileAsync = promisify(execFile);

test('prepares page break markers for Word export', () => {
  const markdown = [
    '# Document',
    '',
    '## 目录',
    '',
    '- [一、Body/DOC-B](#doc-b)',
    '',
    '<!-- medol:pagebreak -->',
    '',
    '## 一、Body/DOC-B',
    '',
    '<div style="page-break-before: always;"></div>'
  ].join('\n');

  const prepared = prepareMarkdownForWord(markdown);
  assert.doesNotMatch(prepared, /medol:pagebreak|medol:toc|\[TOC\]|page-break-before/);
  assert.match(prepared, /## 目录/);
  assert.doesNotMatch(prepared, /- \[一、Body\/DOC-B\]\(#doc-b\)|目录生成后请在 Word 中更新域/);
  assert.match(prepared, /TOC \\o "1-3" \\h \\z \\u/);
  assert.match(prepared, /## 一、Body\/DOC-B \{#doc-b}/);
  assert.equal((prepared.match(/```{=openxml}/g) ?? []).length, 3);
  assert.equal((prepared.match(/<w:br w:type="page"\/>/g) ?? []).length, 2);
});

test('exports Word documents with page numbers and auto-updating TOC fields', async () => {
  const exported = await exportMarkdownToWord({
    title: 'Document',
    markdown: [
      '# Document',
      '',
      '## 目录',
      '',
      '- [一、Body/DOC-B](#doc-b)',
      '',
      '<!-- medol:pagebreak -->',
      '',
      '## 一、Body/DOC-B'
    ].join('\n')
  });
  const directory = await mkdtemp(path.join(tmpdir(), 'medol-docx-test-'));
  try {
    const docxPath = path.join(directory, exported.filename);
    const unpackedPath = path.join(directory, 'unpacked');
    await writeFile(docxPath, exported.content);
    await execFileAsync('unzip', ['-q', docxPath, '-d', unpackedPath]);
    const documentXml = await execFileAsync('unzip', ['-p', docxPath, 'word/document.xml']);
    const settingsXml = await execFileAsync('unzip', ['-p', docxPath, 'word/settings.xml']);
    const footerXml = await execFileAsync('unzip', ['-p', docxPath, 'word/footer1.xml']);

    assert.match(documentXml.stdout, /TOC \\o &quot;1-3&quot; \\h \\z \\u/);
    assert.match(documentXml.stdout, /w:dirty="true"/);
    assert.match(documentXml.stdout, /w:footerReference w:type="default" r:id="rIdMedolFooter"/);
    assert.match(settingsXml.stdout, /<w:updateFields w:val="true" \/>/);
    assert.match(footerXml.stdout, /<w:instrText xml:space="preserve">PAGE<\/w:instrText>/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
