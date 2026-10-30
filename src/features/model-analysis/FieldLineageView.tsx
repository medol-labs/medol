import { useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { traceField, type FieldLineage, type LineageField } from '../../lib/fieldLineage';
import type { AnalysisSource } from './modelAnalysis';

interface Props {
  lineage: FieldLineage;
  fields: LineageField[];
  matches: (text: string) => boolean;
  sourceActions: (source: AnalysisSource) => React.ReactNode;
}

export function FieldLineageView({ lineage, fields, matches, sourceActions }: Props) {
  const [selectedId, setSelectedId] = useState('');
  const [direction, setDirection] = useState<'sources' | 'consumers'>('sources');
  const [page, setPage] = useState(0);
  const fieldName = (field: LineageField) => `${field.section === 'result' ? 'result.' : ''}${field.name}`;
  const visible = fields.filter((field) => matches(`${field.contextName}.${field.elementName}.${fieldName(field)} ${field.kind} ${field.origin}`));
  const pageIndex = Math.min(page, Math.max(0, Math.ceil(visible.length / 50) - 1));
  const pageFields = visible.slice(pageIndex * 50, (pageIndex + 1) * 50);
  const selected = pageFields.find((field) => field.id === selectedId) ?? pageFields[0];
  const traced = selected ? traceField(lineage, selected.id, direction) : undefined;
  const fieldById = new Map(lineage.fields.map((field) => [field.id, field]));
  const source = (field: LineageField) => ({ id: field.elementId, name: `${field.elementName}.${fieldName(field)}`, range: field.range });
  const label = (id: string) => {
    const field = fieldById.get(id);
    return field ? `${field.contextName}.${field.elementName}.${fieldName(field)}` : id;
  };
  return <>
    <section className="analysis-section">
      <div className="analysis-table-scroll analysis-lineage-table"><table>
        <thead><tr><th>Element / Field</th><th>Type / Origin</th><th>Source evidence</th><th><span className="sr-only">Source & Canvas</span></th></tr></thead>
        <tbody>{pageFields.map((field) => <tr key={field.id} aria-selected={selected?.id === field.id}>
          <td><small>{field.contextName} / {field.kind}</small><button type="button" className="analysis-field-select" onClick={() => setSelectedId(field.id)}>{field.elementName}.{fieldName(field)}</button></td>
          <td><code>{field.type}</code><span className={`analysis-evidence is-${field.origin === 'unknown' ? 'unknown' : field.origin === 'inferred' ? 'inferred' : 'declared'}`}>{field.origin}</span></td>
          <td>{field.reason}</td><td>{sourceActions(source(field))}</td>
        </tr>)}</tbody>
      </table></div>
      {!visible.length && <p className="analysis-empty">No fields match the filter.</p>}
      {visible.length > 50 && <div className="analysis-field-pagination">
        <span>{pageIndex * 50 + 1}–{Math.min((pageIndex + 1) * 50, visible.length)} / {visible.length}</span>
        <button type="button" title="Previous fields" aria-label="Previous fields" disabled={pageIndex === 0} onClick={() => setPage(pageIndex - 1)}><ChevronLeft size={16} /></button>
        <button type="button" title="Next fields" aria-label="Next fields" disabled={(pageIndex + 1) * 50 >= visible.length} onClick={() => setPage(pageIndex + 1)}><ChevronRight size={16} /></button>
      </div>}
    </section>
    {selected && traced && <section className="analysis-section" aria-label="Selected field trail">
      <header><h2>{selected.elementName}.{fieldName(selected)}</h2><div className="analysis-trace-direction" role="group" aria-label="Trace direction">
        <button type="button" aria-pressed={direction === 'sources'} onClick={() => setDirection('sources')}><ArrowDownLeft size={14} />Sources</button>
        <button type="button" aria-pressed={direction === 'consumers'} onClick={() => setDirection('consumers')}><ArrowUpRight size={14} />Consumers</button>
      </div></header>
      <ul className="analysis-trail">{traced.links.map((link, index) => <li key={`${link.source}:${link.target}:${index}`}>
        <code>{label(link.source)}</code><span aria-label="flows to">→</span><code>{label(link.target)}</code>
        <span className={`analysis-evidence is-${link.evidence}`}>{link.evidence}</span><small>{link.path}</small>
      </li>)}</ul>
      {!traced.links.length && <p className="analysis-empty">No {direction} linked to this field.</p>}
      <ul className="analysis-issues">{traced.fields.flatMap((field) => lineage.diagnostics.filter((item) => item.fieldId === field.id).map((item) => <li key={`${item.fieldId}:${item.code}:${item.message}`}>
        <span className={`analysis-evidence is-${item.severity === 'error' ? 'error' : 'unknown'}`}>{item.severity === 'error' ? 'Blocks generation' : 'Review'}</span>
        <div><strong>{item.code}</strong><p>{item.message}</p></div>{sourceActions(source(field))}
      </li>))}</ul>
    </section>}
  </>;
}
