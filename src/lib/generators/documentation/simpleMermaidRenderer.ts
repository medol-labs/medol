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
  const edges: Array<[string, string, string?]> = [];

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
      edges.push([edge[0].id, edge[1].id, edge[2]]);
    }
  }
  if (!nodes.size) return undefined;

  const horizontal = direction === 'LR' || direction === 'RL';
  const nodeIds = [...nodes.keys()];
  const nodeWidth = 260;
  const columnGap = 64;
  const rowGap = horizontal ? 136 : 64;
  const margin = 64;
  const columns = horizontal
    ? Math.min(nodeIds.length, nodeIds.length > 12 ? 4 : nodeIds.length)
    : 1;
  const rows = Math.ceil(nodeIds.length / Math.max(1, columns));
  const labelLines = new Map(nodeIds.map((id) => [
    id,
    (nodes.get(id) ?? id)
      .split(/<br\s*\/?\s*>/i)
      .flatMap((part) => part.replace(/（/g, '\n（').split('\n'))
      .filter((part) => part.trim())
      .flatMap((part) => wrapSvgText(part, 34))
  ]));
  const nodeHeights = new Map(nodeIds.map((id) => [
    id,
    Math.max(64, (labelLines.get(id)?.length ?? 1) * 18 + 24)
  ]));
  const rowHeights = Array.from({ length: rows }, (_, row) => Math.max(
    ...nodeIds.slice(row * columns, (row + 1) * columns).map((id) => nodeHeights.get(id) ?? 64)
  ));
  const rowOffsets = rowHeights.map((_, row) => margin + rowHeights.slice(0, row).reduce((sum, height) => sum + height + rowGap, 0));
  const width = margin * 2 + columns * nodeWidth + Math.max(0, columns - 1) * columnGap;
  const height = margin * 2 + rowHeights.reduce((sum, rowHeight) => sum + rowHeight, 0) + Math.max(0, rows - 1) * rowGap;
  const positions = new Map(
    nodeIds.map((id, index) => [
      id,
      {
        x: margin + (index % columns) * (nodeWidth + columnGap),
        y: rowOffsets[Math.floor(index / columns)]
      }
    ] as const)
  );
  const rowById = new Map(nodeIds.map((id, index) => [id, Math.floor(index / columns)]));
  const columnById = new Map(nodeIds.map((id, index) => [id, index % columns]));
  const corridorGroups = new Map<number, number[]>();
  const sourcePortGroups = new Map<string, number[]>();
  const targetPortGroups = new Map<string, number[]>();
  const edgePortSides = new Map<number, { source: number; target: number }>();
  if (horizontal) edges.forEach(([sourceId, targetId], index) => {
    const sourceRow = rowById.get(sourceId) ?? 0;
    const targetRow = rowById.get(targetId) ?? 0;
    const sourceColumn = columnById.get(sourceId) ?? 0;
    const targetColumn = columnById.get(targetId) ?? 0;
    if (sourceRow === targetRow && targetColumn - sourceColumn === (direction === 'RL' ? -1 : 1)) return;
    const corridorRow = horizontalCorridorRow(sourceRow, targetRow, rows);
    corridorGroups.set(corridorRow, [...(corridorGroups.get(corridorRow) ?? []), index]);
    const sourceSide = corridorRow < sourceRow ? -1 : 1;
    const targetSide = sourceRow === targetRow ? sourceSide : -sourceSide;
    edgePortSides.set(index, { source: sourceSide, target: targetSide });
    const sourceKey = `${sourceId}:${sourceSide}`;
    const targetKey = `${targetId}:${targetSide}`;
    sourcePortGroups.set(sourceKey, [...(sourcePortGroups.get(sourceKey) ?? []), index]);
    targetPortGroups.set(targetKey, [...(targetPortGroups.get(targetKey) ?? []), index]);
  });
  const routedEdges = edges.flatMap(([sourceId, targetId, condition], index) => {
    const sourcePosition = positions.get(sourceId);
    const targetPosition = positions.get(targetId);
    if (!sourcePosition || !targetPosition) return [];
    const sourceHeight = nodeHeights.get(sourceId) ?? 64;
    const targetHeight = nodeHeights.get(targetId) ?? 64;
    const sourceRow = rowById.get(sourceId) ?? 0;
    const targetRow = rowById.get(targetId) ?? 0;
    const sourceColumn = columnById.get(sourceId) ?? 0;
    const targetColumn = columnById.get(targetId) ?? 0;
    const forwardAdjacent = horizontal
      && sourceRow === targetRow
      && targetColumn - sourceColumn === (direction === 'RL' ? -1 : 1);
    const corridorRow = horizontalCorridorRow(sourceRow, targetRow, rows);
    const corridorEdges = corridorGroups.get(corridorRow) ?? [];
    const laneIndex = corridorEdges.indexOf(index);
    const laneOffset = laneIndex < 0 ? 0 : (laneIndex - (corridorEdges.length - 1) / 2) * Math.min(20, rowGap / (corridorEdges.length + 1));
    const portSides = edgePortSides.get(index);
    const sourcePortOffset = portSides
      ? edgePortOffset(sourcePortGroups.get(`${sourceId}:${portSides.source}`) ?? [], index, sourceHeight, portSides.source)
      : 0;
    const targetPortOffset = portSides
      ? edgePortOffset(targetPortGroups.get(`${targetId}:${portSides.target}`) ?? [], index, targetHeight, portSides.target)
      : 0;
    const path = horizontal
      ? horizontalEdgePath({
          source: sourcePosition,
          target: targetPosition,
          sourceHeight,
          targetHeight,
          sourceRow,
          targetRow,
          nodeWidth,
          rowHeights,
          rowOffsets,
          columnGap,
          rowGap,
          laneOffset,
          sourcePortOffset,
          targetPortOffset,
          reverse: direction === 'RL',
          direct: forwardAdjacent
        })
      : verticalEdgePath({
          source: sourcePosition,
          target: targetPosition,
          sourceHeight,
          targetHeight,
          sourceRow,
          targetRow,
          nodeWidth,
          gap: rowGap,
          reverse: direction === 'BT'
        });
    const colorIndex = nodeIds.indexOf(sourceId) % edgeColors.length;
    const detour = horizontal && !forwardAdjacent;
    const label = detour
      ? `${shortNodeLabel(nodes.get(sourceId) ?? sourceId)} → ${shortNodeLabel(nodes.get(targetId) ?? targetId)}${condition ? ` · ${condition}` : ''}`
      : condition;
    return [{ sourceId, targetId, path, color: detour ? edgeColors[colorIndex] : '#64748b', marker: detour ? `arrow-${colorIndex}` : 'arrow', detour, label }];
  });
  const edgeXml = routedEdges.map(({ path, color, marker }) =>
    `<path d="${path.d}" stroke="${color}" stroke-width="2" fill="none" marker-end="url(#${marker})"/>`
  ).join('');
  const crossingXml = renderCrossingGaps(routedEdges);
  const portXml = routedEdges.filter(({ detour }) => detour).map(({ path, color }) =>
    `<circle cx="${path.points[0].x}" cy="${path.points[0].y}" r="3.5" fill="${color}" stroke="#ffffff" stroke-width="1"/>`
  ).join('');
  const edgeLabelXml = routedEdges.flatMap(({ path, color, label }) => label ? [
    `<text x="${path.labelX}" y="${path.labelY}" font-family="Songti SC, PingFang SC, Arial, sans-serif" font-size="11" font-weight="600" text-anchor="middle" fill="${color}" stroke="#ffffff" stroke-width="5" paint-order="stroke">${escapeXml(label)}</text>`
  ] : []).join('');
  const nodeXml = nodeIds.map((id) => {
    const position = positions.get(id)!;
    const lines = labelLines.get(id) ?? [id];
    const nodeHeight = nodeHeights.get(id) ?? 64;
    const textY = position.y + nodeHeight / 2 - (lines.length - 1) * 9;
    return [
      `<rect x="${position.x}" y="${position.y}" width="${nodeWidth}" height="${nodeHeight}" rx="8" fill="#f8fafc" stroke="#94a3b8" stroke-width="1.2"/>`,
      ...lines.map((line, lineIndex) =>
        `<text x="${position.x + nodeWidth / 2}" y="${textY + lineIndex * 18}" font-family="Songti SC, PingFang SC, Arial Unicode MS, Arial, sans-serif" font-size="12" text-anchor="middle" dominant-baseline="middle" fill="#0f172a">${escapeXml(line)}</text>`
      )
    ].join('');
  }).join('');

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Mermaid diagram">`,
    `<defs>${['#64748b', ...edgeColors].map((color, index) => `<marker id="${index ? `arrow-${index - 1}` : 'arrow'}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${color}"/></marker>`).join('')}</defs>`,
    '<rect width="100%" height="100%" fill="#ffffff"/>',
    edgeXml,
    crossingXml,
    portXml,
    edgeLabelXml,
    nodeXml,
    '</svg>'
  ].join('');
};

