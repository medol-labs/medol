import type { SelectedModelItem } from '../../app/modelSelection';
import { OverflowText } from '../../components/ui/overflow-text';

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
        <OverflowText as="h3" text={item.name} />
      </section>
      <dl className="inspector-facts">
        {item.context && (
          <>
            <dt>Context</dt>
            <OverflowText as="dd" text={item.context.name} />
          </>
        )}
        {item.aggregate && (
          <>
            <dt>Aggregate</dt>
            <OverflowText as="dd" text={item.aggregate.name} />
          </>
        )}
        {item.concept && (
          <>
            <dt>Concept</dt>
            <OverflowText as="dd" text={item.concept.name} />
            <dt>States</dt>
            <OverflowText as="dd" text={item.concept.states.join(', ') || 'None'} />
          </>
        )}
        {item.slice && (
          <>
            <dt>Slice</dt>
            <OverflowText as="dd" text={item.slice.name} />
          </>
        )}
        {item.element?.ui?.type && (
          <>
            <dt>UI</dt>
            <OverflowText as="dd" text={item.element.ui.type} />
          </>
        )}
      </dl>
      {fields.length > 0 && (
        <section className="inspector-section">
          <h4>Fields</h4>
          <ul className="inspector-list">
            {fields.map((field) => (
              <li key={`${field.name}:${field.type}`}>
                <OverflowText as="strong" text={field.name} />
                <OverflowText
                  text={`${field.type}${field.cardinality === 'OptionalList' ? '[]?' : field.cardinality === 'List' ? '[]' : field.cardinality === 'Optional' ? '?' : ''}`}
                />
                {field.mapping && (
                  <OverflowText
                    as="small"
                    text={`${field.mapping.kind}: ${field.mapping.sources.join(', ')}`}
                  />
                )}
                {field.example && <OverflowText as="small" text={`example: ${field.example}`} />}
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
                <OverflowText as="dd" text={value} />
              </div>
            ))}
          </dl>
        </section>
      )}
    </div>
  );
}
