# MEDOL 内置能力建模说明

本文说明 MEDOL 中“内置能力”的建模方式，以及 `import`、`extend`、`provider` 的边界。

内置能力是 MEDOL 预置的一组通用业务上下文。它们可以被业务模型直接引用，也可以在需要时由业务模型扩展接入自己的投影或资源。

## 核心原则

- `import` 用来引用内置能力。
- `extend` 用来扩展内置能力，不是默认启用内置能力的必需配置。
- 直接使用内置能力时，只写 `import`。
- 只有业务模型需要把自己的 readmodel、投影或资源接入内置能力的扩展点时，才写 `extend`。
- 内置能力本身可以包含自己的 context、slice、command、event、readmodel、concept、frontend 资源和默认扩展声明。

## 引用内置能力

使用 `import <内置能力名> as <别名> deploy <部署名>` 引入内置能力，并把它部署到指定 backend deployment。

示例：

```medol
import identity-access-management as PlatformIam deploy FederationLearningSupport
import identity-access-management as ParticipantIam deploy FederationLearningRuntimeAgent
import dictionary-maintenance as PlatformDictionary deploy FederationLearningSupport
```

含义：

- `identity-access-management` 引入内置 IAM 能力。
- `dictionary-maintenance` 引入内置字典维护能力。
- `as PlatformIam` / `as ParticipantIam` / `as PlatformDictionary` 是业务模型中的引用别名。
- `deploy FederationLearningSupport` 表示该内置能力部署到 `FederationLearningSupport`。
- `deploy FederationLearningRuntimeAgent` 表示该内置能力部署到 `FederationLearningRuntimeAgent`。

内置能力通过 `import ... deploy ...` 合并进部署结果。业务 deployment 中不需要再手写：

```medol
deployment FederationLearningSupport {
  includes DictionaryMaintenance
}
```

如果已经通过 `import dictionary-maintenance ... deploy FederationLearningSupport` 引入，生成后的部署模型会自动包含 `DictionaryMaintenance`。

## 扩展内置能力

`extend` 用于把业务模型自己的资源接入某个内置能力的扩展点。

通用结构：

```medol
extend <内置能力名或能力引用名> {
  provider <扩展点> from <业务读模型> {
    <能力角色字段> <业务字段>
  }
}
```

含义：

- `<内置能力名或能力引用名>`：被扩展的能力。
- `<扩展点>`：内置能力定义的扩展入口。
- `from <业务读模型>`：接入该扩展点的业务 readmodel。
- `<能力角色字段> <业务字段>`：把内置能力需要的字段角色映射到业务 readmodel 的真实字段。

`extend` 不是替代 `import`。如果只想使用内置能力，写 `import` 即可。

## Provider 映射

`provider` 表示某个扩展点的数据来源。

示例：

```medol
extend DictionaryMaintenance {
  provider dictionaryValues from AgentDictionaryValueCatalog {
    code dictionaryCode
    value valueCode
    label defaultDisplayName
    active active
    state state
    order displayOrder
  }
}
```

这里表示：

- `DictionaryMaintenance` 是被扩展的内置能力。
- `dictionaryValues` 是字典能力的扩展点。
- `AgentDictionaryValueCatalog` 是 runtime agent 侧同步出来的业务 readmodel。
- `code/value/label/active/state/order` 是字典能力需要理解的字段角色。
- `dictionaryCode/valueCode/defaultDisplayName/active/state/displayOrder` 是当前 readmodel 的真实字段。

字段名不要求固定。只要通过 mapping 说明角色关系即可。

## 作用域规则

`extend` 可以写在顶层、domain 内或 context 内。

当 `extend` 写在 context 内时：

```medol
context RuntimeAgentOperations {
  extend DictionaryMaintenance {
    provider dictionaryValues from AgentDictionaryValueCatalog {
      code dictionaryCode
      value valueCode
      label defaultDisplayName
    }
  }
}
```

`from AgentDictionaryValueCatalog` 只绑定当前 `RuntimeAgentOperations` context 内的 `AgentDictionaryValueCatalog`，不会绑定其他 context 中同名 readmodel。

如果需要跨 context 显式引用，可以写完整路径：

```medol
extend DictionaryMaintenance {
  provider dictionaryValues from RuntimeAgentOperations.AgentDictionaryValueCatalog {
    code dictionaryCode
    value valueCode
    label defaultDisplayName
  }
}
```

