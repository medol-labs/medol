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

进入租户必须同时满足“租户 Active + 当前账号成员关系 Active”。暂停租户不批量撤销成员，恢复租户也不恢复已被单独撤销的成员。租户暂停时可以维护或恢复成员关系，但不会因此获得进入租户的能力；默认同库同 schema 运行时根据两个目录的 `eligible` 校验。

目录中的暂停、恢复和撤销原因保留最近一次对应操作的信息，当前状态以 `state` 为准。账号标识保持与具体 IAM 模型解耦；账号是否存在、是否启用，必须由身份适配层验证，当前 UUID 输入本身不完成这项校验。

`TenantAdministrator` 是生成操作权限的 actor，不表示某个租户的管理员天然具有平台租户管理权。运行时必须保护平台控制面，不能把租户内管理员权限提升为跨租户权限。

租户成员关系只表示账号可以进入该租户，不授予业务角色。当前内置 IAM 账号、角色和授权仍属于平台控制面，其权限可用于该账号获准进入的租户。本版没有增加租户内独立角色分配；需要“同一账号在不同租户拥有不同角色”时，仍需后续 IAM 授权范围建模，不能把成员关系误当成角色授权。

## 扩展和替换

租户能力内部的两个标准 provider 的字段角色如下，实际上下文、读模型、字段名称均由用户决定。provider 名称用于选择扩展点，不承担启用能力的职责：

| Provider | 必填角色 | 可选角色 |
| --- | --- | --- |
| tenantDirectory | id、state | code、label |
| tenantMemberships | id、tenant、user、state | 无 |

