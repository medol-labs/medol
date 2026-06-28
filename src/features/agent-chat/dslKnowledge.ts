import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { eventModelingDslKnowledgeManifest } from './dslKnowledgeManifest';

export interface AgentSkill {
  id: string;
  title: string;
  description: string;
  content: string;
  compactRules: string[];
}

export interface AgentDslKnowledge {
  id: string;
  version: string;
  language: 'medol';
  title: string;
  summary: string;
  skills: AgentSkill[];
  compactRules: string[];
}

export interface AgentDslKnowledgeManifest {
  id: string;
  version: string;
  language: AgentDslKnowledge['language'];
  title: string;
  summary: string;
  compactRules: string[];
}

export interface AgentContextItem {
  type: 'dsl-knowledge';
  id: string;
  version: string;
  title: string;
  content: AgentDslKnowledgeManifest;
}

const knowledgeVersion = '2026-06-28';
const defaultSkillIds = [
  'medol-modeling',
  'load-medol-context',
  'propose-medol-patch'
];

let cachedKnowledge: AgentDslKnowledge | undefined;

export const loadEventModelingDslKnowledge = (): AgentDslKnowledge => {
  cachedKnowledge ??= buildKnowledge();
  return cachedKnowledge;
};

export const eventModelingDslKnowledge = loadEventModelingDslKnowledge();
export const requiredDslKnowledgeContext: AgentContextItem = {
  type: 'dsl-knowledge',
  id: eventModelingDslKnowledgeManifest.id,
  version: eventModelingDslKnowledgeManifest.version,
  title: eventModelingDslKnowledgeManifest.title,
  content: eventModelingDslKnowledgeManifest
};
export { eventModelingDslKnowledgeManifest };

export function toManifest(knowledge: AgentDslKnowledge): AgentDslKnowledgeManifest {
  return {
    id: knowledge.id,
    version: knowledge.version,
    language: knowledge.language,
    title: knowledge.title,
    summary: knowledge.summary,
    compactRules: knowledge.compactRules
  };
}

function buildKnowledge(): AgentDslKnowledge {
  const skills = readAgentSkills();
  const baseline = defaultSkillIds
    .map((id) => skills.find((skill) => skill.id === id))
    .filter((skill): skill is AgentSkill => Boolean(skill));

  return {
    id: 'medol-agent-skills',
    version: knowledgeVersion,
    language: 'medol',
    title: 'MEDOL agent skills',
    summary: 'Runtime-neutral MEDOL modeling and implementation skills loaded from medol/.agent/skills.',
    skills,
    compactRules: baseline.flatMap((skill) => skill.compactRules).slice(0, 18)
  };
}

function readAgentSkills(): AgentSkill[] {
  const skillsDir = findSkillsDir(process.cwd());
  if (!existsSync(skillsDir)) {
    return [fallbackMedolSkill()];
  }

  return readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const id = entry.name;
      const skillPath = path.join(skillsDir, id, 'SKILL.md');
      if (!existsSync(skillPath)) return undefined;
      return parseSkill(id, readFileSync(skillPath, 'utf8'));
    })
    .filter((skill): skill is AgentSkill => Boolean(skill))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function findSkillsDir(cwd: string): string {
  const candidates = [
    path.resolve(cwd, '.agent', 'skills'),
    path.resolve(cwd, 'medol', '.agent', 'skills')
  ];
  let current = cwd;
  while (current !== path.dirname(current)) {
    candidates.push(path.resolve(current, '.agent', 'skills'));
    candidates.push(path.resolve(current, 'medol', '.agent', 'skills'));
    current = path.dirname(current);
  }
  return candidates.find((candidate) => existsSync(candidate)) ?? candidates[0];
}

function parseSkill(id: string, raw: string): AgentSkill {
  const { attributes, body } = splitFrontmatter(raw);
  const title = attributes.name ?? firstHeading(body) ?? id;
  const description = attributes.description ?? firstParagraph(body) ?? '';
  return {
    id,
    title,
    description,
    content: body.trim(),
    compactRules: extractCompactRules(body)
  };
}

function splitFrontmatter(raw: string): { attributes: Record<string, string>; body: string } {
  if (!raw.startsWith('---')) return { attributes: {}, body: raw };
  const end = raw.indexOf('\n---', 3);
  if (end < 0) return { attributes: {}, body: raw };

  const frontmatter = raw.slice(3, end).trim();
  const attributes = Object.fromEntries(frontmatter
    .split('\n')
    .map((line) => line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => [match[1], match[2].replace(/^["']|["']$/g, '').trim()]));
  return { attributes, body: raw.slice(end + 4) };
}

function extractCompactRules(body: string): string[] {
  return body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2))
    .filter(Boolean)
    .slice(0, 10);
}

function firstHeading(body: string): string | undefined {
  return body.split('\n').map((line) => line.match(/^#\s+(.+)$/)?.[1]).find(Boolean);
}

function firstParagraph(body: string): string | undefined {
  return body.split('\n').map((line) => line.trim()).find((line) => line && !line.startsWith('#') && !line.startsWith('- '));
}

function fallbackMedolSkill(): AgentSkill {
  return {
    id: 'medol-modeling',
    title: 'MEDOL Modeling',
    description: 'Fallback MEDOL modeling guidance used when .agent/skills is unavailable.',
    content: [
      '# MEDOL Modeling',
      '',
      '- Treat MEDOL as the source of truth.',
      '- Prefer small focused patches.',
      '- Ask for clarification or add a hotspot when domain behavior is unclear.',
      '- Preserve existing user-authored model content.'
    ].join('\n'),
    compactRules: [
      'Treat MEDOL as the source of truth.',
      'Prefer small focused patches.',
      'Ask for clarification or add a hotspot when domain behavior is unclear.',
      'Preserve existing user-authored model content.'
    ]
  };
}
