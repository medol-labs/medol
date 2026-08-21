import assert from 'node:assert/strict';
import { existsSync, unlinkSync } from 'node:fs';
import test from 'node:test';

const databasePath = `/private/tmp/medol-model-translations-${process.pid}.sqlite`;
process.env.MEDOL_DB_PATH = databasePath;

const repository = await import('./modelTranslationRepository');

test.after(() => {
  for (const suffix of ['', '-shm', '-wal']) {
    const path = `${databasePath}${suffix}`;
    if (existsSync(path)) unlinkSync(path);
  }
});

test('reuses historical model translations for unchanged source text across source hashes', () => {
  repository.upsertModelTranslations({
    workspaceId: 'workspace-1',
    sourceHash: 'fnv1a-v1',
    locale: 'zh-CN',
    translations: {
      'Register Account': '注册账户',
      'Cancel Order': '取消订单'
    },
    provider: 'test',
    model: 'fixture'
  });

  repository.upsertModelTranslations({
    workspaceId: 'workspace-2',
    sourceHash: 'fnv1a-v1',
    locale: 'zh-CN',
    translations: {
      'Register Account': '注册用户'
    },
    provider: 'test',
    model: 'fixture'
  });

  assert.deepEqual(repository.readReusableModelTranslations({
    workspaceId: 'workspace-1',
    sourceHash: 'fnv1a-v2',
    locale: 'zh-CN'
  }, [
    'Register Account',
    'Submit Profile'
  ]), {
    'Register Account': '注册账户'
  });

  assert.deepEqual(repository.readModelTranslations({
    workspaceId: 'workspace-1',
    sourceHash: 'fnv1a-v2',
    locale: 'zh-CN'
  }), {});
});
