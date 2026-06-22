# Projection, Query, And Resource Guidance

Backend:

- Event handlers update read model entities.
- Query handlers return either a single entity or a list consistently with the query contract.
- REST resources should require id/query parameters that the query handler expects.

Frontend:

- Read models usually become resource entry points.
- Menus should show resources or workflow entry points, not every command.
- Commands should appear as create actions, item actions, or background operations near the owning resource.
