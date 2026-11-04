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

## FileUpload 建模

默认使用内置文件上传能力时，只需要 import：

```medol
import file-upload as PlatformFileUpload deploy FederationLearningSupport
```

内置 `FileUpload` 自身已经包含：

- `UploadFile`：上传文件并记录文件元数据。
- `DownloadFile`：按 `fileId` 授权下载。
- `MarkFileReferenced`：业务记录接收文件引用后标记引用关系。
- `DiscardFile`：丢弃未被业务引用的文件。
- `ExpireFile`：按保留策略过期文件。
- `UploadedFileCatalog`：文件上传记录目录。

业务模型不需要再内联 `context FileUpload`。业务命令中需要上传文件时，使用字段属性 `uploadFile` 标记浏览器文件字段：

```medol
command RegisterModelArtifact {
  modelArtifactId: UUID id generated technical
  uploadedFile: String uploadFile
  fileId: UUID?
}
```

生成的前端会先把 `uploadFile` 字段提交到内置 FileUpload 部署，再把返回的文件引用交给业务命令。业务上下文仍然只负责自己的业务语义，例如模型制品、数据集附件或证明材料；物理存储、下载授权、保留期和文件目录由内置 `FileUpload` 负责。

如果业务前端需要展示上传文件管理页，可以在 frontend 中引用内置上传目录：

```medol
frontend FederationLearningConsole {
  includes FileUpload from FederationLearningSupport
}
```

`FileUpload` 适合做通用内置能力，因为它和 IAM、Dictionary 一样属于平台级支撑能力。业务模型可以直接引用；只有后续需要接入自定义存储目录、外部对象存储元数据或跨部署同步投影时，才需要再通过 `extend` 增加明确扩展点。

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

## DataExchange 建模

默认使用内置数据交换能力时，只需要 import：

```medol
import data-exchange as PlatformDataExchange deploy FederationLearningSupport
```

内置 `DataExchange` 自身包含导出任务、导出文件下载与导入任务：

- `DataExportJob`：记录导出请求、处理状态、文件位置、下载地址、行数和失败信息。
- `DownloadDataExportFile`：导出 job 完成后，`DataExportJobCatalog` 通过 `eligible for DownloadDataExportFile when { DataExportJob.state == Completed }` 暴露下载动作。
- `DataImportJob`：记录导入请求、上传文件、请求哈希、处理状态、成功/失败行数和失败索引位置。

业务模型通过简单标记接入通用导出或导入：

```medol
readmodel RuntimeNodeInventoryCatalog[] {
  exportable by PlatformDataExchange
  runtimeNodeInventoryId: UUID id
  runtimeName: String display
}

command RegisterRuntimeNodeInventory {
  importable by PlatformDataExchange
  runtimeNodeInventoryId: UUID id
  runtimeName: String display
  nodeReady: Boolean?
}
```

`exportable` 是 readmodel 能力，表示当前查询页面可以按页面可见字段、筛选条件、排序条件导出。

`importable` 是 command 能力，表示上传文件后由通用导入 job 逐行转换为该业务命令并提交。导入不是“把 readmodel 反写回业务表”，也不是绕过业务规则直接写事件；每一行都会进入对应业务 command handler，因此唯一性、状态、引用、eligibility、specification 等业务校验仍由正常业务流程执行。

如果导入语义和页面新增/修改完全一致，可以直接把正常业务命令标记为 `importable`。如果导入语义不同，例如允许 upsert、允许跳过重复行、允许覆盖某些字段，应建模一个专门的导入业务命令；这个导入业务命令仍然要复用或调用同一套业务 policy/decision，而不是在导入框架里另写一套校验。

一个页面可以出现多个导入入口。只要该页面关联的业务 command 标记了 `importable`，生成前端会为每个导入命令生成独立上传按钮，并提交到对应命令的导入 endpoint。

