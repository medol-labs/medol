# 租户管理内置能力

租户是系统的数据隔离边界，与业务参与方、部门、项目等业务概念分开。租户管理复用现有的 `import`、`extend` 和 `provider`，不增加专用 DSL 关键字。

## 启用

```medol
import identity-access-management as PlatformIam deploy Support
import tenant-management as PlatformTenants deploy Support

context Orders {
  note "Tenant business context"
}

deployment Business {
  includes Orders
}

frontend Administration {
  includes TenantManagement from Support
}
```

`tenant-management` 提供租户与成员管理页面，并自带应用级 `extend TenantManagement` 默认绑定。没有额外 JSON、`runtimeExtensions` 或 context 开关。

开启前提是应用实际导入了 `tenant-management`（也支持内置别名及间接导入）。只有导入后，才解析和校验租户能力绑定。

- 导入内置模块，带入默认绑定，因此开启。
- 自定义时仍需 `import tenant-management`，再通过应用级 `extend TenantManagement { provider ... }` 覆盖默认绑定。
- 没有导入则不输出 `tenancy`，即使已有 `extend TenantManagement`，也不开启、不做租户能力校验；绑定不完整不会因此报错。普通语法与其他建模规则的校验仍保留。
- 已导入时，必要 provider 缺失、字段映射无效或绑定冲突会报错并阻止导出，不静默关闭。

`TenantManagement` 是工具提供的标准能力目标。自定义模型通过这个契约绑定数据，工具不会从任意业务表推断用途。`import tenant-management as PlatformTenants ...` 的别名也可以用于 `extend PlatformTenants { ... }`；先确认已导入能力，再解析引用并处理绑定。是否展示内置管理页面由 `frontend includes` 决定，与是否开启租户模式分开。

租户能力绑定必须写在模型顶层、domain/context 外。同一标准能力可以分多个 `extend` 块绑定，但最终每种 provider 必须只有一个有效来源；重复引入相同默认绑定会去重。

租户能力的启用范围是整个导出的应用模型，包括管理能力部署之外的业务 deployment。把租户管理部署在 Support，不代表 Business 可以绕过租户隔离。多个独立系统应分别导出模型。

`frontend includes` 仅选择管理页面，不能单独启用或禁用后端租户能力。

## 管理流程

| 对象 | 操作 | 状态变化 |
| --- | --- | --- |
| 租户 | RegisterTenant | 创建为 Registered |
| 租户 | ActivateTenant | Registered → Active |
| 租户 | SuspendTenant | Active → Suspended |
| 租户 | ResumeTenant | Suspended → Active |
| 租户 | UpdateTenant | 修改名称和描述，租户标识、编码不变 |
| 成员 | AddTenantMember | 创建为 Active |
| 成员 | RevokeTenantMember | Active → Revoked |
| 成员 | RestoreTenantMember | Revoked → Active |

租户编码全局唯一。成员按“租户标识 + 账号标识”唯一，撤销后通过恢复操作重新启用，不重新创建关系。恢复操作从原有成员关系派生租户和账号，不能更换归属。新增成员选择租户时使用 Active 可用性条件。

租户编码为 1–64 位字母、数字、下划线或连字符，首字符为字母或数字；唯一性比较沿用生成器的去首尾空白、忽略大小写规则。名称为 1–200 字符且不能全为空白；暂停、恢复租户及撤销、恢复成员都必须提供非空白原因，最长 1000 字符。

租户的更新、激活、暂停和恢复事件携带租户编码及当前名称、描述快照。快照取自命令执行时的聚合状态，包含之前的信息修改；客户端不能借状态操作修改编码。成员撤销和恢复事件都携带原租户与账号标识。

租户更新允许在 Registered、Active、Suspended 状态维护名称和描述，但必须是已经注册的对象。默认 `eligible` 用于后续流程选择可用租户，不能把它直接当成所有管理动作的执行状态限制；生命周期动作仍按各自状态转换控制。

进入租户必须同时满足“租户 Active + 当前账号成员关系 Active”。暂停租户不批量撤销成员，恢复租户也不恢复已被单独撤销的成员。租户暂停时可以维护或恢复成员关系，但不会因此获得进入租户的能力；上述有效访问判定仍由运行时适配器实现。

目录中的暂停、恢复和撤销原因保留最近一次对应操作的信息，当前状态以 `state` 为准。账号标识保持与具体 IAM 模型解耦；账号是否存在、是否启用，必须由身份适配层验证，当前 UUID 输入本身不完成这项校验。

`TenantAdministrator` 是生成操作权限的 actor，不表示某个租户的管理员天然具有平台租户管理权。运行时必须保护平台控制面，不能把租户内管理员权限提升为跨租户权限。

租户成员关系只表示账号可以进入该租户，不授予业务角色。账号身份可以跨租户复用；业务角色授权需要在当前租户内解析，不能直接复用其他租户的角色。

