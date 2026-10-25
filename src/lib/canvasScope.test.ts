import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { parseMedol } from './dslParser';
import { canvasBoards, canvasRelations, resolveCanvasBoard, scopeCanvasModel, unassignedCanvasId } from './canvasScope';
import { toReactFlow } from './flow';

const canvasFixture = `domain Commerce {
  context Catalog {
    slice Products { projection Products[] { productId: UUID id } }
    slice OtherCatalogWork { command OtherCatalogWork { description: String } }
  }
  context Sales {
    concept Order { state Placed slice Place }
    slice Place {
      startsLifecycle
      command Place { productId: UUID from Catalog.Products.productId }
      event OrderPlaced { productId: UUID }
      state Placed
    }
    slice OtherSalesWork { command OtherSalesWork { description: String } }
  }
  context Shipping {
    slice Dispatch { reactsTo OrderPlaced command Dispatch { productId: UUID } event Dispatched { productId: UUID } }
    slice OtherShippingWork { command OtherShippingWork { description: String } }
  }
  context Billing { slice Invoice { reactsTo Dispatched command Invoice { productId: UUID } } }
}
domain Research { context Lab { slice Observe { command Observe { description: String } } } }
context Operations { slice Inspect { command Inspect { description: String } } }`;

function fixture() {
  const model = parseMedol(canvasFixture);
  assert.deepEqual(model.diagnostics, []);
  return { model, sales: model.contexts.find((context) => context.name === 'Sales')!, domainId: model.domains[0].id };
}

test('default canvas contains all contexts of one domain without changing model ownership', () => {
  const { model } = fixture();
  const before = JSON.stringify(model);
  const scoped = scopeCanvasModel(model, {});
  assert.deepEqual(scoped.contexts.map((context) => context.name), ['Catalog', 'Sales', 'Shipping', 'Billing']);
  assert.equal(JSON.stringify(model), before);
});

test('context, concept and slice focus do not filter the domain canvas', () => {
  const { model, sales, domainId } = fixture();
  const sliceId = sales.slices[0].id;
  for (const filter of [{ contextId: sales.id }, { contextId: sales.id, conceptId: sales.concepts[0].id }, { contextId: sales.id, sliceId }]) {
    const scoped = scopeCanvasModel(model, { domainId, ...filter });
    assert.equal(scoped.contexts.length, 4);
    assert.equal(scoped.contexts.find((context) => context.id === sales.id)!.slices.length, 2);
  }
  const options = { domainId, compactSlices: true };
  const positions = (flow: ReturnType<typeof toReactFlow>) => flow.nodes.map((node) => [node.id, node.parentId, node.position]);
  assert.deepEqual(positions(toReactFlow(model, { ...options, contextId: sales.id })), positions(toReactFlow(model, options)));
});

test('local view explicitly filters a context and supports concept and slice drill-down', () => {
  const { model, sales, domainId } = fixture();
  const scoped = scopeCanvasModel(model, { domainId, contextId: sales.id, localContextOnly: true });
  assert.deepEqual(scoped.contexts.map((context) => context.name), ['Sales']);
  for (const filter of [{ sliceId: sales.slices[0].id }, { conceptId: sales.concepts[0].id }]) {
    const local = scopeCanvasModel(model, { domainId, contextId: sales.id, localContextOnly: true, ...filter });
    assert.deepEqual(local.contexts[0].slices.map((slice) => slice.name), ['Place']);
  }
});

test('switching domains does not leak contexts from another domain', () => {
  const { model, sales } = fixture();
  const scoped = scopeCanvasModel(model, { domainId: model.domains[1].id, contextId: sales.id });
  assert.deepEqual(scoped.contexts.map((context) => context.name), ['Lab']);
  assert.equal(scopeCanvasModel(model, { domainId: model.domains[1].id, contextId: sales.id, localContextOnly: true }).contexts.length, 0);
});

test('top-level contexts have a separate viewing scope, not an invented domain', () => {
  const { model } = fixture();
  assert.deepEqual(canvasBoards(model).map((board) => board.name), ['Commerce', 'Research', 'Unassigned contexts']);
  assert.deepEqual(scopeCanvasModel(model, { domainId: unassignedCanvasId }).contexts.map((context) => context.name), ['Operations']);
  assert.equal(model.domains.length, 2);
  const standalone = parseMedol('context One {} context Two {}');
  assert.equal(canvasBoards(standalone)[0].name, 'Model');
  assert.equal(scopeCanvasModel(standalone, {}).contexts.length, 2);
});

test('empty domains are selectable and invalid domain IDs never expose other domains', () => {
  const model = parseMedol('domain Empty {} domain Full { context One {} }');
  assert.equal(scopeCanvasModel(model, {}).contexts.length, 0);
  assert.equal(scopeCanvasModel(model, { domainId: 'missing' }).contexts.length, 0);
  assert.equal(resolveCanvasBoard(model, { contextId: 'missing' }), undefined);
});

test('ambiguous projection references do not invent canvas relationships', () => {
  const model = parseMedol(`context A { slice Items { projection Items[] { itemId: UUID } } }
    context B { slice Items { projection Items[] { itemId: UUID } } }
    context C { slice Choose { command Choose { itemId: UUID from Items.itemId } } }`);
  assert.equal(canvasRelations(model).filter((edge) => edge.label === 'from').length, 0);
});