顶层简写 `from SomeReadModel` 只有在全模型中该 readmodel 名称唯一时才适合使用。存在同名 readmodel 时，应放到对应 context 内，或使用 `Context.ReadModel` 显式路径。

## IAM 建模

默认使用内置 IAM 时，只需要 import：

```medol
import identity-access-management as PlatformIam deploy FederationLearningSupport
import identity-access-management as ParticipantIam deploy FederationLearningRuntimeAgent
```

不需要额外写：

```medol
extend PlatformIam {
  actors PlatformAdmin
}
```

业务 slice 中已有的 `actor` 会继续作为业务权限生成的输入。当前 IAM 的默认接入不依赖 `extend`。

只有当 IAM 后续明确提供扩展点，例如外部账号目录、外部角色目录、自定义授权目录等，业务模型才应使用 `extend` 接入。

## Dictionary 建模

默认使用内置字典能力时，只需要 import：

```medol
import dictionary-maintenance as PlatformDictionary deploy FederationLearningSupport
```

内置 `DictionaryMaintenance` 自身已经包含字典目录、字典值、字典值翻译等管理模型，并声明了自己的默认 provider：

```medol
extend DictionaryMaintenance {
  provider dictionaryValues from DictionaryValueCatalog {
    code dictionaryCode
    value valueCode
    label defaultDisplayName
    active active
    state state
    order displayOrder
  }

  provider dictionaryTranslations from DictionaryValueTranslationCatalog {
    code dictionaryCode
    value valueCode
    locale locale
    label displayName
    description description
  }
}
```

业务模型不需要再内联 `context DictionaryMaintenance`。

## Runtime Agent 字典同步

如果某个 deployable 不能直接使用平台端字典 readmodel，而是需要同步一份本地投影，则可以用 `extend` 把本地同步投影接入字典能力。

示例：

```medol
context RuntimeAgentOperations {
  slice AgentDictionaryValueCatalog {
    sync readmodel AgentDictionaryValueCatalog[] from DictionaryMaintenance.DictionaryValueCatalog {
      dictionaryValueId: UUID id
      dictionaryId: UUID
      dictionaryCode: String query
      valueCode: String
      defaultDisplayName: String display
      displayOrder: Int?
      active: Boolean query
      state: String
      syncedAt: DateTime
    }
  }

  slice AgentDictionaryValueTranslationCatalog {
    sync readmodel AgentDictionaryValueTranslationCatalog[] from DictionaryMaintenance.DictionaryValueTranslationCatalog {
      dictionaryValueTranslationId: UUID id
      dictionaryValueId: UUID
      dictionaryCode: String query
      valueCode: String query
      locale: String query
      displayName: String display
      description: Text?
      syncedAt: DateTime
    }
  }

  extend DictionaryMaintenance {
    provider dictionaryValues from AgentDictionaryValueCatalog {
      code dictionaryCode
      value valueCode
      label defaultDisplayName
      active active
      state state
      order displayOrder
    }

    provider dictionaryTranslations from AgentDictionaryValueTranslationCatalog {
      code dictionaryCode
      value valueCode
      locale locale
      label displayName
      description description
    }
  }
}
```

这里的 `extend` 表示 runtime agent 侧使用自己的同步 readmodel 作为字典能力的数据来源。

## 不适合的写法

不要为了“默认启用内置能力”写空扩展：

```medol
extend DictionaryMaintenance {
}
```

不要把 `extend` 当成 `import` 的替代品：

```medol
extend IdentityAccessManagement {
  actors PlatformAdmin
}
```

默认 IAM 不需要这种配置。

不要在已经 import 内置能力后，再复制一份同名 context：

```medol
context DictionaryMaintenance {
  // duplicated built-in capability
}
```

这样会造成模型职责和生成结果混乱。

## 后续扩展方向

后续如果新增通用业务能力，例如导入导出管理、审计管理、通知管理，应优先按同一模式设计：

1. 先定义内置能力 context。
2. 业务模型通过 `import` 直接引用该内置能力。
3. 如果业务模型需要接入自己的表、投影或流程，再通过 `extend <内置能力> { provider <扩展点> ... }` 声明。

导入导出管理不应简单理解为“某个 readmodel 可 export/import”。它更可能是一个内置管理能力，包含管理页面、任务记录、文件处理、执行状态和通用组件。业务模型后续再通过扩展点声明哪些业务资源接入该管理能力。