interface EdgePosition {
  x: number;
  y: number;
}

interface RoutedEdge {
  d: string;
  labelX: number;
  labelY: number;
  points: EdgePosition[];
}

const edgeColors = ['#087e8b', '#ad5a16', '#3463a3', '#a03d68', '#687d20', '#7651a8'];

const shortNodeLabel = (label: string): string =>
  label.split(/<br\s*\/?\s*>/i)[0].replace(/（[^）]*）/g, '').trim();

const renderCrossingGaps = (edges: Array<{
  sourceId: string;
  targetId: string;
  path: RoutedEdge;
  color: string;
}>): string => {
  const gaps = new Map<string, { x: number; y: number; color: string }>();
  for (let first = 0; first < edges.length; first += 1) {
    for (let second = first + 1; second < edges.length; second += 1) {
      const a = edges[first];
      const b = edges[second];
      if ([a.sourceId, a.targetId].some((id) => id === b.sourceId || id === b.targetId)) continue;
      for (const [vertical, horizontal] of [[a, b], [b, a]]) {
        for (let v = 1; v < vertical.path.points.length; v += 1) {
          const v0 = vertical.path.points[v - 1];
          const v1 = vertical.path.points[v];
          if (v0.x !== v1.x) continue;
          for (let h = 1; h < horizontal.path.points.length; h += 1) {
            const h0 = horizontal.path.points[h - 1];
            const h1 = horizontal.path.points[h];
            if (h0.y !== h1.y) continue;
            const x = v0.x;
            const y = h0.y;
            if (x <= Math.min(h0.x, h1.x) + 8 || x >= Math.max(h0.x, h1.x) - 8) continue;
            if (y <= Math.min(v0.y, v1.y) + 8 || y >= Math.max(v0.y, v1.y) - 8) continue;
            gaps.set(`${x}:${y}`, { x, y, color: vertical.color });
          }
        }
      }
    }
  }
  return [...gaps.values()].map(({ x, y, color }) =>
    `<rect x="${x - 6}" y="${y - 6}" width="12" height="12" fill="#ffffff" data-crossing-gap="true"/><path d="M ${x} ${y - 7} V ${y + 7}" stroke="${color}" stroke-width="2" fill="none"/>`
  ).join('');
};

