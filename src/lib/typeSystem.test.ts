import assert from 'node:assert/strict';
import test from 'node:test';
import { modelToCodegenModel } from './codegenModel';
import { parseMedol } from './dslParser';
import { parseMedolFile, type MedolProjectFileSystem } from './medolProject';

test('parses enums and structured value objects', () => {
  const model = parseMedol(`
    context Orders {
      enum OrderStatus {
        Draft
        Submitted
      }
      value Address {
        street: String
        city: String
      }
      slice SubmitOrder {
        command SubmitOrder {
          status: OrderStatus
          address: Address
        }
      }
    }
  `);

  assert.deepEqual(model.diagnostics, []);
  assert.deepEqual(
    model.contexts[0].valueTypes.map((type) => ({
      name: type.name,
      kind: type.kind,
      values: type.values,
      fields: type.fields.map((field) => field.name)
    })),
    [
      { name: 'OrderStatus', kind: 'enum', values: ['Draft', 'Submitted'], fields: [] },
      { name: 'Address', kind: 'object', values: [], fields: ['street', 'city'] }
    ]
  );
});

test('validates enum examples and structured value fields', () => {
  const model = parseMedol(`
    context Orders {
      enum Empty {}
      enum OrderStatus { Draft Submitted }
      value Address {
        city: MissingType
        city: String
      }
      value Recursive {
        child: Recursive
        id: UUID id
      }
      slice SubmitOrder {
        command SubmitOrder {
          status: OrderStatus
        }
        specification "Status" {
          when SubmitOrder {
            status = "Unknown"
          }
          then reject "Invalid status"
        }
      }
    }
  `);

  assert(model.diagnostics.some((message) => message.includes('enum Empty must declare at least one value')));
  assert(model.diagnostics.some((message) => message.includes('duplicate field city')));
  assert(model.diagnostics.some((message) => message.includes('unknown type MissingType')));
  assert(model.diagnostics.some((message) => message.includes('cyclic structured value Recursive -> Recursive')));
  assert(model.diagnostics.some((message) => message.includes('cannot declare identity or generated attributes')));
  assert(model.diagnostics.some((message) => message.includes('is not a member of enum OrderStatus')));
});

test('loads imports, merges context fragments, and keeps qualified IDs stable', () => {
  const files = new Map<string, string>([
    ['/workspace/types.medol', `
      domain Commerce {
        context Orders {
          enum OrderStatus { Draft Submitted }
          value Address {
            city: String
          }
        }
      }
    `],
    ['/workspace/main.medol', `
      import "./types.medol"
      domain Commerce {
        context Orders {
          aggregate Order {
            slice SubmitOrder {
              command SubmitOrder {
                status: OrderStatus
                address: Address
              }
            }
          }
        }
      }
    `]
  ]);
  const fileSystem: MedolProjectFileSystem = {
    readFile: (path) => {
      const text = files.get(path);
      if (text === undefined) throw new Error('not found');
      return text;
    },
    resolveImport: (_importer, imported) => `/workspace/${imported.replace('./', '')}`
  };

  const model = parseMedolFile('/workspace/main.medol', fileSystem);
  assert.deepEqual(model.diagnostics, []);
  assert.equal(model.contexts.length, 1);
  assert.deepEqual(model.contexts[0].valueTypes.map((type) => type.name), ['OrderStatus', 'Address']);

  const first = modelToCodegenModel(model);
  const second = modelToCodegenModel(parseMedolFile('/workspace/main.medol', fileSystem));
  const inline = modelToCodegenModel(parseMedol(`
    domain Commerce {
      context Orders {
        enum OrderStatus { Draft Submitted }
        value Address {
          city: String
        }
        aggregate Order {
          slice SubmitOrder {
            command SubmitOrder {
              status: OrderStatus
              address: Address
            }
          }
        }
      }
    }
  `));
  assert.equal(first.aggregates[0].id, second.aggregates[0].id);
  assert.equal(first.slices[0].id, second.slices[0].id);
  assert.equal(first.valueTypes[0].id, second.valueTypes[0].id);
  assert.equal(first.aggregates[0].id, inline.aggregates[0].id);
  assert.equal(first.slices[0].id, inline.slices[0].id);
  assert.equal(first.valueTypes[0].id, inline.valueTypes[0].id);
});

test('reports circular imports and keeps same aggregate names distinct across contexts', () => {
  const files = new Map<string, string>([
    ['/workspace/a.medol', 'import "./b.medol"\ncontext Sales { aggregate Item {} }'],
    ['/workspace/b.medol', 'import "./a.medol"\ncontext Catalog { aggregate Item {} }']
  ]);
  const fileSystem: MedolProjectFileSystem = {
    readFile: (path) => files.get(path) ?? (() => { throw new Error('not found'); })(),
    resolveImport: (_importer, imported) => `/workspace/${imported.replace('./', '')}`
  };

  const model = parseMedolFile('/workspace/a.medol', fileSystem);
  assert(model.diagnostics.some((message) => message.includes('Circular import')));
  const codegen = modelToCodegenModel(model);
  assert.equal(new Set(codegen.aggregates.map((aggregate) => aggregate.id)).size, 2);
});
