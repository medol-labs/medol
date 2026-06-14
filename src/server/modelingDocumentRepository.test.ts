import assert from 'node:assert/strict';
import { existsSync, unlinkSync } from 'node:fs';
import test from 'node:test';
import {
  extractDocumentSourceRefs,
  findDocumentSourceLine,
  hashMedolSource
} from '../features/documentation/documentReferences';

const databasePath = `/private/tmp/medol-documents-${process.pid}.sqlite`;
const workspaceDatabasePath = `/private/tmp/medol-workspaces-${process.pid}.sqlite`;
process.env.MEDOL_DOCUMENT_DB_PATH = databasePath;
process.env.MEDOL_DB_PATH = workspaceDatabasePath;

const repository = await import('./modelingDocumentRepository');
const workspaceRepository = await import('./modelingWorkspaceRepository');

test.after(() => {
  for (const database of [databasePath, workspaceDatabasePath]) {
    for (const suffix of ['', '-shm', '-wal']) {
      const path = `${database}${suffix}`;
      if (existsSync(path)) unlinkSync(path);
    }
  }
});

test('creates, lists, updates, reads, and deletes modeling documents', () => {
  const created = repository.createModelingDocument({
    workspaceId: 'workspace-1',
    title: 'Orders PRD',
    kind: 'prd',
    language: 'en',
    sourceHash: 'fnv1a-orders',
    markdown: [
      '# Orders',
      '',
      '<!-- em:section id="prd.section.slice.CreateOrder" source="domain/Orders/context/Sales/aggregate/Order/slice/CreateOrder" -->',
      '## Create Order'
    ].join('\n')
  });

  const listed = repository.listModelingDocuments('workspace-1');
  assert.equal(listed.length, 1);
  assert.deepEqual(listed[0].sourceRefs, [
    'domain/Orders/context/Sales/aggregate/Order/slice/CreateOrder'
  ]);
  assert.equal(listed[0].sourceHash, 'fnv1a-orders');
  assert.equal(repository.listModelingDocuments('workspace-2').length, 0);
  assert.deepEqual(repository.readModelingDocument(created.id)?.sourceRefs, listed[0].sourceRefs);

  const updated = repository.updateModelingDocument(created.id, {
    title: 'Orders Product Requirements',
    markdown: '# Orders\n\nUpdated.'
  });
  assert.equal(updated?.title, 'Orders Product Requirements');
  assert.equal(updated?.markdown, '# Orders\n\nUpdated.');

  assert.equal(repository.removeModelingDocument(created.id), true);
  assert.equal(repository.readModelingDocument(created.id), undefined);
});

test('parses multi-source section markers and stable MEDOL hashes', () => {
  const markdown = [
    '# Database',
    '',
    '<!-- em:section id="database.readmodel.Orders" sources="readmodel/orders slice/orders" -->',
    '## Orders'
  ].join('\n');

  assert.deepEqual(extractDocumentSourceRefs(markdown), [
    'readmodel/orders',
    'slice/orders'
  ]);
  assert.equal(findDocumentSourceLine(markdown, 'slice/orders'), 3);
  assert.equal(hashMedolSource('domain Orders {}'), hashMedolSource('domain Orders {}'));
  assert.notEqual(hashMedolSource('domain Orders {}'), hashMedolSource('domain Sales {}'));
});

test('backfills source references for previously generated documents', () => {
  const workspace = workspaceRepository.createModelingWorkspace({
    name: 'Legacy documents',
    dsl: `
domain Orders {
  context Sales {
    aggregate Order {
      slice CreateOrder {
        command CreateOrder
        event OrderCreated
      }
    }
  }
}`
  });
  const created = repository.createModelingDocument({
    workspaceId: workspace.id,
    title: 'Orders Software Design',
    kind: 'software-design',
    language: 'en',
    markdown: '# Orders Software Design\n\n## Aggregate Design\n\n### Order\n\nCapabilities.'
  });

  assert.deepEqual(repository.readModelingDocument(created.id)?.sourceRefs, [
    'domain/Orders/context/Sales/aggregate/Order'
  ]);
  assert.match(
    repository.readModelingDocument(created.id)?.markdown ?? '',
    /em:section id="software\.aggregate\.Order"/
  );
});
