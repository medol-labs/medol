import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseMedolFile } from './medolProject';
import { parseMedol, parseMedolSources } from './dslParser';
import { modelToCodegenModel } from './codegenModel';
import { analyzeFieldLineage, FieldSourceValidationError, traceField } from './fieldLineage';
import { analyzeModel, scopeAnalysis } from '../features/model-analysis/modelAnalysis';

const flow = `context Orders {
  slice Place {
    command Place { orderId: UUID id generated name: String }
    event Placed { orderId: UUID from Place.orderId title: String from Place.name }
  }
  slice Catalog {
    readmodel Catalog[] {
      orderId: UUID from Placed.orderId
      title: String from Placed.title
      subscribe Placed
    }
  }
}`;

test('traces explicit renames in both directions, with source locations', () => {
  const model = parseMedol(flow);
  assert.deepEqual(model.diagnostics, []);
  const lineage = analyzeFieldLineage(model);
  const field = lineage.fields.find((item) => item.elementName === 'Catalog' && item.name === 'title')!;
  assert.deepEqual(traceField(lineage, field.id).fields.map((item) => `${item.elementName}.${item.name}`),
    ['Place.name', 'Placed.title', 'Catalog.title']);
  assert.equal(field.range?.start.line, 9);
  const input = lineage.fields.find((item) => item.elementName === 'Place' && item.name === 'name')!;
  assert.equal(input.origin, 'input');
  assert.equal(traceField(lineage, input.id, 'consumers').links.length, 2);
  assert.equal(lineage.diagnostics.length, 0);
  assert.equal(lineage.fields.find((item) => item.elementName === 'Place' && item.name === 'orderId')?.origin, 'generated');
});

test('reports missing references and blocks even direct EmModel exports', () => {
  const model = parseMedol(flow.replace('from Place.name', 'from Place.missing'));
  const diagnostic = analyzeFieldLineage(model).diagnostics.find((item) => item.code === 'source-unresolved');
  assert.equal(diagnostic?.severity, 'error');
  assert.throws(() => modelToCodegenModel(model), /source-unresolved.*Place.missing/);
  assert.throws(() => modelToCodegenModel(model), (error) => {
    assert(error instanceof FieldSourceValidationError);
    assert.equal(error.diagnostics[0].code, 'source-unresolved');
    assert(error.diagnostics[0].range?.start.line);
    return true;
  });
});

test('ambiguous references require qualification, without fuzzy name matching', () => {
  const model = parseMedol(`
    context One { slice Data { event Saved { id: UUID } } }
    context Two { slice Data { event Saved { id: UUID } } }
    context Three { slice Use { command Use { id: UUID from Saved.id } } }
  `);
  assert(analyzeFieldLineage(model).diagnostics.some((item) => item.code === 'source-ambiguous'));
  const field = model.contexts[2].slices[0].elements[0].fields[0];
  field.mapping!.sources = ['One.Saved.id'];
  assert(!analyzeFieldLineage(model).diagnostics.some((item) => item.severity === 'error'));
  field.mapping!.sources = ['Save.id'];
  assert(analyzeFieldLineage(model).diagnostics.some((item) => item.code === 'source-unresolved'));
});

test('a same-named UI declaration does not make a projection field ambiguous', () => {
  const model = parseMedol(`context Orders {
    slice Catalog { ui Catalog readmodel Catalog[] { id: UUID } }
    slice Use { command Use { id: UUID from Catalog.id } }
  }`);
  assert.deepEqual(model.diagnostics, []);
  assert(!analyzeFieldLineage(model).diagnostics.some((item) => item.severity === 'error'));
  assert.doesNotThrow(() => modelToCodegenModel(model));
});

test('the complete example has no blocking field references, independently of lifecycle diagnostics', () => {
  const model = parseMedolFile('examples/fl/federation-learning.medol');
  assert.deepEqual(analyzeFieldLineage(model).diagnostics.filter((item) => item.severity === 'error'), []);
});

test('relationship-based matches remain inferred; similar names are not sources', () => {
  const model = parseMedol(`context Orders { slice Place {
    command Place { name: String }
    event Placed { name: String featureCount: Int }
  } }`);
  const lineage = analyzeFieldLineage(model);
  assert.equal(lineage.fields.find((item) => item.elementName === 'Placed' && item.name === 'name')?.origin, 'inferred');
  const count = lineage.fields.find((item) => item.name === 'featureCount')!;
  assert.equal(count.origin, 'unknown');
  assert.equal(traceField(lineage, count.id).links.length, 0);
  assert.doesNotThrow(() => modelToCodegenModel(model));
});

test('reaction history alone does not replace a user command boundary input', () => {
  const model = parseMedol(`context Orders {
    slice Open { event Opened { name: String } }
    slice Rename { reactsTo Opened command Rename { name: String } }
  }`);
  const lineage = analyzeFieldLineage(model);
  const input = lineage.fields.find((item) => item.elementName === 'Rename')!;
  assert.equal(input.origin, 'input');
  assert.equal(traceField(lineage, input.id).links.length, 0);
});

