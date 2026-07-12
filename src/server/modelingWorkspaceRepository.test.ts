import assert from 'node:assert/strict';
import { existsSync, unlinkSync } from 'node:fs';
import test from 'node:test';

const databasePath = `/private/tmp/medol-workspace-versions-${process.pid}.sqlite`;
process.env.MEDOL_DB_PATH = databasePath;

const repository = await import('./modelingWorkspaceRepository');

test.after(() => {
  for (const suffix of ['', '-shm', '-wal']) {
    const path = `${databasePath}${suffix}`;
    if (existsSync(path)) unlinkSync(path);
  }
});

test('creates immutable workspace versions and restores a version into the draft', () => {
  const initialDsl = 'domain Orders {}';
  const nextDsl = 'domain Orders {\n  context Sales {}\n}';
  const workspace = repository.createModelingWorkspace({
    name: 'Orders',
    dsl: initialDsl
  });

  assert.ok(workspace.headVersionId);
  const initialVersions = repository.listModelingWorkspaceVersions(workspace.id);
  assert.equal(initialVersions.length, 1);
  assert.equal(initialVersions[0].versionNo, 1);
  assert.equal(initialVersions[0].message, 'Initial version');
  assert.equal(initialVersions[0].id, workspace.headVersionId);

  const draft = repository.updateModelingWorkspace(workspace.id, {
    dsl: 'domain Orders {\n  context Draft {}\n}'
  });
  assert.ok(draft);
  assert.equal(draft.headVersionId, undefined);

  const created = repository.createModelingWorkspaceVersion(workspace.id, {
    message: 'Add Sales context',
    dsl: nextDsl,
    author: 'tester',
    releaseChannel: 'stable',
    releaseLabel: 'Orders v1',
    releaseNotes: 'Ready for generated application review.'
  });

  assert.ok(created);
  assert.equal(created.version.versionNo, 2);
  assert.equal(created.version.parentVersionId, initialVersions[0].id);
  assert.equal(created.version.dsl, nextDsl);
  assert.equal(created.version.message, 'Add Sales context');
  assert.equal(created.version.author, 'tester');
  assert.deepEqual(created.version.release, {
    channel: 'stable',
    label: 'Orders v1',
    notes: 'Ready for generated application review.',
    releasedAt: created.version.release?.releasedAt
  });
  assert.ok(created.version.release?.releasedAt);
  assert.equal(created.workspace.dsl, nextDsl);
  assert.equal(created.workspace.headVersionId, created.version.id);

  const versions = repository.listModelingWorkspaceVersions(workspace.id);
  assert.deepEqual(versions.map((version) => version.versionNo), [2, 1]);

  const restored = repository.restoreModelingWorkspaceVersion(workspace.id, initialVersions[0].id);
  assert.ok(restored);
  assert.equal(restored.dsl, initialDsl);
  assert.equal(restored.headVersionId, initialVersions[0].id);
});
