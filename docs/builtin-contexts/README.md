# 内置上下文：使用与配置总览

MEDOL 的内置上下文提供通用业务能力。这里统一说明如何接入模型、选择部署和配置运行环境；具体字段、操作流程和实现边界分别维护在各上下文说明中。

## 目录

| 内置模块 / import 名 | 上下文 | 使用与配置说明 |
| --- | --- | --- |
| `identity-access-management` | `IdentityAccessManagement` | [身份与权限](identity-access-management.md) |
| `dictionary-maintenance` | `DictionaryMaintenance` | [字典维护](dictionary-maintenance.md) |
| `file-upload` | `FileUpload` | [文件上传](file-upload.md) |
| `data-exchange` | `DataExchange` | [数据交换](data-exchange.md) |
| `system-notification` | `SystemNotification` | [站内通知](system-notification.md) |
| `tenant-management` | `TenantManagement` | [租户管理](tenant-management.md) |
| `operation-audit` | `OperationAudit` | [操作审计](operation-audit.md) |
| `numbering` | `Numbering` | [业务编号](numbering.md) |
| `organization-management` | `OrganizationManagement` | [组织与岗位](organization-management.md) |
| `business-calendar` | `BusinessCalendar` | [业务日历](business-calendar.md) |
| `system-configuration` | `SystemConfiguration` | [系统配置](system-configuration.md) |
| `document-generation` | `DocumentGeneration` | [模板与文档生成](document-generation.md) |
| `archiving` | `Archiving` | [数据归档](archiving.md) |
| `scheduling` | `Scheduling` | [业务调度](scheduling.md) |

## 从哪里开始

1. 在系统的 `.medol/source.medol` 中导入所需能力，指定 backend deployment。
2. 按独立说明接入业务资源：字典可绑定读模型，数据交换标记导入命令/导出目录，通知标记事件，编号绑定生成字段，调度绑定目标命令。
3. 通过 `frontend includes` 选择需要展示的管理上下文；展示页面与后端启用是两回事。
4. 重新导出 CodegenModel，再生成受影响的后端、前端及部署配置。
5. 配置服务地址、凭证和存储，执行对应数据库迁移，再按正常业务流程启用规则或计划。

建模表达业务语义；数据库连接、密钥、服务地址以及调度器实例连接放在运行配置中。不要把环境差异写死在业务模型里。

## 核心原则

- `import` 引入内置模型；`as` 提供模型内别名；`deploy` 指定后端部署。
- `extend` 把业务资源接入已经提供的扩展点，不是通用启用开关。
- 直接使用内置管理模型通常只需 `import`。需要业务联动时仍须声明相应绑定，例如 scheduling 的目标命令、numbering 的生成字段。
- DSL 中的 `provider` 表示模型资源的角色映射；调度运行配置中的 `providers` 表示 SnailJob 等调度器的连接实例，两者职责不同。
- 只支持各上下文说明列出的扩展点，不能通过任意 provider 名称自动获得新实现。

## 引用内置能力

使用 `import <内置能力名> as <别名> deploy <部署名>` 引入内置能力，并把它部署到指定 backend deployment。

示例：

```medol
import identity-access-management as PlatformIam deploy FederationLearningSupport
import identity-access-management as ParticipantIam deploy FederationLearningRuntimeAgent
import dictionary-maintenance as PlatformDictionary deploy FederationLearningSupport
import file-upload as PlatformFileUpload deploy FederationLearningSupport
import system-notification as PlatformNotification deploy FederationLearningSupport
```

含义：

- `identity-access-management` 引入内置 IAM 能力。
- `dictionary-maintenance` 引入内置字典维护能力。
- `file-upload` 引入内置文件上传能力。
- `system-notification` 引入内置站内通知能力。
- `as PlatformIam` / `as ParticipantIam` / `as PlatformDictionary` / `as PlatformFileUpload` 是业务模型中的引用别名。
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

`extend` 不是替代 `import`。`import` 负责引入能力，资源绑定按该上下文的使用说明补充。

上例描述读模型扩展；scheduling 使用 `provider scheduledCommand from Context.Command` 绑定命令，详见[业务调度](scheduling.md)。

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

作用域还受具体契约限制：租户 provider 必须位于应用顶层；调度目标必须使用 `Context.Command` 完整名称。通用语法允许某个位置，不代表所有能力都在该位置解析绑定。

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

## 运行配置与部署

每个独立说明分别列出配置入口。通用约定：

- 生成应用的 `src/main/resources/application.yml`、`.env` 及已有 operations 环境配置是部署配置入口；各能力若另有配置文件，会在对应说明中标明加载方法。
- 跨部署调用需要配置目标地址与匹配的内部服务凭证；导入到 Support 不意味着所有业务执行、数据和审计都会自动集中到 Support。
- 启用租户管理会影响整个导出应用模型的数据隔离，详见[租户管理](tenant-management.md)，不能仅按管理页的部署位置判断作用范围。
- 生产恢复依赖持久化数据库与事件存储；`inmemory` 仅用于测试。编号计数器、调度投递记录等运行数据不等于可随时重建的查询投影。
- 更新模型后，重新生成并 clean 构建；已有数据库的结构、事件以及新增状态字段按各模块迁移说明处理，不会仅因文档或模型更新而自动回填。

## 内置生命周期与选择约束

内置模型沿用普通 MEDOL 语义，不增加专属状态语法：

- `reactsTo` 引用同一 concept 中明确关联状态的事件，约束命令允许执行的当前状态。
- slice 没有 `state` 时，只校验前置状态，不改变对象状态。CodegenModel 对此输出带 `from/fromStates`、不带 `to/event` 的 guard；生成器不能把它当成状态变化。只有全部同一对象的触发事件均有明确状态关联时才生成此 guard；未关联状态的次要结果仍只表示事件响应，不推测状态，也不生成只覆盖部分结果的限制。
- 默认 `eligible` 控制新的业务引用；管理操作仍按自己的生命周期执行。命名 `eligible for` 表达特定用途。
- 唯一性和输入一致性使用 `specification expression`，并提供能证明违反约束的拒绝场景。

各上下文的状态、选择条件和限制见对应独立说明。对生成链路的通用要求：

- 回放仅使用显式的事件状态关联；事件名称中包含 Ready/Failed 等词不改变聚合状态。
- 生命周期命令首先按模型元素 ID 匹配，不能借用其他 context 中同名命令的约束。
- 同一目录的 ID 和附带字段按同一条记录校验；无法明确绑定 ID、复合 ID 或集合选择时，应阻止生成，而不是猜测。

## 后续扩展与维护

新增通用能力时，先定义内置 context、业务生命周期和允许接入的资源，再定义生成契约与实现适配器。在本目录增加独立说明，并登记到上方目录。业务模型中的具体上下文和字段名称通过绑定解析，不写进通用生成模板。

能力的使用、配置和边界只维护在对应页面；本页维护导航与共通约定。生成项目附带的 README 保留该项目部署所需说明，修改实现时同步更新。

## 相关文档

- [系统项目结构](../system-project-layout.md)
- [版本与发布追踪](../versioning.md)
- [建模语义](../modeling-semantics.md)
- [字段来源](../field-lineage.md)