第一版导入默认支持 CSV。文件先落盘并创建 `DataImportJob`，真正执行由 `DataImportRequested` 事件触发；处理过程按行流式读取，行级失败只写入轻量失败索引，索引包含行号、行哈希和错误信息，不复制完整业务数据。后续下载失败数据或失败行重试时，应基于原始文件和失败索引按需生成失败数据文件。跨服务投递仍然属于 outbox 的适用场景，但导入 job 本身的状态不是 outbox 状态。

## SystemNotification 建模

默认使用内置站内通知能力时，只需要 import：

```medol
import system-notification as PlatformNotification deploy FederationLearningSupport
```

内置 `SystemNotification` 自身包含：

- `PublishSystemNotification`：发布用户可见的站内通知。
- `MarkSystemNotificationRead`：标记单条通知已读。
- `MarkAllSystemNotificationsRead`：标记当前收件人通知已读。
- `SystemNotificationCatalog`：通知列表。
- `SystemNotificationSummary`：header 通知标识使用的轻量 summary。

业务事件通过事件内 `notifiable` 标识接入通知能力：

```medol
event TrainingJobCompleted {
  notifiable by PlatformNotification
  trainingJobId: UUID id
  trainingJobObjective: String
  finalRoundId: UUID
}
```

`notifiable` 表示某个业务事件发生后可以生成一条 `SystemNotificationPublished` 业务事实。它不是 outbox，也不是 Supabase/WebSocket 推送声明。推送、实时订阅、邮件或外部消息属于后续投递 adapter，可以基于 `SystemNotificationPublished` 再通过 outbox 做可靠投递。

第一版保持轻量建模，不在业务模型里配置通知文案细节。生成器按事件上下文推导默认值：

- `category`：仅从模型声明的 NotificationCategory 枚举项中匹配事件上下文，未匹配时使用 `SYSTEM`。内置分类不包含 training/runtime 等具体业务分类。
- `severity`：按事件名推导，例如 `Completed/Succeeded` 为 `SUCCESS`，`Failed/Rejected` 为 `ERROR`，`Alert/Raised` 为 `WARNING`，否则为 `INFO`。
- `messageKey`：按事件名生成稳定 key，例如 `notifications.trainingJobCompleted`。
- `messageArgsJson`：默认序列化事件字段，保证导出/列表/详情使用同一套后端事实。
- `targetId`：优先使用事件 id 字段；没有 id 字段时为空。
- `toastPolicy`：按 severity 推导，错误/警告为 `IMPORTANT`，成功为 `DEFAULT`，其他为 `NONE`。

通知列表是业务事实；header 红点、未读数量和 toast 是前端呈现策略。生成前端会在 header 中探测 `SystemNotificationSummary`，有未读时显示标识；当新通知的 `toastPolicy` 或 `severity` 需要即时提示时弹出 toast。没有引入 `SystemNotification` 时，header 通知入口不会显示。

## TenantManagement 建模

### 租户模块

通过 `import tenant-management as PlatformTenants deploy Support` 引用内置租户管理，使用 `TenantManagement` 上下文生成管理页面。内置模块自带应用级 `extend TenantManagement` 默认绑定，不需要额外 JSON 或 context 开关。

自定义模型仍须导入 `tenant-management`，然后在应用级声明 `extend TenantManagement { provider ... }`，将标准租户能力绑定到自己的租户目录和成员关系。用户的 context、读模型和字段名不受限制。管理页面可通过 frontend 选择，不要求展示内置页面。

是否开启先看实际 import：未导入 `tenant-management` 时不输出 `tenancy`，即使有同名 `extend` 或不完整绑定，也不开启、不做租户能力校验。已导入时才解析和校验最终绑定，有歧义或无效映射则报错。生成器消费解析后的契约，不维护第二套运行时扩展注册表。租户绑定必须位于 domain/context 外；内置默认绑定按来源标记，用户绑定可逐项覆盖，不通过 context 名字推断默认优先级。导入别名与间接导入同样有效。

内置模型包含租户注册、激活、暂停、恢复、信息维护，以及成员加入、撤销和恢复。通过现有 `extend ... { provider ... }` 可以替换租户目录与成员数据源，或完全自定义管理模型。

