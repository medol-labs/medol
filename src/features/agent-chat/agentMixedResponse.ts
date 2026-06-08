import {
  parseAgentStructuredResponse,
  type AgentStructuredResponse
} from './agentStructuredResponse';

interface JsonSection {
  start: number;
  end: number;
  value: AgentStructuredResponse;
}

export const parseAgentMixedResponse = (text: string): AgentStructuredResponse => {
  const jsonSection = findStructuredJsonSection(text);
  if (!jsonSection) {
    return {
      type: 'answer',
      content: text.trim() || 'The model returned an empty response.'
    };
  }

  const naturalContent = cleanNaturalContent(
    `${text.slice(0, jsonSection.start)}${text.slice(jsonSection.end)}`
  );
  if (!naturalContent) return jsonSection.value;

  return {
    ...jsonSection.value,
    content: naturalContent
  };
};

const findStructuredJsonSection = (text: string): JsonSection | undefined => {
  return findTaggedJson(text)
    ?? findFencedJson(text)
    ?? findBalancedJson(text);
};

const findTaggedJson = (text: string): JsonSection | undefined => {
  const pattern = /<agent-json>\s*([\s\S]*?)\s*<\/agent-json>/gi;
  let match: RegExpExecArray | null;
  let result: JsonSection | undefined;

  while ((match = pattern.exec(text))) {
    const value = parseStructuredJson(match[1]);
    if (value) {
      result = {
        start: match.index,
        end: match.index + match[0].length,
        value
      };
    }
  }

  return result;
};

const findFencedJson = (text: string): JsonSection | undefined => {
  const pattern = /```(?:json)?\s*([\s\S]*?)\s*```/gi;
  let match: RegExpExecArray | null;
  let result: JsonSection | undefined;

  while ((match = pattern.exec(text))) {
    const value = parseStructuredJson(match[1]);
    if (value) {
      result = {
        start: match.index,
        end: match.index + match[0].length,
        value
      };
    }
  }

  return result;
};

const findBalancedJson = (text: string): JsonSection | undefined => {
  let result: JsonSection | undefined;

  for (let start = 0; start < text.length; start += 1) {
    if (text[start] !== '{') continue;
    const end = findObjectEnd(text, start);
    if (end < 0) continue;

    const value = parseStructuredJson(text.slice(start, end + 1));
    if (value) {
      result = { start, end: end + 1, value };
    }
    start = end;
  }

  return result;
};

const findObjectEnd = (text: string, start: number): number => {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const character = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
    } else if (character === '{') {
      depth += 1;
    } else if (character === '}') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }

  return -1;
};

const parseStructuredJson = (text: string): AgentStructuredResponse | undefined => {
  try {
    return parseAgentStructuredResponse(JSON.parse(text.trim()));
  } catch {
    return undefined;
  }
};

const cleanNaturalContent = (text: string): string => {
  return text
    .replace(/^\s*(?:JSON|Structured result|结构化结果)\s*:?\s*$/gim, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};
