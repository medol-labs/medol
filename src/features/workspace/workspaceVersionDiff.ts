export interface WorkspaceVersionDiff {
  addedLines: number;
  removedLines: number;
  unchangedLines: number;
  lines: WorkspaceVersionDiffLine[];
}

export interface WorkspaceVersionDiffLine {
  kind: 'added' | 'removed' | 'unchanged';
  oldLine?: number;
  newLine?: number;
  text: string;
}

export const createWorkspaceVersionDiff = (
  previousDsl: string,
  nextDsl: string
): WorkspaceVersionDiff => {
  const previousLines = previousDsl.split('\n');
  const nextLines = nextDsl.split('\n');
  const table = buildLcsTable(previousLines, nextLines);
  const lines: WorkspaceVersionDiffLine[] = [];
  let previousIndex = 0;
  let nextIndex = 0;
  let oldLine = 1;
  let newLine = 1;

  while (previousIndex < previousLines.length || nextIndex < nextLines.length) {
    const previousLine = previousLines[previousIndex];
    const nextLine = nextLines[nextIndex];

    if (previousIndex < previousLines.length && nextIndex < nextLines.length && previousLine === nextLine) {
      lines.push({ kind: 'unchanged', oldLine, newLine, text: previousLine });
      previousIndex += 1;
      nextIndex += 1;
      oldLine += 1;
      newLine += 1;
    } else if (
      nextIndex < nextLines.length
      && (previousIndex === previousLines.length || table[previousIndex][nextIndex + 1] >= table[previousIndex + 1][nextIndex])
    ) {
      lines.push({ kind: 'added', newLine, text: nextLine });
      nextIndex += 1;
      newLine += 1;
    } else if (previousIndex < previousLines.length) {
      lines.push({ kind: 'removed', oldLine, text: previousLine });
      previousIndex += 1;
      oldLine += 1;
    }
  }

  return {
    addedLines: lines.filter((line) => line.kind === 'added').length,
    removedLines: lines.filter((line) => line.kind === 'removed').length,
    unchangedLines: lines.filter((line) => line.kind === 'unchanged').length,
    lines
  };
};

const buildLcsTable = (left: string[], right: string[]): number[][] => {
  const table = Array.from({ length: left.length + 1 }, () => Array<number>(right.length + 1).fill(0));

  for (let leftIndex = left.length - 1; leftIndex >= 0; leftIndex -= 1) {
    for (let rightIndex = right.length - 1; rightIndex >= 0; rightIndex -= 1) {
      table[leftIndex][rightIndex] = left[leftIndex] === right[rightIndex]
        ? table[leftIndex + 1][rightIndex + 1] + 1
        : Math.max(table[leftIndex + 1][rightIndex], table[leftIndex][rightIndex + 1]);
    }
  }

  return table;
};
