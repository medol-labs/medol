# Business Rejection Guidance

MEDOL uses `then reject "reason"` to describe a valid business outcome where a command is refused.

Implementation options:

- Throw a domain exception mapped to an error response.
- Return an explicit rejection result if the project uses result objects.
- Emit no event for rejected commands unless the domain explicitly models rejection as an event.

Prefer scenario tests that show both rejected and accepted paths.
