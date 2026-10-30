import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CodeXml, GitBranch, ListChecks, Network, Search } from 'lucide-react';
import type { AnalysisScope, AnalysisSource, ModelAnalysis } from './modelAnalysis';
import { scopeAnalysis } from './modelAnalysis';
import './modelAnalysis.css';
import { FieldLineageView } from './FieldLineageView';

interface Props {
  analysis: ModelAnalysis;
  contexts: Array<{ id: string; name: string }>;
  contextId?: string;
  ownerId?: string;
  sliceId?: string;
  pending: boolean;
  canLocateSource?: boolean;
  onScopeChange: (scope: AnalysisScope) => void;
  onLocate: (source: AnalysisSource) => void;
  onCanvas: (source: AnalysisSource) => void;
}

const evidenceLabels = { declared: 'Declared', inferred: 'Inferred', unknown: 'Unknown' };

export function ModelAnalysisWorkspace({ analysis, contexts, contextId, ownerId, sliceId, pending, canLocateSource = true, onScopeChange, onLocate, onCanvas }: Props) {
  const [tab, setTab] = useState<'lifecycle' | 'references' | 'fields' | 'completeness' | 'issues'>('lifecycle');
  const scope = useMemo(() => ({ contextId, ownerId, sliceId }), [contextId, ownerId, sliceId]);
  const [query, setQuery] = useState('');
  useEffect(() => {
    if (scope.contextId && !contexts.some((context) => context.id === scope.contextId)) {
      onScopeChange({});
    } else if (scope.ownerId && !analysis.owners.some((owner) => owner.id === scope.ownerId)) {
      onScopeChange({ contextId: scope.contextId });
    }
  }, [analysis, contexts, scope, onScopeChange]);
  const scoped = useMemo(() => scopeAnalysis(analysis, scope), [analysis, scope]);
  const matches = (text: string) => text.toLowerCase().includes(query.trim().toLowerCase());
  const visibleOwners = scoped.owners.filter((owner) => matches(owner.name)
    || scoped.operations.some((operation) => operation.ownerId === owner.id && matches(operation.source.name)));
  const visibleProjections = scoped.projections.filter((projection) => matches(projection.name)
    || projection.eligibility.some((rule) => matches(JSON.stringify(rule)))
    || scoped.references.some((reference) => reference.projectionIds.includes(projection.id) && matches(`${reference.command.name} ${reference.field} ${reference.sourcePath}`)));
  const unresolvedReferences = scoped.references.filter((reference) => reference.projectionIds.length === 0 && matches(`${reference.command.name} ${reference.sourcePath}`));
  const sourceActions = (source: AnalysisSource) => <span className="analysis-source-actions">
    <button type="button" title={!canLocateSource ? 'Locate source in the main workspace' : source.range?.sourceName && source.range.sourceName !== '<memory>' ? `Imported model: ${source.range.sourceName}` : 'Locate source'} aria-label={`Locate source ${source.name}`} disabled={pending || !canLocateSource || !source.range || Boolean(source.range.sourceName && source.range.sourceName !== '<memory>')} onClick={() => onLocate(source)}><CodeXml size={15} /></button>
    <button type="button" title="View canvas" aria-label={`View canvas ${source.name}`} disabled={pending || source.id === 'model'} onClick={() => onCanvas(source)}><Network size={15} /></button>
  </span>;

  return <div className="model-analysis" aria-label="Business Analysis" aria-busy={pending}>
    <div className="analysis-filters">
      <select aria-label="Analysis context" value={scope.contextId ?? ''} onChange={(event) => onScopeChange({ contextId: event.target.value || undefined })}>
        <option value="">All contexts</option>
        {contexts.map((context) => <option key={context.id} value={context.id}>{context.name}</option>)}
      </select>
      <select aria-label="Analysis object" value={scope.ownerId ?? ''} onChange={(event) => onScopeChange({ contextId: scope.contextId, ownerId: event.target.value || undefined })}>
        <option value="">All business objects</option>
        {analysis.owners.filter((owner) => !scope.contextId || owner.contextId === scope.contextId).map((owner) => <option key={owner.id} value={owner.id}>{owner.contextName} / {owner.name} ({owner.kind})</option>)}
      </select>
      <label className="analysis-search"><Search size={14} /><input aria-label="Filter analysis results" placeholder="Filter names or conditions" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      {scope.sliceId && <button type="button" onClick={() => onScopeChange({ ...scope, sliceId: undefined })}>Clear slice filter</button>}
    </div>
    <div className="analysis-tabs" role="tablist" aria-label="Business analysis views" onKeyDown={(event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
      const index = tabs.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
      event.preventDefault();
      tabs[next]?.focus();
      tabs[next]?.click();
    }}>
      <button type="button" role="tab" tabIndex={tab === 'lifecycle' ? 0 : -1} id="analysis-tab-lifecycle" aria-controls="analysis-results" aria-selected={tab === 'lifecycle'} onClick={() => setTab('lifecycle')}><GitBranch size={15} />Lifecycle <span>{scoped.operations.length}</span></button>
      <button type="button" role="tab" tabIndex={tab === 'references' ? 0 : -1} id="analysis-tab-references" aria-controls="analysis-results" aria-selected={tab === 'references'} onClick={() => setTab('references')}><ListChecks size={15} />References <span>{scoped.projections.length}</span></button>
      <button type="button" role="tab" tabIndex={tab === 'fields' ? 0 : -1} id="analysis-tab-fields" aria-controls="analysis-results" aria-selected={tab === 'fields'} onClick={() => setTab('fields')}><GitBranch size={15} />Field Sources <span>{scoped.lineage.fields.length}</span></button>
      <button type="button" role="tab" tabIndex={tab === 'completeness' ? 0 : -1} id="analysis-tab-completeness" aria-controls="analysis-results" aria-selected={tab === 'completeness'} onClick={() => setTab('completeness')}><ListChecks size={15} />Generation Checks <span>{scoped.lineage.diagnostics.length}</span></button>
      <button type="button" role="tab" tabIndex={tab === 'issues' ? 0 : -1} id="analysis-tab-issues" aria-controls="analysis-results" aria-selected={tab === 'issues'} onClick={() => setTab('issues')}><AlertTriangle size={15} />Issues & Review <span>{scoped.issues.length}</span></button>
    </div>
    <div className="analysis-update-status" role="status">{pending ? 'Source changed. Updating analysis; previous results are shown.' : 'Model relationships only. Generated code and runtime behavior are unverified.'}</div>
    <div className="analysis-results" id="analysis-results" role="tabpanel" aria-labelledby={`analysis-tab-${tab}`}>
      {tab === 'fields' && <FieldLineageView key={JSON.stringify({ ...scope, query })} lineage={analysis.lineage} fields={scoped.lineage.fields} matches={matches} sourceActions={sourceActions} />}
      {tab === 'completeness' && <ul className="analysis-issues">{scoped.lineage.diagnostics.filter((item) => matches(`${item.code} ${item.severity} ${item.message}`)).map((item) => {
        const field = analysis.lineage.fields.find((candidate) => candidate.id === item.fieldId)!;
        return <li key={`${item.fieldId}:${item.code}:${item.message}`}>
          <span className={`analysis-evidence is-${item.severity === 'error' ? 'error' : 'unknown'}`}>{item.severity === 'error' ? 'Blocks generation' : 'Review'}</span>
          <div><strong>{item.code}</strong><p>{item.message}</p></div>{sourceActions({ id: field.elementId, name: `${field.elementName}.${field.section === 'result' ? 'result.' : ''}${field.name}`, range: field.range })}
        </li>;
      })}{!scoped.lineage.diagnostics.some((item) => matches(`${item.code} ${item.severity} ${item.message}`)) && <li className="analysis-empty">No field-source diagnostics match the filter. Adapter implementations and runtime availability are unverified.</li>}</ul>}
      {tab === 'lifecycle' && <>
        {visibleOwners.map((owner) => {
          const operations = scoped.operations.filter((item) => item.ownerId === owner.id && (matches(owner.name) || matches(item.source.name)));
          return <section key={owner.id} className="analysis-section">
            <header><div><small>{owner.contextName} / {owner.kind}</small><h2>{owner.name}</h2></div>{sourceActions(owner)}</header>
            <div className="analysis-state-list"><span>Declared states</span>{owner.states.length ? [...new Set(owner.states)].map((state) => <code key={state}>{state}</code>) : <span>Not declared</span>}</div>
            {operations.length ? <div className="analysis-table-scroll"><table>
              <thead><tr><th>Operation</th><th>Lifecycle entry / Trigger history</th><th>Trigger events</th><th>Emitted events / Resulting state</th><th><span className="sr-only">Source & Canvas</span></th></tr></thead>
              <tbody>{operations.map((operation) => <tr key={operation.id}>
                <td><strong>{operation.source.name}</strong>{operation.port && <small>External port; runtime verification required</small>}</td>
                <td><span className={`analysis-evidence is-${operation.evidence}`}>{evidenceLabels[operation.evidence]}</span>
                  <div>{operation.startsLifecycle ? 'Not created: lifecycle entry' : operation.evidence === 'unknown' ? 'Unknown' : `Related source states: ${operation.fromStates.join(' / ')}`}</div>
                  {!operation.startsLifecycle && <small>Current-state precondition: Unknown</small>}
                  {operation.evidence === 'unknown' && operation.fromStates.length > 0 && <small>Partial relationships indicate: {operation.fromStates.join(' / ')}</small>}
                  <small>{operation.reason}</small></td>
                <td>{operation.triggers.length ? operation.triggers.map((event) => <div key={event.id}>{event.name}</div>) : 'Not declared'}</td>
                <td>{operation.events.map((event) => <div key={event.id}>{event.name}</div>)}
                  <small>{operation.to ? `Slice state: ${operation.to}` : 'No resulting state declared; this does not imply an unchanged state'}</small>
                  {operation.to && operation.outcomeEvidence === 'unknown' && <span className="analysis-evidence is-unknown">State mapping unclear</span>}</td>
                <td>{sourceActions(operation.source)}</td>
              </tr>)}</tbody>
            </table></div> : <p className="analysis-empty">No associated commands in this scope.</p>}
          </section>;
        })}
        {!visibleOwners.length && <p className="analysis-empty">No concepts or aggregates match the filter. References and diagnostics remain available.</p>}
      </>}
      {tab === 'references' && <>
        {visibleProjections.map((projection) => {
          const references = scoped.references.filter((reference) => reference.projectionIds.includes(projection.id));
          return <section key={projection.id} className="analysis-section">
            <header><div><small>{projection.contextName} / Projection</small><h2>{projection.name}</h2></div>{sourceActions(projection)}</header>
            <dl className="analysis-rules">
              {!projection.eligibility.some((rule) => !rule.profile) && <><dt>Default condition</dt><dd>Not declared; this does not imply business approval</dd></>}
              {projection.eligibility.map((rule, index) => <div className="analysis-rule" key={`${rule.profile ?? 'default'}:${index}`}><dt>{rule.profile ?? 'Default condition'}</dt><dd>{rule.conditions.map((condition, i) => <div key={i}><code>{condition.left} {condition.operator} {condition.rightReference ?? JSON.stringify(condition.right)}</code>{i < rule.conditions.length - 1 && <small>AND</small>}</div>)}</dd></div>)}
            </dl>
            {references.length ? <div className="analysis-table-scroll"><table>
              <thead><tr><th>Consuming command / Field</th><th>Source relationship</th><th>Applicable condition</th><th><span className="sr-only">Source & Canvas</span></th></tr></thead>
              <tbody>{references.map((reference) => <tr key={reference.id}>
                <td><strong>{reference.command.name}</strong><code>{reference.field}</code></td>
                <td><code>{reference.sourcePath}</code><span className={`analysis-evidence is-${reference.evidence}`}>{evidenceLabels[reference.evidence]}</span><small>{reference.reason}</small></td>
                <td>{reference.projectionIds.length !== 1 ? 'Ambiguous source; conditions cannot be determined' : reference.selected ? <>
                  <strong>{reference.selected.profile ?? 'Default condition'}</strong>
                  {reference.selected.conditions.map((condition, index) => <code key={index}>{condition.left} {condition.operator} {condition.rightReference ?? JSON.stringify(condition.right)}</code>)}
                  {reference.selected.profile && <small>Matched business profile; the default condition is not added</small>}
                </> : 'No matching business profile or default condition'}</td>
                <td>{sourceActions(reference.command)}</td>
              </tr>)}</tbody>
            </table></div> : <p className="analysis-empty">No consumers resolved through direct field references.</p>}
          </section>;
        })}
        {unresolvedReferences.map((reference) => <section className="analysis-section" key={reference.id}>
          <header><h2>{reference.command.name} / {reference.field}</h2>{sourceActions(reference.command)}</header>
          <code>{reference.sourcePath}</code><p>{reference.reason}</p>
        </section>)}
        {!visibleProjections.length && !unresolvedReferences.length && <p className="analysis-empty">No projections or direct field references match the filter.</p>}
      </>}
      {tab === 'issues' && <ul className="analysis-issues">{scoped.issues.filter((issue) => matches(`${issue.source.name} ${issue.message}`)).map((issue) => <li key={issue.id}>
        <span className={`analysis-evidence is-${issue.severity === 'warning' ? 'unknown' : 'inferred'}`}>{issue.severity === 'warning' ? 'Issue' : 'Review'}</span>
        <div><strong>{issue.source.name}</strong><p>{issue.message}</p></div>{sourceActions(issue.source)}
      </li>)}{!scoped.issues.some((issue) => matches(`${issue.source.name} ${issue.message}`)) && <li className="analysis-empty">No issues match the filter. Implementation and runtime behavior remain unverified.</li>}</ul>}
    </div>
  </div>;
}
