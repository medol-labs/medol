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
- `DownloadDataExportFile`：导出 job 完成后，`DataExportJobCatalog` 通过 `eligible for DownloadDataExportFile when { DataExportJob.status == "COMPLETED" }` 暴露下载动作。
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

- `category`：优先按事件所在上下文/事件名推导，例如 data exchange、training、runtime，否则为 `SYSTEM`。
- `severity`：按事件名推导，例如 `Completed/Succeeded` 为 `SUCCESS`，`Failed/Rejected` 为 `ERROR`，`Alert/Raised` 为 `WARNING`，否则为 `INFO`。
- `messageKey`：按事件名生成稳定 key，例如 `notifications.trainingJobCompleted`。
- `messageArgsJson`：默认序列化事件字段，保证导出/列表/详情使用同一套后端事实。
- `targetId`：优先使用事件 id 字段；没有 id 字段时为空。
- `toastPolicy`：按 severity 推导，错误/警告为 `IMPORTANT`，成功为 `DEFAULT`，其他为 `NONE`。

通知列表是业务事实；header 红点、未读数量和 toast 是前端呈现策略。生成前端会在 header 中探测 `SystemNotificationSummary`，有未读时显示标识；当新通知的 `toastPolicy` 或 `severity` 需要即时提示时弹出 toast。没有引入 `SystemNotification` 时，header 通知入口不会显示。

## 后续扩展方向

后续如果新增通用业务能力，例如导入导出管理、审计管理、通知管理，应优先按同一模式设计：

1. 先定义内置能力 context。
2. 业务模型通过 `import` 直接引用该内置能力。
3. 如果业务模型需要接入自己的表、投影或流程，再通过 `extend <内置能力> { provider <扩展点> ... }` 声明。

通用管理能力不应简单理解为“某个 readmodel 增删改查”。它更可能是一个内置管理能力，包含管理页面、任务记录、文件处理、执行状态和通用组件。业务模型后续再通过扩展点声明哪些业务资源接入该管理能力。