test('port outputs and prose derivations do not certify implementations', () => {
  const model = parseMedol(`context Jobs { slice Run {
    port
    command Run { jobId: UUID }
    event Finished {
      artifact: String portOutput
      score: Int { rule "Compute the score" }
    }
  } }`);
  assert.deepEqual(model.diagnostics, []);
  const lineage = analyzeFieldLineage(model);
  assert.equal(lineage.fields.find((item) => item.name === 'artifact')?.origin, 'port');
  assert(lineage.diagnostics.some((item) => item.code === 'source-missing' && item.severity === 'warning'));
  assert.doesNotThrow(() => modelToCodegenModel(model));
});

test('automation inputs are not marked as user input and fan-out aliases trace nested fields', () => {
  const model = parseMedol(`context Jobs {
    value Participant { runtimeId: UUID }
    slice Select { event Selected { participants: Participant[] } }
    slice Dispatch {
      command Dispatch { runtimeId: UUID from participant.runtimeId }
      automation EachParticipant {
        on Selected
        for each Selected.participants as participant
        emits Dispatch
      }
    }
  }`);
  assert.deepEqual(model.diagnostics, []);
  const lineage = analyzeFieldLineage(model);
  assert(!lineage.diagnostics.some((item) => item.severity === 'error'));
  const target = lineage.fields.find((item) => item.elementName === 'Dispatch')!;
  assert.equal(target.origin, 'mapping');
  assert.equal(traceField(lineage, target.id).fields[0].name, 'participants');
  model.contexts[0].slices[1].elements.find((item) => item.kind === 'command')!.fields[0].mapping = undefined;
  assert.equal(analyzeFieldLineage(model).fields.find((item) => item.elementName === 'Dispatch')?.origin, 'unknown');
});

test('fan-out aliases shadow same-named model elements, including invalid member references', () => {
  const source = `context Jobs {
    value Participant { runtimeId: UUID }
    slice Select {
      event Selected { participants: Participant[] }
      event participant { runtimeId: UUID unavailable: String }
    }
    slice Dispatch {
      command Dispatch { runtimeId: UUID from participant.runtimeId }
      automation EachParticipant {
        on Selected
        for each Selected.participants as participant
        emits Dispatch
      }
    }
  }`;
  let model = parseMedol(source);
  let lineage = analyzeFieldLineage(model);
  assert(!lineage.diagnostics.some((item) => item.severity === 'error'));
  assert(lineage.links.some((item) => item.path === 'participant.runtimeId' && item.source.includes('/event/Selected/')));
  model = parseMedol(source.replace('from participant.runtimeId', 'from participant.unavailable'));
  lineage = analyzeFieldLineage(model);
  assert(lineage.diagnostics.some((item) => item.code === 'source-unresolved'));
});

test('a fan-out alias may refer to the complete list member', () => {
  const model = parseMedol(`context Jobs {
    value Participant { runtimeId: UUID }
    slice Select { event Selected { participants: Participant[] } }
    slice Dispatch {
      command Dispatch { chosen: Participant from item }
      automation EachParticipant {
        on Selected
        for each Selected.participants as item
        emits Dispatch
      }
    }
  }`);
  const lineage = analyzeFieldLineage(model);
  assert(!lineage.diagnostics.some((item) => item.severity === 'error'));
  assert(lineage.links.some((item) => item.path === 'item' && item.source.endsWith('/field/participants')));
});

test('command results have separate identities and are never treated as caller inputs', () => {
  const model = parseMedol(`context Files {
    slice Upload {
      command Upload {
        name: String
        result { name: String from Upload.name checksum: String }
      }
    }
  }`);
  assert.deepEqual(model.diagnostics, []);
  const lineage = analyzeFieldLineage(model);
  const names = lineage.fields.filter((item) => item.name === 'name');
  assert.equal(names.length, 2);
  assert.notEqual(names[0].id, names[1].id);
  assert.equal(names.find((item) => item.section === 'field')?.origin, 'input');
  const output = names.find((item) => item.section === 'result')!;
  assert.equal(traceField(lineage, output.id).links.length, 1);
  assert.equal(lineage.fields.find((item) => item.name === 'checksum')?.origin, 'unknown');
  assert(lineage.diagnostics.some((item) => item.message.includes('Upload.result.checksum')));
  const invalid = parseMedol(`context Files { slice Upload { command Upload { result { checksum: String from Missing.checksum } } } }`);
  assert.throws(() => modelToCodegenModel(invalid), FieldSourceValidationError);
});

test('list and optional fields are not inferred as required scalar inputs', () => {
  const model = parseMedol(`context Work { slice Record {
    command Record { ids: UUID[] note: String? }
    event Recorded { ids: UUID note: String }
  } }`);
  const lineage = analyzeFieldLineage(model);
  assert(lineage.fields.filter((item) => item.kind === 'event').every((item) => item.origin === 'unknown'));
});

