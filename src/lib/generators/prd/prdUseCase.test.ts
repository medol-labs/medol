import assert from 'node:assert/strict';
import test from 'node:test';
import { parseMedol } from '../../dslParser';
import { generatePrd } from './prdGenerator';
import { renderPrdMarkdown } from './prdMarkdownRenderer';

const source = `domain Demo {
  context Organizations {
    slice RegisterOrganization {
      actor OrganizationAdmin
      command RegisterOrganization {
        organizationId: UUID id generated technical
        organizationName: String
      }
      event OrganizationRegistered {
        organizationId: UUID id technical
        organizationName: String
      }
      state Registered
      specification "Organization Name Unique" {
        rule """
          Organization names must be unique.
        """
        scenario "Reject Duplicate Organization" {
          given OrganizationRegistered {
            organizationName = "Acme"
          }
          when RegisterOrganization {
            organizationName = "Acme"
          }
          then reject "Organization Already Exists"
        }
      }
    }
    slice ActivateOrganization {
      command ActivateOrganization { organizationId: UUID id technical }
      event OrganizationActivated { organizationId: UUID id technical }
    }
    slice OrganizationDirectory {
      readmodel OrganizationDirectory[] {
        organizationId: UUID id
        organizationName: String
      }
    }
  }
}`;

test('builds sourced use cases without inventing business preconditions', () => {
  const model = parseMedol(source);
  assert.deepEqual(model.diagnostics, []);
  const { document, trace } = generatePrd(model, { sourceText: source, generatedAt: '2026-01-01T00:00:00Z' });
  const registration = document.useCases.find((item) => item.name === 'RegisterOrganization');
  assert(registration);
  assert.match(registration.id, /^UC-[0-9A-F]{8}$/);
  assert.deepEqual(registration.inputs.map((item) => [item.name, item.origin]), [
    ['organizationId', 'generated'],
    ['organizationName', 'user']
  ]);
  assert.equal(registration.mainFlow.length, 2);
  assert.deepEqual(registration.preconditions, []);
  assert.equal(registration.alternateFlows[0].outcome.text, 'Organization Already Exists');
  assert(registration.alternateFlows[0].sourceRefs[0].includes('/gwt/'));
  assert.match(registration.businessRules[0].text, /names must be unique/);
  assert(registration.businessRules[0].sourceRefs[0].includes('/gwt/'));
  assert(registration.openQuestions.some((question) => question.includes('preconditions')));
  assert(trace.sections.find((section) => section.sectionId === 'prd.section.slice.RegisterOrganization')
    ?.generatedBlocks.some((block) => block.blockId === 'useCase'));

  const activation = document.useCases.find((item) => item.name === 'ActivateOrganization');
  assert(activation);
  assert.equal(activation.alternateFlows.length, 0);
  assert(activation.openQuestions.some((question) => question.includes('exceptional')));
});

test('renders use-case flow and explicitly marks missing requirements', () => {
  const { document } = generatePrd(parseMedol(source));
  const markdown = renderPrdMarkdown(document, 'zh-CN');
  assert.match(markdown, /\*\*用例流程\*\*/);
  assert.match(markdown, /业务前提: 待确认/);
  assert.match(markdown, /organizationName/);
  assert.match(markdown, /Organization Already Exists/);
  assert.match(markdown, /异常或扩展流程:[\s\S]*待确认/);
});

test('keeps field mappings structured and hides modeling syntax in PRD prose', () => {
  const modeled = parseMedol(`context Organizations {
    slice Directory {
      readmodel OrganizationDirectory[] {
        organizationId: UUID id
        organizationName: String
      }
    }
    slice ActivateOrganization {
      command ActivateOrganization {
        organizationId: UUID id technical
        organizationName: String derived from OrganizationDirectory.organizationName by organizationId
      }
      event OrganizationActivated { organizationId: UUID id technical }
    }
  }`);
  assert.deepEqual(modeled.diagnostics, []);
  const { document } = generatePrd(modeled);
  const field = document.slices.find((slice) => slice.name === 'ActivateOrganization')?.command?.fields[1];
  assert.equal(field?.mapping?.kind, 'derived');
  assert.deepEqual(field?.mapping?.sources, ['OrganizationDirectory.organizationName']);
  const markdown = renderPrdMarkdown(document, 'zh-CN');
  assert.match(markdown, /根据关联业务数据确定/);
  assert.doesNotMatch(markdown, /derived from OrganizationDirectory/);
});

