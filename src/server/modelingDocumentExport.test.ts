import assert from 'node:assert/strict';
import { execFile, execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import {
  exportMarkdownToWord,
  prepareMarkdownForWord,
  removeMedolSectionMarkers,
  validateExportWordInput
} from './modelingDocumentExport';

const execFileAsync = promisify(execFile);

const hasWordExportTools = (): boolean => {
  try {
    execFileSync('pandoc', ['--version'], { stdio: 'ignore' });
    execFileSync('zip', ['-v'], { stdio: 'ignore' });
    execFileSync('unzip', ['-v'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};

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

test('validates Word export profiles', () => {
  assert.deepEqual(validateExportWordInput({
    title: 'Design',
    markdown: '# Design'
  }).value?.profileId, 'default');

  assert.deepEqual(validateExportWordInput({
    title: 'Design',
    markdown: '# Design',
    profileId: 'zh-formal'
  }).value?.profileId, 'zh-formal');

  assert.equal(validateExportWordInput({
    title: 'Design',
    markdown: '# Design',
    profileId: 'unknown'
  }).error, 'unsupported Word export profile');
});

test('removes MEDOL section markers from Markdown export input', () => {
  assert.equal(
    removeMedolSectionMarkers([
      '# Design',
      '',
      '<!-- em:section id="software.slice.Create" source="slice/create" -->',
      '## Create'
    ].join('\n')),
    [
      '# Design',
      '',
      '## Create'
    ].join('\n')
  );
});

test('exports Word documents with page numbers and auto-updating TOC fields', async (context) => {
  if (!hasWordExportTools()) {
    context.skip('pandoc, zip, and unzip are required for DOCX export integration test');
    return;
  }

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
    assert.match(settingsXml.stdout, /<w:updateFields w:val="true" ?\/>/);
    assert.match(footerXml.stdout, /<w:instrText xml:space="preserve">PAGE<\/w:instrText>/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('exports zh-formal DOCX with front matter, body page numbering, and cleaned markers', async (context) => {
  if (!hasWordExportTools()) {
    context.skip('pandoc, zip, and unzip are required for DOCX export integration test');
    return;
  }

  const exported = await exportMarkdownToWord({
    title: '测试导出',
    profileId: 'zh-formal',
    markdown: [
      '# 测试导出',
      '',
      '<!-- em:section id="document.changeLog" -->',
      '## 变更记录',
      '',
      '| 版本 | 日期 | 变更说明 | 作者 |',
      '| --- | --- | --- | --- |',
      '| V0.1.0 | 2026-08-23 | 更新导出格式 | Alice |',
      '',
      '<!-- em:section id="software.context.Demo" source="context/demo" -->',
      '## 概述',
      '',
      '这是一个正式中文 Word 导出样例。',
      '',
      '```mermaid',
      'flowchart TB',
      '  User["用户浏览器"]',
      '  Web["Web 前端 / 反向代理"]',
      '  Api["后端 API 服务"]',
      '  Db["数据库"]',
      '  User --> Web',
      '  Web --> Api',
      '  Api --> Db',
      '```',
      '',
      '## 细节',
      '',
      '| 字段 | 类型 |',
      '| --- | --- |',
      '| name | String |'
    ].join('\n')
  });
  const directory = await mkdtemp(path.join(tmpdir(), 'medol-docx-test-'));
  const docxPath = path.join(directory, exported.filename);
  try {
    await writeFile(docxPath, exported.content);
    const documentXml = execFileSync('unzip', ['-p', docxPath, 'word/document.xml'], {
      encoding: 'utf8'
    });
    const settingsXml = execFileSync('unzip', ['-p', docxPath, 'word/settings.xml'], {
      encoding: 'utf8'
    });
    const footerXml = execFileSync('unzip', ['-p', docxPath, 'word/footer1.xml'], {
      encoding: 'utf8'
    });
    const archiveListing = execFileSync('unzip', ['-l', docxPath], {
      encoding: 'utf8'
    });

    assert.match(documentXml, /测试导出/);
    assert.equal((documentXml.match(/变更记录/g) ?? []).length, 1);
    assert.match(documentXml, /V0\.1\.0/);
    assert.match(documentXml, /2026-08-23/);
    assert.match(documentXml, /更新导出格式/);
    assert.match(documentXml, /Alice/);
    assert.equal((documentXml.match(/目录/g) ?? []).length, 1);
    assert.match(documentXml, /TOC \\o "1-3" \\h \\z \\u/);
    assert.match(documentXml, /<w:pgNumType w:start="1"\/>/);
    assert.doesNotMatch(documentXml, /em:section/);
    assert.doesNotMatch(documentXml, /flowchart TB/);
    assert.match(footerXml, /SECTIONPAGES/);
    assert.doesNotMatch(footerXml, /NUMPAGES/);
    assert.match(settingsXml, /<w:updateFields w:val="true" ?\/>/);
    assert.match(archiveListing, /word\/media\//);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
