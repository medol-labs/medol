import assert from 'node:assert/strict';
import test from 'node:test';
import { parseMedol } from '../../lib/dslParser';
import { buildModelSearchIndex, searchModelItems } from './modelSearch';

const model = parseMedol(`
  domain Federation {
    context Training {
      value FeatureDefinition {
        featureName: String
      }
      aggregate TrainingJob {
        slice StartTraining {
          command StartTraining {
            jobId: UUID
          }
          event TrainingStarted {
            jobId: UUID
          }
        }
      }
    }
  }
`);
const index = buildModelSearchIndex(model);

test('builds searchable model paths with source ranges', () => {
  const command = index.find((item) => item.kind === 'command');
  assert.equal(command?.name, 'StartTraining');
  assert.deepEqual(command?.path, ['Federation', 'Training', 'TrainingJob', 'StartTraining']);
  assert.equal(command?.sourceRange?.start.line, 9);
});

test('supports kind filters, acronym, and hidden field results', () => {
  assert.equal(searchModelItems(index, 'ST')[0]?.name, 'StartTraining');
  assert(searchModelItems(index, 'event:started').every((item) => item.kind === 'event'));
  assert.equal(searchModelItems(index, 'featureName').length, 0);
  assert.equal(searchModelItems(index, 'field:featureName')[0]?.kind, 'field');
});
