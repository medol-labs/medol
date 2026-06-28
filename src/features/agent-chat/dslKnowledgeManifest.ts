import type { AgentDslKnowledgeManifest } from './dslKnowledge';

export const eventModelingDslKnowledgeManifest: AgentDslKnowledgeManifest = {
  id: 'medol-agent-skills',
  version: '2026-06-28',
  language: 'medol',
  title: 'MEDOL agent skills',
  summary: 'Runtime-neutral MEDOL modeling and implementation skills loaded from medol/.agent/skills.',
  compactRules: [
    'Treat MEDOL as the source of truth.',
    'Prefer small focused patches.',
    'Ask for clarification or add a hotspot when domain behavior is unclear.',
    'Preserve existing user-authored model content.'
  ]
};