const horizontalEdgePath = (input: {
  source: EdgePosition;
  target: EdgePosition;
  sourceHeight: number;
  targetHeight: number;
  sourceRow: number;
  targetRow: number;
  nodeWidth: number;
  rowHeights: number[];
  rowOffsets: number[];
  columnGap: number;
  rowGap: number;
  reverse: boolean;
  direct: boolean;
  laneOffset: number;
  sourcePortOffset: number;
  targetPortOffset: number;
}): RoutedEdge => {
  const sign = input.reverse ? -1 : 1;
  const sourceX = input.source.x + (input.reverse ? 0 : input.nodeWidth);
  const targetX = input.target.x + (input.reverse ? input.nodeWidth : 0);
  const sourceY = input.source.y + input.sourceHeight / 2 + input.sourcePortOffset;
  const targetY = input.target.y + input.targetHeight / 2 + input.targetPortOffset;
  if (input.direct) {
    return {
      d: `M ${sourceX} ${sourceY} H ${targetX}`,
      labelX: (sourceX + targetX) / 2,
      labelY: sourceY - 7,
      points: [{ x: sourceX, y: sourceY }, { x: targetX, y: sourceY }]
    };
  }

  const sourceChannel = sourceX + sign * input.columnGap / 2;
  const targetChannel = targetX - sign * input.columnGap / 2;
  const corridorRow = horizontalCorridorRow(input.sourceRow, input.targetRow, input.rowHeights.length);
  const corridorY = corridorRow < 0
    ? input.rowOffsets[0] - input.rowGap / 2 + input.laneOffset
    : input.rowOffsets[corridorRow] + input.rowHeights[corridorRow] + input.rowGap / 2 + input.laneOffset;
  return {
    d: `M ${sourceX} ${sourceY} H ${sourceChannel} V ${corridorY} H ${targetChannel} V ${targetY} H ${targetX}`,
    labelX: (sourceChannel + targetChannel) / 2,
    labelY: corridorY - 7,
    points: [
      { x: sourceX, y: sourceY }, { x: sourceChannel, y: sourceY },
      { x: sourceChannel, y: corridorY }, { x: targetChannel, y: corridorY },
      { x: targetChannel, y: targetY }, { x: targetX, y: targetY }
    ]
  };
};

