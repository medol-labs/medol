import assert from 'node:assert/strict';
import test from 'node:test';
import { applyDslOperations, normalizeMedolPatchContent } from './dslOperationTools';

test('normalizes full-width MEDOL punctuation outside strings', () => {
  assert.equal(
    normalizeMedolPatchContent('shape： Int[]？\nnote "保留？"\nrule """也保留？"""'),
    'shape: Int[]?\nnote "保留？"\nrule """也保留？"""'
  );
});

test('inserts a complete slice as a sibling of the targeted slice', () => {
  const baseDsl = `context Features {
  slice Existing {
    command Existing {
      featureId: UUID id
    }
  }
}
`;
  const result = applyDslOperations(baseDsl, [{
    operation: 'insert',
    target: 'slice Existing',
    content: `slice NewFeature {
  command CreateFeature {
    shape: Int[]？
  }
}`
  }]);

  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.diagnostics, []);
  assert.match(result.nextDsl, /    }\n  }\n  slice NewFeature \{/);
  assert.match(result.nextDsl, /shape: Int\[\]\?/);
});

test('continues to insert child elements inside a slice', () => {
  const baseDsl = `context Features {
  slice Existing {
    command Existing {
      featureId: UUID id
    }
  }
}
`;
  const result = applyDslOperations(baseDsl, [{
    operation: 'insert',
    target: 'slice Existing',
    content: `event ExistingCreated {
  featureId: UUID
}`
  }]);

  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.diagnostics, []);
  assert.match(result.nextDsl, /    event ExistingCreated \{/);
});
