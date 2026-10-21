import assert from 'node:assert/strict';
import test from 'node:test';
import { toExportableDocumentMarkdown } from './documentMarkdownPresentation';

test('exports document revisions and source associations without changing editable content', () => {
  const markdown = '# PRD\n\n<!-- em:section id="scope" source="slice/scope" -->\n## Scope\n\nNotes.';
  const exported = toExportableDocumentMarkdown(markdown, [{
    id: 'revision-2', revisionNo: 2, origin: 'manual', title: 'PRD', markdown,
    sourceHash: 'hash-original', workspaceVersionId: 'snapshot-1', workspaceVersionNo: 1,
    workspaceVersionMessage: 'Initial | source\nnotes', createdAt: '2026-10-21T00:00:00.000Z'
  }], true);
  assert.match(exported, /## Scope\n\nNotes\./);
  assert.match(exported, /## Revision History/);
  assert.match(exported, /\| 2 \| 2026-10-21T00:00:00.000Z \| manual \| #1 snapshot-1 Initial &#124; source notes \| hash-original \|/);
  assert.match(exported, /unsaved changes/);
  assert.doesNotMatch(exported, /em:section/);
  assert.doesNotMatch(markdown, /Revision History/);
});

test('keeps documents without revisions free of revision front matter', () => {
  assert.equal(toExportableDocumentMarkdown('# Translations'), '# Translations');
});

test('keeps Word layout markers and includes the release label in export metadata', () => {
  const markdown = '# PRD\n\n<!-- medol:pagebreak -->\n\nBody.';
  const exported = toExportableDocumentMarkdown(markdown, [{
    id: 'revision-1', revisionNo: 1, origin: 'generated', title: 'PRD', markdown,
    workspaceVersionId: 'stable-snapshot', workspaceVersionNo: 7,
    workspaceReleaseLabel: 'v1.2.3', createdAt: '2026-10-21'
  }], false, 'word');
  assert.match(exported, /medol:pagebreak/);
  assert.match(exported, /#7 stable-snapshot v1\.2\.3/);
});