const edgePortOffset = (group: number[], edgeIndex: number, nodeHeight: number, side: number): number => {
  const available = Math.max(14, nodeHeight / 2 - 12);
  const minimum = 14;
  const magnitude = group.length <= 1
    ? Math.min(20, available)
    : minimum + (available - minimum) * group.indexOf(edgeIndex) / (group.length - 1);
  return side * magnitude;
};

const horizontalCorridorRow = (sourceRow: number, targetRow: number, rowCount: number): number => {
  if (targetRow > sourceRow) return sourceRow;
  if (targetRow < sourceRow) return sourceRow - 1;
  return sourceRow < rowCount - 1 ? sourceRow : sourceRow - 1;
};

const verticalEdgePath = (input: {
  source: EdgePosition;
  target: EdgePosition;
  sourceHeight: number;
  targetHeight: number;
  sourceRow: number;
  targetRow: number;
  nodeWidth: number;
  gap: number;
  reverse: boolean;
}): RoutedEdge => {
  const sourceX = input.source.x + input.nodeWidth / 2;
  const targetX = input.target.x + input.nodeWidth / 2;
  const sourceY = input.source.y + (input.reverse ? 0 : input.sourceHeight);
  const targetY = input.target.y + (input.reverse ? input.targetHeight : 0);
  if (input.targetRow - input.sourceRow === (input.reverse ? -1 : 1)) {
    return {
      d: `M ${sourceX} ${sourceY} V ${targetY}`,
      labelX: sourceX + 8,
      labelY: (sourceY + targetY) / 2 - 5,
      points: [{ x: sourceX, y: sourceY }, { x: sourceX, y: targetY }]
    };
  }
  const channelX = input.source.x + input.nodeWidth + input.gap / 2;
  const exitY = sourceY + (input.reverse ? -1 : 1) * input.gap / 2;
  const entryY = targetY + (input.reverse ? 1 : -1) * input.gap / 2;
  return {
    d: `M ${sourceX} ${sourceY} V ${exitY} H ${channelX} V ${entryY} H ${targetX} V ${targetY}`,
    labelX: (sourceX + channelX) / 2,
    labelY: exitY - 7,
    points: [
      { x: sourceX, y: sourceY }, { x: sourceX, y: exitY },
      { x: channelX, y: exitY }, { x: channelX, y: entryY },
      { x: targetX, y: entryY }, { x: targetX, y: targetY }
    ]
  };
};

const parseEdge = (line: string): [MermaidNodeRef, MermaidNodeRef, string?] | undefined => {
  const match = line.match(/^(.*?)\s*-->(?:\|([^|]+)\|)?\s*(.*?)$/);
  if (!match) return undefined;
  const source = parseNodeRef(match[1]);
  const target = parseNodeRef(match[3]);
  return source && target ? [source, target, match[2]] : undefined;
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
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (textUnits(next) <= maxLength) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    current = '';
    for (const character of word) {
      if (current && textUnits(current + character) > maxLength) {
        lines.push(current);
        current = '';
      }
      current += character;
    }
  }
  if (current) lines.push(current);
  return lines;
};

const textUnits = (value: string): number => [...value].reduce(
  (length, character) => length + (/[\u2e80-\uffff]/u.test(character) ? 2 : 1),
  0
);

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