映射字段必须是必填的单值字段。目录的 `id` 与成员的 `tenant` 类型一致。默认同 schema 实现要求租户和账号标识的存储类型为 UUID 或 String。两个目录都必须声明默认 `eligible when`，表示哪些行可用于租户访问；生成器不固定判断 Active。条件必须能映射到目录自身的存储字段，不支持未物化的跨目录关联，无法映射时阻止生成。

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
      eligible when { CustomerDirectory.status == "Ready" }
    }

    readmodel CustomerMembers[] {
      membershipKey: UUID id
      customerKey: UUID query
      accountKey: UUID query
      status: String
      eligible when { CustomerMembers.status == "Enabled" }
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

导出器先检查租户能力导入；未导入时省略整个 `tenancy` 属性，也不检查租户绑定。已导入时解析应用级绑定，生成 `tenancy.enabled = true`、有效目录与成员 provider 的路径及映射、平台管理上下文集合。context 不携带启用标志。`managementContexts` 包含有效目录数据源所在上下文，以及实际导入的内置 IAM；不是根据用户业务 context 名称猜测。目录应放在专用管理上下文，不要与租户业务数据混放。

Axon5 生成器直接消费应用级 `tenancy`，默认生成同数据库、同 schema 运行时，不再要求用户补写空适配器。开启时各 deployment 的默认连接及 operations 配置指向同一应用级共享数据库，默认 schema 为 `public`，可通过统一的 `DB_SCHEMA` 调整；未开启时保留原有各模块数据库配置。各模块使用独立的 Flyway history 表，避免迁移版本相互覆盖。现有 `.env` 或运维覆盖配置仍需检查，不能继续把模块指向不同数据库。

未配置能力时，不生成租户配置、上下文、拦截器、访问 SQL、复合存储主键及租户标签。移除能力并重新导出、生成 skeleton/all 后，会删除已知的生成租户运行时文件；手写扩展不自动删除。切换后必须 clean 构建，避免旧 class 文件继续被加载。

业务字段与技术元数据分开保存。例如业务目录声明 UUID 类型的 `tenantId`，技术消息租户值会存入 `metadataTenantId`；该名称也被业务占用时继续生成无冲突名称。没有名称冲突的模型保留原技术字段名，元数据赋值不会覆盖业务标识。

## 同库同 Schema 运行时

- HTTP 请求通过 `X-Tenant-Id` 选择租户，身份来自已认证用户，不信任 `X-User-Id`。默认使用一次有界 JOIN 校验租户可用及成员有效，不逐条加载目录、不使用无限增长的用户 IN 列表，也不缓存撤销结果。
- UUID 类型的租户、账号标识在校验后统一为标准 UUID 字符串，避免大小写等表示差异形成不同事件标签、文件目录或数据分区；String 类型的自定义标识保持原值。
- 命令的技术租户属性由派发拦截器覆盖，不能由 JSON 输入决定。业务事件持久化租户标签；状态恢复和唯一性占位的每个查询分支都包含该标签，缓存身份也包含租户。
- 业务投影使用“原业务主键 + 技术租户字段”的复合存储主键，同一个业务 ID 可以分别存在于不同租户。生成 tenant 索引；成员目录生成账号、租户联合索引。
- 未显式指定表名时，开启租户模式后的表名包含上下文前缀，避免共享 schema 内不同模块的同名目录冲突。显式指定的表名继续使用，但不同读模型不能绑定同一物理表。单独生成一个 deployment 时仍读取完整模型来解析租户目录，不要求把控制面实体复制到业务模块。
- Repository 的列表、过滤、详情、内部投影查找、写入均约束当前租户；业务 access policy 与租户条件叠加。跨租户投影写入被拒绝，不能靠修改查询参数绕过。
- 投影消费及重放使用事件原始租户，不采用正在处理的 HTTP 请求租户。局部上下文退出时恢复，异常时也会清理。
- 同进程事件自动化及系统通知处理器显式传递原事件元数据，并返回命令发送的异步结果，避免丢失租户上下文或吞掉异步错误。跨服务 Feign/RestClient 调用携带短时 HMAC 签名的租户、用户上下文，接收端要求服务认证并再次校验成员关系；需配置至少 32 字符的共享 `medol.security.internal-token`。
- operations 中启用租户的后端要求显式设置共享内部令牌和 JWT 签名密钥；Compose 不提供可直接运行的固定密钥，Kubernetes Secret 也保留空值等待配置。启动时检查目录 SQL 可执行；目录尚未初始化或数据库/schema 配错时启动失败，应先启动控制面。
- TODO 后台任务按服务账号有效成员关系分页遍历租户，每批 200 个，用游标而非全量加载。服务账号取 `medol.security.internal-subject`，没有成员关系就不会处理该租户。
- 内置 CSV 导入导出使用租户文件目录和租户相关任务摘要；下载校验真实路径归属。异步执行恢复并校验原租户和用户。自定义文件存储端口仍需自己的对象归属校验。
- 平台租户管理和当前内置 IAM 不按业务租户过滤，继续执行原有权限检查。provider 所在上下文属于管理面，因此应专用，不能把普通业务数据混放在该上下文。

本版是生成应用层的共享 schema 隔离，不是 PostgreSQL RLS。手写 SQL、直接使用底层 SpringData Repository、第三方存储和缓存需要遵守相同边界，不能绕过生成的 Repository。独立 schema、独立数据库路由尚未实现。

租户化 readmodel sync 尚缺租户化 checkpoint/outbox；生成器会明确拒绝这类配置，不生成可能混租户的默认同步。控制面事件直接投影到租户业务目录也会被拒绝，需要显式建模租户化投递。

### 已有数据与验证

已有无租户数据不会自动归给当前请求租户。启用前必须迁移业务表的主键、非空租户列和索引，并处理历史事件标签；不能只依赖 Hibernate update 改造旧主键。开发环境可以使用全新数据库验证，生产迁移必须单独评审。

同样，不要在已有多租户数据和事件库上直接移除 import 后启动单租户模型。关闭能力仅控制生成，不是数据合并或降级迁移；切换存储模式需要独立迁移或新环境。

生成器的 `npm run test:tenant-runtime -- --offline` 会导出测试模型、生成多模块后端并执行真实 H2/JPA 测试，覆盖同 ID 不同租户、查询隔离、跨租户写入、事件重放、状态与唯一性查询、可信请求、成员撤销、后台分页及关闭时不生成运行时。该命令在 `code-generator/.generator` 下执行，需要相邻的 medol 项目及 Maven 依赖，亦可通过 `MEDOL_SOURCE_ROOT` 指定 medol 路径。