test('separates modeled success and rejection events for an automated port', () => {
  const model = parseMedol(`context RuntimeOperations {
    slice ReceiveExecutionPlan {
      event ExecutionPlanReceived { executionPlanId: UUID id technical }
    }
    slice AcceptExecutionPlan {
      port
      automation AcceptWhenReceived {
        on ExecutionPlanReceived
        emits AcceptExecutionPlan
      }
      command AcceptExecutionPlan {
        executionPlanId: UUID id technical from ExecutionPlanReceived.executionPlanId
      }
      event ExecutionPlanAccepted { executionPlanId: UUID id technical }
      event ExecutionPlanRejected { executionPlanId: UUID id technical }
      specification "Local Acceptance" {
        rule """The plan is accepted only if local requirements are satisfied."""
        scenario "Accepted" {
          given ExecutionPlanReceived { executionPlanId = "plan-1" }
          when AcceptExecutionPlan { executionPlanId = "plan-1" }
          then ExecutionPlanAccepted
        }
        scenario "Rejected" {
          given ExecutionPlanReceived { executionPlanId = "plan-2" }
          when AcceptExecutionPlan { executionPlanId = "plan-2" }
          then ExecutionPlanRejected
        }
      }
    }
  }`);
  assert.deepEqual(model.diagnostics, []);
  const { document } = generatePrd(model);
  const useCase = document.useCases[0];
  assert.equal(useCase.initiation, 'automation');
  assert.equal(useCase.trigger.text, 'ExecutionPlanReceived');
  assert.deepEqual(useCase.mainFlow.map((step) => step.text), ['AcceptExecutionPlan', 'ExecutionPlanAccepted']);
  assert.equal(useCase.alternateFlows[0].outcome.text, 'ExecutionPlanRejected');
  assert.deepEqual(useCase.alternateFlows[0].conditions, []);
  assert.equal(useCase.alternateFlows[0].scenarioContext[0].text, 'ExecutionPlanReceived');
  assert.equal(useCase.inputs[0].origin, 'event');
  assert.equal(useCase.businessRules.length, 1);
  assert.match(useCase.businessRules[0].text, /local requirements/);
  assert.equal(useCase.businessRules[0].sourceRefs.length, 2);

  const markdown = renderPrdMarkdown(document, 'zh-CN');
  assert.match(markdown, /发起方: 系统自动触发/);
  assert.match(markdown, /判定条件待确认；业务结果：Execution Plan Rejected/);
  assert.doesNotMatch(markdown, /发起方提交Accept Execution Plan/);
});

test('creates a query use case without treating display columns as input', () => {
  const model = parseMedol(`context Organizations {
    slice OrganizationDirectory {
      actor OrganizationAdmin
      readmodel OrganizationDirectory[] {
        organizationId: UUID id
        organizationName: String query
        registeredAt: DateTime
      }
    }
  }`);
  assert.deepEqual(model.diagnostics, []);
  const { document } = generatePrd(model);
  const useCase = document.useCases[0];
  assert.equal(useCase.trigger.kind, 'readmodel');
  assert.deepEqual(useCase.inputs.map((item) => item.name), ['organizationName']);
  assert.equal(useCase.inputs[0].required, false);
  assert.deepEqual(useCase.mainFlow.map((item) => item.text), ['OrganizationDirectory']);
  assert.match(renderPrdMarkdown(document, 'zh-CN'), /系统提供“Organization Directory”查询结果/);
});