## 扩展和替换

租户能力内部的两个标准 provider 的字段角色如下，实际上下文、读模型、字段名称均由用户决定。provider 名称用于选择扩展点，不承担启用能力的职责：

| Provider | 必填角色 | 可选角色 |
| --- | --- | --- |
| tenantDirectory | id、state | code、label |
| tenantMemberships | id、tenant、user、state | 无 |

映射字段必须是必填的单值字段。目录的 `id` 与成员的 `tenant` 类型一致。`state` 映射状态字段；内置状态为 Active / Suspended / Registered 和 Active / Revoked，自定义状态的可访问含义由租户运行时适配器解释，不能猜测用户定义的状态名。

自定义目录示例：

例如 `customer-directory.medol`：

```medol
import tenant-management deploy Support

context CustomerAdministration {
  slice CustomerCatalogs {
    readmodel CustomerDirectory[] {
      customerKey: UUID id
      customerName: String display
      status: String
    }

    readmodel CustomerMembers[] {
      membershipKey: UUID id
      customerKey: UUID query
      accountKey: UUID query
      status: String
    }
  }
}

extend TenantManagement {
  provider tenantDirectory from CustomerAdministration.CustomerDirectory {
    id customerKey
    label customerName
    state status
  }

  provider tenantMemberships from CustomerAdministration.CustomerMembers {
    id membershipKey
    tenant customerKey
    user accountKey
    state status
  }
}
```

两种接入方式：

- 保留 `import tenant-management`，通过顶层 `extend TenantManagement` 或其导入别名覆盖对应内置 provider，可以只替换其中一个。
- 按以上示例提供自定义模块，通过 `import "./customer-directory.medol"` 引入；模块内部仍须导入 `tenant-management`，再覆盖默认绑定，不需要伴随文件。仅导入普通自定义模型文件不会自动开启租户模式。

替换 provider 只改变运行时读取的数据源，不会自动把内置命令的事件改写到自定义目录。自定义上下文需要建模自己的维护流程或同步投影；管理页面可以通过 frontend 仅引用自定义上下文。

内置来源提供的 provider 是默认绑定，用户声明的绑定优先；不通过 context 名称判断默认来源。同一种 provider 出现多个不同用户绑定时报告歧义，不依赖文件顺序选取。来源不存在、映射缺失、字段可空或类型不匹配会阻止导出。

租户 provider 应位于专用的管理上下文。导出的 `managementContexts` 标记平台控制面，不表示匿名公开；它与空 `access policy` 没有等价关系。

## 生成契约与当前实现边界

导出器先检查租户能力导入；未导入时省略整个 `tenancy` 属性，也不检查租户绑定。已导入时解析应用级绑定，生成 `tenancy.enabled = true`、有效目录与成员 provider 的路径及映射、平台管理上下文集合。context 不携带启用标志。`managementContexts` 来自有效数据源所在上下文，因此这些目录应放在专用的管理上下文，不要与租户业务数据混放。

Axon5 生成器直接消费已解析的应用级 `tenancy`，生成 `TenantCapabilityConfiguration` 和稳定的 `TenantIsolationRuntime` 接口，不再维护额外注册表。该契约在 deployment 裁剪后仍保留；无效契约报错。所有业务部署均执行启动检查；必须提供唯一的 `TenantIsolationRuntime` Bean。未接入时启动失败，不会以透传 `tenantId` 的方式假装已经隔离。移除能力后重新导出模型并生成 skeleton/all，会移除旧的启用配置；接口继续保留，便于手写适配器保持编译兼容。

业务字段与技术元数据分开保存。例如业务目录声明 UUID 类型的 `tenantId`，技术消息租户值会存入 `metadataTenantId`；该名称也被业务占用时继续生成无冲突名称。没有名称冲突的模型保留原技术字段名，元数据赋值不会覆盖业务标识。

**当前交付的是租户管理模型、可替换 provider 契约和运行时启用检查，不包含开箱即用的完整存储隔离适配器。** 管理模型可以生成后端命令、事件、投影和前端管理页；实际运行前仍需接入适配器。

适配器必须实现并验证：

- 从可信身份解析当前租户，校验租户状态、账号存在性和有效成员关系；不能直接信任客户端 `X-Tenant-Id`。
- 命令写入、对象引用、事件状态恢复及唯一性约束的租户隔离。
- 投影写入、列表、详情、统计、下拉选择和导出的租户隔离。
- 事件消费、重放、自动化和重试中的租户上下文传播与恢复。
- 当前租户的 IAM 角色授权，以及文件、缓存、任务和其他资源隔离。
- 平台控制面独立授权，以及跨部署目录访问或同步机制。

同表、独立 schema、独立数据库的选择由适配器和部署配置处理，不写进业务模型。租户隔离与 `access policy` 组合执行；空业务访问策略不能取消租户边界。