启用后整个应用模型的业务部署都会保留租户契约。Axon5 默认生成同库同 schema 的可信租户解析、命令租户校验、事件及状态标签、投影复合存储主键和 Repository 过滤；未配置则不生成这些组件。目录可用性来自默认 `eligible`，不固定状态名。独立 schema/数据库路由、租户内独立角色授权及租户化 readmodel sync 尚未实现；历史数据需显式迁移。

详见 [租户管理内置能力](tenant-management.md)。

## 后续扩展方向

后续如果新增通用业务能力，例如定时任务管理，应优先按同一模式设计：

1. 先定义内置能力 context。
2. 业务模型通过 `import` 直接引用该内置能力。
3. 如果业务模型需要接入自己的表、投影或流程，再通过 `extend <内置能力> { provider <扩展点> ... }` 声明。

通用管理能力不应简单理解为“某个 readmodel 增删改查”。它更可能是一个内置管理能力，包含管理页面、任务记录、文件处理、执行状态和通用组件。业务模型后续再通过扩展点声明哪些业务资源接入该管理能力。

## 内置生命周期与选择约束

内置模型沿用普通 MEDOL 语义，不增加专属状态语法：

- `reactsTo` 引用同一 concept 中明确关联状态的事件，约束命令允许执行的当前状态。
- slice 没有 `state` 时，只校验前置状态，不改变对象状态。CodegenModel 对此输出带 `from/fromStates`、不带 `to/event` 的 guard；生成器不能把它当成状态变化。只有全部同一对象的触发事件均有明确状态关联时才生成此 guard；未关联状态的次要结果仍只表示事件响应，不推测状态，也不生成只覆盖部分结果的限制。
- 默认 `eligible` 控制新的业务引用；管理操作仍按自己的生命周期执行。命名 `eligible for` 表达特定用途。
- 唯一性和输入一致性使用 `specification expression`，并提供能证明违反约束的拒绝场景。

当前内置规则：

| 模块 | 约束 |
| --- | --- |
| IAM | 用户名（含停用账号）、角色编码、权限编码唯一；账号可停用和恢复；分配角色仅允许 Active，且不激活账号；账号目录只允许选择 Active 账号。 |
| Dictionary | 新增值必须选择 Registered 字典；同一字典的 valueCode 唯一；新增值的 active 必须为 true，停用通过独立命令完成；字典值目录只选择 Active 值。 |
| FileUpload | 新引用仅选择 Available 文件；下载允许 Available、Referenced；Discard/Expire 仅允许 Available，避免误删已引用文件。当前仍为单次引用模型。 |
| DataExchange | Requested → Processing → Completed；Requested/Processing 可进入 Failed；状态转换逐 slice 建模，目录显式订阅全部阶段事件。 |
| SystemNotification | 发布状态固定 UNREAD；单条已读属于通知生命周期，全部已读是独立的收件人批量确认，不使用收件人 ID 检查单条通知状态。 |
| TenantManagement | 保持租户和成员各自的生命周期；更新租户等不改变状态的操作同样生成前置状态校验。 |

数据交换及通知保留旧 `status` 输入字段以兼容现有基础设施调用，但通过表达式限制其与操作一致，不能任意指定结果状态。数据交换的生命周期判定及下载条件使用显式 state。导入 Completed 表示任务处理结束，不表示每一行成功，仍需查看 successRows/failedRows。

### 尚未闭环的能力

以下不是本次状态约束改造已经完成的能力，不应依赖生成器猜测：

- 归档字典后，对已有字典值的跨投影联动禁用：当前限制新增值，已有值的父目录联动仍需通用关联校验/投影更新能力。不能加一个不会被正确维护的派生字段来模拟。
- IAM 撤销分配事件对关联目录的删除/失效投影、Token 撤销及账号停用对已有 Token 的处理，需要连同认证和投影实现补齐。
- 多处文件引用、解除引用及引用中的过期策略，需要独立的引用关系模型。
- 导入失败行重试、取消、执行幂等及行数一致性需要完整执行协议；本次只补齐既有阶段的合法转换。
- 通知收件人的可信身份绑定、批量已读的时间边界及重复事件幂等，需要通知执行和投影实现配合。
- 租户成员的外部账号存在性/停用联动尚无身份目录 provider；不将租户模块强制绑定内置 IAM。