test('slice summaries preserve real cross-context relationships and do not invent a timeline', () => {
  const { model, domainId } = fixture();
  const flow = toReactFlow(model, { domainId, compactSlices: true });
  const ids = new Set(flow.nodes.map((node) => node.id));
  assert(flow.edges.some((edge) => edge.data?.relation === 'reactsTo' && edge.data.crossContext));
  assert(flow.edges.some((edge) => edge.data?.relation === 'from' && edge.data.crossContext));
  assert(flow.edges.every((edge) => ids.has(edge.source) && ids.has(edge.target) && edge.source !== edge.target));
  assert(!flow.edges.some((edge) => edge.id.startsWith('timeline/')));
  assert.equal(ids.size, flow.nodes.length);
  assert(flow.nodes.some((node) => node.type === 'sliceSummary' && node.data.name === 'OtherSalesWork'));
});

test('collapsed contexts retain real relationships and expand without changing their model IDs', () => {
  const { model, domainId, sales } = fixture();
  const compact = toReactFlow(model, { domainId, compactSlices: true, collapsedContextIds: [sales.id] });
  assert(compact.nodes.some((node) => node.id === sales.id));
  assert(compact.nodes.some((node) => node.id === `${sales.id}/header` && node.data.collapsed === true));
  assert(!compact.nodes.some((node) => node.id === `${sales.slices[0].id}/summary`));
  assert(compact.edges.some((edge) => edge.target === `${sales.id}/header` && edge.data?.relation === 'from'));
  assert(compact.edges.some((edge) => edge.source === `${sales.id}/header` && edge.data?.relation === 'reactsTo'));
  const expanded = toReactFlow(model, { domainId, compactSlices: true, collapsedContextIds: [] });
  assert(expanded.nodes.some((node) => node.id === `${sales.slices[0].id}/summary`));
});

test('aggregated overview edges retain the IDs of the actual model relationships', () => {
  const model = parseMedol(`context Catalog { slice Items { projection Items[] { itemId: UUID itemName: String } } }
    context Use { slice Choose { command Choose { itemId: UUID from Catalog.Items.itemId itemName: String from Catalog.Items.itemName } } }`);
  assert.deepEqual(model.diagnostics, []);
  const flow = toReactFlow(model, { compactSlices: true });
  const edges = flow.edges.filter((edge) => edge.data?.relation === 'from');
  assert.equal(edges.length, 1);
  assert.equal((edges[0].data!.relationIds as string[]).length, 2);
  assert.equal(edges[0].label, 'from (2)');
  assert((edges[0].data!.relationIds as string[]).every((id) => canvasRelations(model).some((edge) => edge.id === id)));
});

test('different relation kinds between the same overview endpoints share one readable label', () => {
  const model = parseMedol(`context A { slice Produce { event Produced { itemId: UUID } projection Items { itemId: UUID } } }
    context B { slice Consume { command Consume { itemId: UUID from A.Items.itemId } projection Seen { itemId: UUID subscribe Produced } } }`);
  assert.deepEqual(model.diagnostics, []);
  const flow = toReactFlow(model, { compactSlices: true });
  assert.equal(flow.edges.length, 1);
  assert.deepEqual(new Set(flow.edges[0].data!.relations as string[]), new Set(['updates', 'from']));
  assert.equal((flow.edges[0].data!.relationIds as string[]).length, 2);
});

test('every parent precedes its children in all domain viewing states', () => {
  const { model, sales, domainId } = fixture();
  for (const compactSlices of [true, false]) for (const collapsedContextIds of [[], [sales.id]]) {
    const flow = toReactFlow(model, { domainId, compactSlices, collapsedContextIds });
    const seen = new Set<string>();
    for (const node of flow.nodes) {
      if (node.parentId) assert(seen.has(node.parentId), `${node.id} parent ${node.parentId}`);
      seen.add(node.id);
    }
    assert.equal(flow.nodes.filter((node) => node.type === 'contextHeader').length, 4);
  }
});

test('context-level projections remain inside their owning context', () => {
  const model = parseMedol('context Shared { projection Catalog[] { itemId: UUID } } context Consumer { slice Choose { command Choose { itemId: UUID from Shared.Catalog.itemId } } }');
  assert.deepEqual(model.diagnostics, []);
  const shared = model.contexts[0];
  for (const compactSlices of [false, true]) {
    const flow = toReactFlow(model, { compactSlices });
    assert.equal(flow.nodes.find((node) => node.id === shared.looseElements[0].id)!.parentId, shared.id);
  }
});

test('full Federation domain overview is deterministic and includes every domain context', () => {
  const model = parseMedol(readFileSync(new URL('../../examples/fl/federation-learning.medol', import.meta.url), 'utf8'));
  const board = resolveCanvasBoard(model)!;
  const options = { domainId: board.id, compactSlices: true };
  const flow = toReactFlow(model, options);
  assert.deepEqual(flow, toReactFlow(model, options));
  assert.equal(flow.nodes.filter((node) => node.type === 'contextHeader').length, board.contexts.length);
});