test('sync mappings may refer to source-local names', () => {
  const model = parseMedol(`context Data {
    slice Origin { readmodel Schema[] { version: String } }
    slice Copy { sync readmodel LocalSchema[] from Schema { localVersion: String from version } }
  }`);
  assert.deepEqual(model.diagnostics, []);
  const lineage = analyzeFieldLineage(model);
  assert(!lineage.diagnostics.some((item) => item.severity === 'error'));
  const target = lineage.fields.find((item) => item.name === 'localVersion')!;
  assert.equal(traceField(lineage, target.id).links.length, 1);
});

test('state history in another context stays reviewable, not proven current state', () => {
  const model = parseMedol(`context Orders {
    concept Order { state Open slice Place }
    slice Place { startsLifecycle command Place { orderId: UUID } event Placed { orderId: UUID } state Open }
  }
  context Billing { slice Charge { command Charge { orderId: UUID from Order.orderId } } }`);
  const lineage = analyzeFieldLineage(model);
  assert(!lineage.diagnostics.some((item) => item.severity === 'error'));
  assert(lineage.diagnostics.some((item) => item.code === 'state-history'));
});

test('cycles terminate and require review instead of rejecting legitimate historical loops', () => {
  const model = parseMedol(`context Data { slice History {
    event First { count: Int from Second.count }
    event Second { count: Int from First.count }
  } }`);
  const lineage = analyzeFieldLineage(model);
  assert.equal(lineage.diagnostics.filter((item) => item.code === 'source-cycle').length, 2);
  assert(lineage.diagnostics.every((item) => item.severity === 'warning'));
  assert.equal(traceField(lineage, lineage.fields[0].id).links.length, 2);
});

test('imported fields retain source identity and analysis scoping preserves full external trails', () => {
  const model = parseMedolSources([
    { sourceName: 'library.medol', text: 'context Library { slice Origin { event Saved { id: UUID } } }' },
    { sourceName: 'main.medol', text: 'context App { slice Use { command Use { id: UUID from Library.Saved.id } } }' }
  ]);
  const analysis = analyzeModel(model);
  const app = model.contexts.find((item) => item.name === 'App')!;
  const scoped = scopeAnalysis(analysis, { contextId: app.id });
  assert.equal(scoped.lineage.fields.length, 1);
  const trace = traceField(analysis.lineage, scoped.lineage.fields[0].id);
  assert.equal(trace.fields.find((item) => item.contextName === 'Library')?.range?.sourceName, 'library.medol');
  assert.equal(trace.links.length, 1);
});

test('nested object references validate every member rather than only the root', () => {
  const model = parseMedol(`context Jobs {
    value Participant { runtimeId: UUID }
    slice Select { event Selected { participant: Participant } }
    slice Dispatch { command Dispatch { runtimeId: UUID from Selected.participant.missing } }
  }`);
  assert(analyzeFieldLineage(model).diagnostics.some((item) => item.code === 'source-unresolved'));
});

test('domain-qualified references disambiguate same-named contexts', () => {
  const model = parseMedol(`
    domain One { context Data { slice Saved { event Saved { id: UUID } } } }
    domain Two { context Data { slice Saved { event Saved { id: UUID } } } }
    context Work { slice Use { command Use { id: UUID from One.Data.Saved.id } } }
  `);
  const lineage = analyzeFieldLineage(model);
  assert(!lineage.diagnostics.some((item) => item.severity === 'error'));
  assert(lineage.links.some((link) => link.source.startsWith('domain/One/')));
});

test('technical command fields and event examples do not become fabricated sources', () => {
  const model = parseMedol(`context Data { slice Record {
    command Record { id: UUID technical }
    event Recorded { otherId: UUID { example "sample" } }
  } }`);
  const lineage = analyzeFieldLineage(model);
  assert(lineage.fields.every((item) => item.origin === 'unknown'));
  assert.equal(lineage.links.length, 0);
});

test('preflight CLI distinguishes warning-only, blocking references and parser errors', () => {
  const directory = mkdtempSync(join(tmpdir(), 'medol-lineage-'));
  const path = join(directory, 'example.medol');
  const run = (source: string) => {
    writeFileSync(path, source);
    return spawnSync(process.execPath, ['--import', 'tsx', 'src/lib/fieldLineageCli.ts', path, '--json'], { encoding: 'utf8' });
  };
  try {
    let output = run('context Data { slice Record { event Recorded { id: UUID } } }');
    assert.equal(output.status, 0, output.stderr);
    let report = JSON.parse(output.stdout);
    assert.equal(report.valid, true);
    assert(report.diagnostics.some((item: { severity: string }) => item.severity === 'warning'));
    output = run(flow.replace('from Place.name', 'from Place.missing'));
    assert.equal(output.status, 1);
    report = JSON.parse(output.stdout);
    assert.equal(report.valid, false);
    assert(report.diagnostics.some((item: { code: string }) => item.code === 'source-unresolved'));
    output = run('context Broken {');
    assert.equal(output.status, 1);
    assert(JSON.parse(output.stdout).modelDiagnostics.length);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
