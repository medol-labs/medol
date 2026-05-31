import type { SelectedModelItem } from '../../app/modelSelection';

interface InspectorPanelProps {
  item?: SelectedModelItem;
  compact?: boolean;
}

export function InspectorPanel({ item, compact = false }: InspectorPanelProps) {
  return (
    <div className={compact ? 'inspector-pane is-compact' : 'inspector-pane'}>
      {!compact && (
        <header className="pane-header">
          <p className="eyebrow">Semantic</p>
          <h2>Inspector</h2>
        </header>
      )}
      {item ? <InspectorContent item={item} /> : <div className="empty-panel">Select a model item</div>}
    </div>
  );
}

function InspectorContent({ item }: { item: SelectedModelItem }) {
  const fields = item.element?.fields ?? [];
  const metadata = item.element?.metadata ?? {};

  return (
    <div className="inspector-content">
      <section>
        <span className="inspector-kind">{item.type}</span>
        <h3>{item.name}</h3>
      </section>
      <dl className="inspector-facts">
        {item.context && (
          <>
            <dt>Context</dt>
            <dd>{item.context.name}</dd>
          </>
        )}
        {item.aggregate && (
          <>
            <dt>Aggregate</dt>
            <dd>{item.aggregate.name}</dd>
          </>
        )}
        {item.slice && (
          <>
            <dt>Slice</dt>
            <dd>{item.slice.name}</dd>
          </>
        )}
        {item.element?.ui?.type && (
          <>
            <dt>UI</dt>
            <dd>{item.element.ui.type}</dd>
          </>
        )}
      </dl>
      {fields.length > 0 && (
        <section className="inspector-section">
          <h4>Fields</h4>
          <ul className="inspector-list">
            {fields.map((field) => (
              <li key={`${field.name}:${field.type}`}>
                <strong>{field.name}</strong>
                <span>{field.type}{field.cardinality === 'List' ? '[]' : field.cardinality === 'Optional' ? '?' : ''}</span>
                {field.mapping && <small>{field.mapping.kind}: {field.mapping.sources.join(', ')}</small>}
                {field.example && <small>example: {field.example}</small>}
              </li>
            ))}
          </ul>
        </section>
      )}
      {Object.keys(metadata).length > 0 && (
        <section className="inspector-section">
          <h4>Metadata</h4>
          <dl className="inspector-facts">
            {Object.entries(metadata).map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </div>
  );
}
