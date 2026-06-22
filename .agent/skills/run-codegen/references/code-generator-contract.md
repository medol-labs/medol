# Code Generator Contract

The code generator should consume `CodegenModel` or `GenerationPlan` and produce deterministic project files.

Generator-owned responsibilities:

- package names
- value type files
- command/event/read model skeletons
- resource routes
- form schemas
- repeatable template output

Agent-owned responsibilities:

- interpreting domain gaps
- implementing non-template business logic
- fixing compiler errors
- proposing MEDOL changes when generation inputs are insufficient