重新导出模型并重新生成受影响的后端/前端后这些变更才会进入业务项目。已有数据中新加的 state 字段需要迁移或重建投影，不能认为模型更新会自动回填历史数据。

### 生成链路复核

- 导入/导出处理器先提交 Processing，再调用执行器，成功后提交 Completed，异常时提交 Failed。导入开始时 totalRows 为 0（尚未扫描），完成事件记录最终行数。
- 回放仅使用显式的事件状态关联；事件名称中包含 Ready/Failed 等词不改变聚合状态。
- 生命周期命令首先按模型元素 ID 匹配，不能借用其他 context 中同名命令的约束。
- 同一目录的 ID 和附带字段按同一条记录校验：只按 ID 查询一次，附带字段与该记录比较。无法明确绑定 ID、复合 ID 或集合选择的情况会明确阻止生成，不能把非 ID 字段传给 findById。

## 操作审计

通过内置能力显式启用，无需新增 DSL 语法：

```medol
import operation-audit as Audit deploy Support

frontend AuditConsole {
  includes OperationAudit from Support
}
```

导入产生只读 `OperationAuditCatalog`，记录操作类别、名称、开始/完成时间、结果、操作者、租户、消息/关联 ID、模型声明的对象 ID、耗时、错误码及 HTTP 状态。没有公开的新增、修改或删除命令；页面沿用普通 readmodel 的查询、筛选和权限生成。

这是**每个部署本地采集**的能力；需要审计的 backend 均须导入，导入 Support 不会自动采集其他服务。导出契约 `operationAudit` 来自内置能力导入，用户定义同名 context 不会意外开启基础设施。

### Axon5 实现

- 命令和查询使用 Axon 5 `MessageHandlerInterceptor`，通过 `ProcessingContext.onError/whenComplete` 观察异步执行结果。仅提交完成且无错误时记录 SUCCEEDED；业务拒绝记录 REJECTED，执行或提交失败记录 FAILED。没有使用 Axon 4 的线程绑定 UnitOfWork 审计方式。
- HTTP Filter 在 Spring Security 外层记录最终状态，因此未登录、权限拒绝、下载和查询入口也可记录；Servlet 异步请求等待完成。HTTP 和消息记录表示不同执行阶段，通过 correlationId 关联，不能直接相加当作用户操作次数。
- 拦截器只发布 `OperationExecutionRecorded` 基础设施事件，不直接写审计目录。发布通过 Axon `EventStore`，使用独立 `REQUIRES_NEW` 事务并明确不传入业务 ProcessingContext，避免随失败业务回滚。没有公开的新增审计命令。
- 唯一的 `AuditTrailProjection` 流式订阅操作结果事件及当前部署模型声明的业务事件，写入同一目录。HTTP/COMMAND/QUERY 表示操作结果，EVENT + RECORDED 表示已发生的业务事实，不能据此推断整个请求成功。
- 操作结果事件携带固定记录 ID；业务事件按来源、租户和消息 ID 形成稳定记录 ID。重复投递和回放不新增重复行，投影失败向 Axon 抛出以便重试。审计事件不会再生成一条 EVENT 审计，也不会从投影中发布新事件。
- 处理器名称按部署隔离并使用新的 v2 标识，不复用旧审计的处理进度；操作结果按来源部署过滤。业务事件订阅按当前部署模型声明的事件类型生成；Axon 5 的 Any/Object 参数不是通配订阅，未建模的外部事件不自动纳入。共享事件存储中相同事件类型的消息仍可能来自其他部署。
- 身份来自认证上下文及内部消息元数据，不信任外部 `X-User-Id`。启用租户时使用已校验的租户上下文；未启用时不把任意租户请求头当作审计租户。
- 不保存请求/响应正文、事件 payload、原始 URL/query string 或异常消息；HTTP 操作仅记录路由模板。历史 payload 不会自动删除。

