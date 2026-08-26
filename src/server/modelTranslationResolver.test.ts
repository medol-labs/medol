import assert from 'node:assert/strict';
import { existsSync, unlinkSync } from 'node:fs';
import test from 'node:test';

const databasePath = `/private/tmp/medol-resolved-model-translations-${process.pid}.sqlite`;
const documentDatabasePath = `/private/tmp/medol-resolved-model-translation-documents-${process.pid}.sqlite`;
process.env.MEDOL_DB_PATH = databasePath;
process.env.MEDOL_DOCUMENT_DB_PATH = documentDatabasePath;

const translationRepository = await import('./modelTranslationRepository');
const documentRepository = await import('./modelingDocumentRepository');
const resolver = await import('./modelTranslationResolver');

test.after(() => {
  for (const database of [databasePath, documentDatabasePath]) {
    for (const suffix of ['', '-shm', '-wal']) {
      const path = `${database}${suffix}`;
      if (existsSync(path)) unlinkSync(path);
    }
  }
});

test('resolves final translations from edited model translation document before codegen export', () => {
  const scope = {
    workspaceId: 'workspace-1',
    sourceHash: 'fnv1a-current',
    locale: 'zh-CN'
  };
  translationRepository.upsertModelTranslations({
    ...scope,
    translations: {
      'Active Member Count': 'ActiveMember数量',
      'Order Catalog': '订单目录'
    },
    provider: 'test',
    model: 'old-machine-translation'
  });
  documentRepository.createModelingDocument({
    workspaceId: scope.workspaceId,
    title: '模型国际化术语表',
    kind: 'model-translations',
    language: 'zh-CN',
    sourceHash: scope.sourceHash,
    markdown: [
      '# 模型国际化术语表',
      '',
      '<!-- em:section id="model-i18n.context.demo" source="context/demo" -->',
      '## 上下文术语',
      '',
      '| 原文 | 译文 | 状态 |',
      '| --- | --- | --- |',
      '| Active Member Count | 活跃成员数 | 已翻译 |',
      '| Pending Item | - | 待翻译 |'
    ].join('\n')
  });

  const resolved = resolver.readResolvedModelTranslations(scope, [
    'Active Member Count',
    'Order Catalog'
  ]);

  assert.equal(resolved.translations['Active Member Count'], '活跃成员数');
  assert.equal(resolved.translations['Order Catalog'], '订单目录');
  assert.equal(resolved.document, 1);
  assert.equal(
    translationRepository.readModelTranslations(scope)['Active Member Count'],
    '活跃成员数'
  );
});
