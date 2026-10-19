import assert from 'node:assert/strict';
import test from 'node:test';
import { requestDocumentationReview } from './documentationReviewProvider';

test('document review uses the configured MiniMax model and records usage', async () => {
  const previous = {
    provider: process.env.AGENT_PROVIDER,
    key: process.env.MINIMAX_API_KEY,
    model: process.env.MINIMAX_MODEL,
    url: process.env.MINIMAX_BASE_URL,
    fetch: globalThis.fetch
  };
  process.env.AGENT_PROVIDER = 'minimax';
  process.env.MINIMAX_API_KEY = 'test-key';
  process.env.MINIMAX_MODEL = 'test-model';
  process.env.MINIMAX_BASE_URL = 'http://model.test/v1';
  globalThis.fetch = async (input, init) => {
    assert.equal(String(input), 'http://model.test/v1/responses');
    const request = JSON.parse(String(init?.body)) as { model: string; input: string };
    assert.equal(request.model, 'test-model');
    assert.match(request.input, /slice\/create/);
    return Response.json({
      output_text: JSON.stringify({ items: [{ sourceId: 'slice/create', suggestion: '确认操作约束。' }] }),
      usage: { input_tokens: 100, output_tokens: 20, total_tokens: 120 }
    });
  };
  try {
    const result = await requestDocumentationReview({
      kind: 'software-design', language: 'zh-CN', title: '设计说明', excerpt: '正文',
      evidence: [{ id: 'slice/create', label: '创建', facts: '创建约束' }]
    });
    assert.deepEqual(result.items, [{ sourceId: 'slice/create', suggestion: '确认操作约束。' }]);
    assert.equal(result.usage?.provider, 'minimax');
    assert.equal(result.usage?.totalTokens, 120);
  } finally {
    restoreEnv('AGENT_PROVIDER', previous.provider);
    restoreEnv('MINIMAX_API_KEY', previous.key);
    restoreEnv('MINIMAX_MODEL', previous.model);
    restoreEnv('MINIMAX_BASE_URL', previous.url);
    globalThis.fetch = previous.fetch;
  }
});

test('ignores reasoning entries and parses JSON embedded in the final message', async () => {
  const previous = {
    provider: process.env.AGENT_PROVIDER,
    key: process.env.MINIMAX_API_KEY,
    url: process.env.MINIMAX_BASE_URL,
    fetch: globalThis.fetch
  };
  process.env.AGENT_PROVIDER = 'minimax';
  process.env.MINIMAX_API_KEY = 'test-key';
  process.env.MINIMAX_BASE_URL = 'http://model.test/v1';
  globalThis.fetch = async () => Response.json({
    output: [
      { type: 'reasoning', content: [{ type: 'text', text: 'The user wants a review.' }] },
      { type: 'message', content: [{ type: 'output_text', text: 'Review:\n```json\n{"items":[{"sourceId":"slice/create","suggestion":"核对条件。"}]}\n```' }] }
    ]
  });
  try {
    const result = await requestDocumentationReview({
      kind: 'prd', language: 'zh-CN', title: '需求', excerpt: '正文',
      evidence: [{ id: 'slice/create', label: '创建', facts: '约束' }]
    });
    assert.deepEqual(result.items, [{ sourceId: 'slice/create', suggestion: '核对条件。' }]);
  } finally {
    restoreEnv('AGENT_PROVIDER', previous.provider);
    restoreEnv('MINIMAX_API_KEY', previous.key);
    restoreEnv('MINIMAX_BASE_URL', previous.url);
    globalThis.fetch = previous.fetch;
  }
});

const restoreEnv = (key: string, value: string | undefined): void => {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
};