启用租户时，审计目录属于平台管理 context，审计员权限可以查看跨租户记录。应只给平台审计人员授予目录读取权限；它不等同于租户成员的操作历史页面。

### 当前边界

操作结果事件发布失败会记录不含业务正文的错误日志，并保留原业务结果；发布成功后可通过事件重放恢复投影。需要配置持久化事件存储才具备跨重启恢复能力，`inmemory` 模式不提供持久化。尚无 outbox 保证“业务结束至审计发布”之间的崩溃窗口，也不提供防篡改保证。尚未包含跨服务集中汇聚、归档保留策略和定期清理。消息处理拦截器只覆盖已进入处理链的命令/查询；HTTP 层补充入口拒绝，但后台消息在进入处理链前被拒绝的情况尚未单独采集。

Axon 机制参考：[Message Intercepting](https://docs.axoniq.io/axon-framework-reference/5.1/messaging-concepts/message-intercepting/)。生成代码按当前使用的 Axon 5.1.1 API 验证。

### 替换旧审计

重新生成会移除旧的 `AuditLogEntry`、`AuditLogRepository`、旧 `AuditTrailProjection` 和 `/audit-trail` 查询接口源码，统一使用内置审计目录及其权限。请执行 clean build，避免旧 class 文件继续被扫描。旧 `audit_log` 表和历史数据保留，不自动迁移；新处理器不继承旧 token，也不能恢复历史上未记录的失败操作。

## 业务编号 numbering

```medol
import numbering as Numbers deploy Support

context Orders {
  slice CreateOrder {
    startsLifecycle
    command CreateOrder {
      orderId: UUID id
      orderCode: String generated by Numbers rule "order"
    }
    event OrderCreated { orderId: UUID id orderCode: String }
    state Created
  }
  concept Order { state Created slice CreateOrder }
}
frontend Admin { includes Numbering from Support }
```

`Numbers` 是导入别名，`"order"` 是管理员配置的稳定规则编码，不能根据业务 context 名硬编码。编号字段必须是命令的 `generated String`，不能同时是 ID 或声明来源映射。编号由命令处理器填写，HTTP 入参忽略客户端提供的编号；前端沿用 generated 字段规则，不显示输入框。事件中的同名字段保存实际分配值，列表和详情从业务投影读取；命令 HTTP 响应仍沿用原始命令回执，不能把其中的空编号当作最终结果。

### 规则与使用

内置 `NumberingRuleCatalog` 管理规则，`NumberAllocationCatalog` 只读查询分配记录。规则状态为 `Draft → Active → Suspended → Active`，可终止为 `Retired`；只有 Active 可以接收新分配。Draft/Suspended 可以修订，修订后回到 Draft，再激活。更新携带目录中的 `expectedVersion`，过期版本被拒绝。每次变更保留不可变历史版本；规则编码不能更改或复用，首次激活后命名空间和分配范围不能更改。

配置格式是 `prefix + dateFormat + 补零序号 + suffix`：

| 配置 | 说明 |
| --- | --- |
| ruleCode | 稳定业务规则编码，1–100 位字母、数字、点、短横线或下划线，首位字母/数字 |
| numberNamespace | 号码唯一性及共享计数的命名空间，与 ruleCode 使用相同字符限制 |
| prefix / suffix | 可省略的固定前后缀，总长不超过 180 字符 |
| timeZone | 时区，例如 `Asia/Shanghai`、`UTC` |
| resetPeriod | `NEVER`、`YEAR`、`MONTH`、`DAY` |
| dateFormat | 可省略；可选 `yyyy`、`yyyyMM`、`yyyy-MM`、`yyyyMMdd`、`yyyy-MM-dd`；必须能区分重置周期，DAY 必须包含完整日期 |
| allocationScope | `GLOBAL` 或 `TENANT`；TENANT 必须有已验证的租户上下文 |
| sequenceWidth / startAt | 位数 1–18，起始值至少 1 且不能超出位数；溢出拒绝，不截断或回绕 |

例：`ruleCode=order, numberNamespace=orders, prefix=SO, dateFormat=yyyyMMdd, timeZone=Asia/Shanghai, resetPeriod=DAY, allocationScope=GLOBAL, sequenceWidth=6, startAt=1`。管理命令权限由 `NumberingAdministrator` 生成，分配目录权限由 `NumberingAuditor` 生成；租户启用时两者属于平台控制面，不能直接授予普通租户成员。预览接口 `POST /numbering/preview` 接收配置，返回样例，不消耗序号；管理页面目前沿用普通生成表单。

### 分配、事务与恢复

- 无 Redis、无内存预分配号段。数据库按命名空间、范围、周期保存高水位，悲观锁和唯一约束控制并发，单个与批量（1–1000）共用算法。同一命名空间与范围的最终字符串不能重复；不同租户可以有相同字符串，GLOBAL 与 TENANT 是不同唯一性范围。
- 一次独立事务同时保存计数器、号码占用、幂等结果和 outbox。业务事务随后失败允许跳号，绝不回收已发号码。格式或周期变更导致字符串碰撞时拒绝，不自动重置或寻找另一个号码。
- 同一规则、租户、requestKey 重试返回原结果，包括跨日、规则修订、停用或终止之后。ownerKey 或数量不同会拒绝；检查历史回执先于新分配可用性检查。
- 字段自动绑定以 context、命令、字段和模型 ID 形成稳定键。调用方重试必须保留对象 ID；如果重新生成 ID，就属于新对象。编号幂等不代替业务命令自身的幂等约束。
- 规则和分配事件通过持久化 outbox 发布到 Axon，投影与 operation-audit 订阅这些事件。发布失败保留待发记录，使用同一消息 ID 重试；按至少一次投递处理，不宣称数据库与事件存储之间的恰好一次提交。事件存储必须持久化；`inmemory` 仅供测试。
- 计数器、占用表、版本、回执和未发布 outbox 是权威数据，需要随数据库备份。它们不能只靠读模型或事件重放恢复，也不能通过清理“旧日期”表项复用号码。

### 部署

Axon5 生成数据库实现及 `V2026110401__numbering.sql`。编号管理所在部署使用本地服务；其他部署生成客户端，需要配置 `MEDOL_NUMBERING_BASE_URL` 指向编号服务，并配置匹配的内部服务凭证。内部接口为 `POST /internal/numbering/allocate`，请求字段为 `ruleCode/requestKey/ownerKey/count/tenantId`，需通过内部 token 及权限校验；不向浏览器开放通用取号。TENANT 的 tenantId 由已验证的服务上下文传递，不接受用户自行选择的租户头。远程服务需部署编号能力及持久化数据库，失联时调用失败，不能降级为本地随机编号。

当前固定支持前后缀、日期和序号，不执行用户脚本或任意格式表达式；不提供无间断连续号码、分库全局协调或自动清理历史。其他后端生成目标尚未实现此契约，请使用 Axon5。

编号字段元数据可导出到旧 config 供生成器消费，但旧 config 不保留能力导入与部署信息，因此反向转 DSL 会明确拒绝含编号绑定的输入；请保留 source.medol，或使用工作区导出/导入完成迁移。远程编号服务的 422 业务拒绝保持为业务拒绝，不转换为普通 500。

规则目录按 ruleVersion 单调更新，投影写入前锁定权威规则行，覆盖目录首次建立及并发重投场景，旧版本不覆盖新版本。并发创建规则或首次创建共享计数器遇到唯一约束竞争时，使用原标识开启新事务重试；重复规则编码最终返回业务拒绝。移除内置能力后重新生成会清理旧生成接口及未修改的空决策扩展桩，保留 SQL 迁移与数据库数据；手写扩展不会自动删除。
