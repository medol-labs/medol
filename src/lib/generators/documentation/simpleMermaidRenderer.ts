interface MermaidNodeRef {
  id: string;
  label?: string;
}

export const renderSimpleMermaidSvg = (source: string): string | undefined => {
  const lines = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('%%'));
  const direction = lines[0]?.match(/^flowchart\s+(LR|RL|TB|TD|BT)$/i)?.[1]?.toUpperCase();
  if (!direction) return undefined;

  const nodes = new Map<string, string>();
  const edges: Array<[string, string]> = [];

  const rememberNode = (node: MermaidNodeRef): void => {
    if (!nodes.has(node.id) || node.label) nodes.set(node.id, node.label ?? nodes.get(node.id) ?? node.id);
  };

  for (const line of lines.slice(1)) {
    const standaloneNode = parseNodeRef(line);
    if (standaloneNode) {
      rememberNode(standaloneNode);
      continue;
    }

    const edge = parseEdge(line);
    if (edge) {
      rememberNode(edge[0]);
      rememberNode(edge[1]);
      edges.push([edge[0].id, edge[1].id]);
    }
  }
  if (!nodes.size) return undefined;

  const horizontal = direction === 'LR' || direction === 'RL';
  const nodeIds = [...nodes.keys()];
  const nodeWidth = 180;
  const nodeHeight = 64;
  const gap = 56;
  const margin = 28;
  const width = horizontal
    ? margin * 2 + nodeIds.length * nodeWidth + Math.max(0, nodeIds.length - 1) * gap
    : margin * 2 + nodeWidth;
  const height = horizontal
    ? margin * 2 + nodeHeight
    : margin * 2 + nodeIds.length * nodeHeight + Math.max(0, nodeIds.length - 1) * gap;
  const positions = new Map(
    nodeIds.map((id, index) => [
      id,
      horizontal
        ? { x: margin + index * (nodeWidth + gap), y: margin }
        : { x: margin, y: margin + index * (nodeHeight + gap) }
    ] as const)
  );
  const edgeXml = edges.flatMap(([sourceId, targetId]) => {
    const sourcePosition = positions.get(sourceId);
    const targetPosition = positions.get(targetId);
    if (!sourcePosition || !targetPosition) return [];
    const x1 = horizontal ? sourcePosition.x + nodeWidth : sourcePosition.x + nodeWidth / 2;
    const y1 = horizontal ? sourcePosition.y + nodeHeight / 2 : sourcePosition.y + nodeHeight;
    const x2 = horizontal ? targetPosition.x : targetPosition.x + nodeWidth / 2;
    const y2 = horizontal ? targetPosition.y + nodeHeight / 2 : targetPosition.y;
    return [`<path d="M ${x1} ${y1} L ${x2} ${y2}" stroke="#64748b" stroke-width="1.6" fill="none" marker-end="url(#arrow)"/>`];
  }).join('');
  const nodeXml = nodeIds.map((id) => {
    const position = positions.get(id)!;
    const label = nodes.get(id) ?? id;
    const labelLines = wrapSvgText(label, 15).slice(0, 3);
    const textY = position.y + nodeHeight / 2 - (labelLines.length - 1) * 9;
    return [
      `<rect x="${position.x}" y="${position.y}" width="${nodeWidth}" height="${nodeHeight}" rx="8" fill="#f8fafc" stroke="#94a3b8" stroke-width="1.2"/>`,
      ...labelLines.map((line, lineIndex) =>
        `<text x="${position.x + nodeWidth / 2}" y="${textY + lineIndex * 18}" font-family="Songti SC, PingFang SC, Arial Unicode MS, Arial, sans-serif" font-size="12" text-anchor="middle" dominant-baseline="middle" fill="#0f172a">${escapeXml(line)}</text>`
      )
    ].join('');
  }).join('');

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Mermaid diagram">`,
    '<defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b"/></marker></defs>',
    '<rect width="100%" height="100%" fill="#ffffff"/>',
    edgeXml,
    nodeXml,
    '</svg>'
  ].join('');
};

const parseEdge = (line: string): [MermaidNodeRef, MermaidNodeRef] | undefined => {
  const parts = line.split(/\s*-->\s*/);
  if (parts.length !== 2) return undefined;
  const source = parseNodeRef(parts[0]);
  const target = parseNodeRef(parts[1]);
  return source && target ? [source, target] : undefined;
};

const parseNodeRef = (value: string): MermaidNodeRef | undefined => {
  const match = value.match(/^([A-Za-z][\w-]*)(?:\["([^"]+)"\])?$/);
  if (!match) return undefined;
  return {
    id: match[1],
    ...(match[2] ? { label: match[2] } : {})
  };
};

const wrapSvgText = (value: string, maxLength: number): string[] => {
  const words = value.split(/\s+/).filter(Boolean);
  if (!words.length) return [value];
  if (words.length === 1 && [...words[0]].length > maxLength) {
    const characters = [...words[0]];
    const lines: string[] = [];
    for (let index = 0; index < characters.length; index += maxLength) {
      lines.push(characters.slice(index, index + maxLength).join(''));
    }
    return lines;
  }
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxLength || !current) {
      current = next;
      continue;
    }
    lines.push(current);
    current = word;
  }
  if (current) lines.push(current);
  return lines;
};

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

