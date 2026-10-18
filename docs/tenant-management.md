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

Axon5 生成器直接消费应用级 `tenancy`，默认生成同数据库、同 schema 运行时，不再要求用户补写空适配器。开启时各 deployment 的默认连接及 operations 配置指向同一应用级共享控制数据库，默认控制面 schema 为 `public`，可通过统一的 `DB_SCHEMA` 调整；未开启时保留原有各模块数据库配置。各模块使用独立的 Flyway history 表，避免迁移版本相互覆盖。现有 `.env` 或运维覆盖配置仍需检查，不能把各模块的控制面连接误指向各自业务库；独立业务库应通过资源绑定选择。导入决定是否生成租户逻辑，部署配置只选择已开启能力的存储方式，不是第二个启用开关。

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

共享 schema 模式是生成应用层隔离，不是 PostgreSQL RLS。手写 SQL、直接使用底层 SpringData Repository、第三方存储和缓存需要遵守相同边界，不能绕过生成的 Repository。

## 独立 Schema 运行时

不增加 MEDOL 关键字。保持租户能力导入及 provider 绑定不变，通过部署已有的 `application-infrastructure.yml` 配置存储模式：

```yaml
spring:
  jpa:
    hibernate:
      ddl-auto: none
medol:
  tenancy:
    mode: separate-schema
    business-pool-size: 10
    schemas:
      "[11111111-1111-1111-1111-111111111111]": tenant_a
      "[22222222-2222-2222-2222-222222222222]": tenant_b
```

`schemas` 的键是经过身份校验后的租户标识，不是租户名称或业务组织标识；UUID 使用标准小写形式，自定义 String 标识保持原值。schema 由受保护的部署配置提供，不能使用请求头拼接。schema 名限定为小写字母开头、后续小写字母/数字/下划线，最长 63 位；不能等于控制面 schema，也不能被不同租户重复绑定。默认 `shared-schema` 不需要该映射。未知模式会绑定失败，不自动退回共享模式。

- `TenantAccess` 负责租户和成员可用性，与存储方式分开。默认 JDBC 实现从固定控制面 schema 查询建模绑定的两个目录，不随业务连接的当前 schema 改变；自定义 `TenantAccess` Bean 可替换默认实现，并实现初始化校验。
- `TenantStorageResolver` 负责可信租户到存储位置的解析。默认使用上述部署映射，也可提供同接口 Bean 查询自己的受保护注册中心；接口不授予成员资格，仍需先经过 `TenantAccess`。
- 租户目录、成员关系、当前平台 IAM、审计以及 Axon 处理进度固定在控制面。业务实体使用 Hibernate 租户连接机制切换 schema，保留现有租户列、复合主键、事件标签和查询过滤。
- 独立 schema 模式使用固定控制面池和单独的业务池；业务池连接数由 `business-pool-size` 控制，复用同一数据库连接参数，不是每个租户一个池。自定义连接构造可提供 `TenantBusinessConnections` Bean；默认使用标准 `spring.datasource` URL、驱动和凭据。
- Axon 消费可能已开启控制面事务。生成的 `TenantExecution` 在该情况下挂起控制面事务，再进入租户业务事务；不同租户的业务事务不能相互切换。命令校验及投影都在正确边界内执行，不能只依靠 HTTP 线程上下文。
- 控制面处理进度与租户投影不是同一个提交。每个租户 schema 还需迁移技术表 `medol_tenant_projection_receipt`，联合主键为 `projector`、`event_id`，均为非空 `varchar(255)`；生成投影在同一业务事务内更新数据并记录事件收据，重投时跳过已处理事件。需要重建某个投影时，必须同步清理该投影的收据，不能只重置 token 或清空业务表。此机制不替代外部系统调用、通知发送等其他副作用自身的幂等处理。
- 连接借出时设置目标 schema，归还前恢复控制面 schema；恢复失败则中止连接。不存在的绑定、schema 或本 deployment 所需的业务表会拒绝访问，HTTP 和命令入口在业务执行前检查，不静默回落到控制面。
- schema/表是否存在的成功检查按进程缓存，避免每次请求重复查询元数据；成员资格、暂停与撤销结果不使用此缓存。变更部署绑定需重新加载应用，迁移版本一致性仍由运维流程保证。

默认仍由运维初始化租户 schema。需要自动创建和升级时，可显式开启下一节的受管迁移；两种方式都必须先初始化控制面，并为所有部署提供一致的绑定。标准 `spring.flyway` 继续管理控制面，租户迁移使用独立资源目录与历史表。独立 schema 强制关闭 Hibernate 自动建表，否则启动失败，防止业务表被误建到控制面。现有自定义命名策略及 ORM 映射需要与生成的控制面 schema 标记、`META-INF/medol-tenant-control.orm.xml` 合并，不能直接覆盖。

独立 schema 只隔离生成的关系型业务投影，不代表事件库、文件、缓存或数据库账号也已物理隔离。需要独立关系库或 UmaDB 时使用下文的物理资源绑定；只切换 schema 不会自动拆分事件库。租户存储管理页面及不停机迁移编排尚未实现。

## 租户存储初始化与迁移

此能力仍以导入 `tenant-management` 为前提，不增加 MEDOL 语法。仅在独立 schema 模式下显式启用：

```yaml
medol:
  tenancy:
    mode: separate-schema
    migration:
      enabled: true
```

保留上一节的租户/schema 绑定及 `ddl-auto: none`。`migration.enabled` 默认 `false`，也可通过 `MEDOL_TENANCY_MIGRATION_ENABLED` 配置；它只决定是否自动迁移与检查受管存储，不开启租户能力。没有导入租户能力时，不生成迁移运行时或初始迁移；共享 schema 模式不能开启此选项。

### 迁移文件

每个 deployment 根据实际生成的业务投影输出 `src/main/resources/db/tenant-migration/<deployment-key>/V1__tenant_baseline.sql`，包括业务表、复合主键、租户索引和投影收据表，不包含 IAM、租户目录、审计等控制面表。字段类型、枚举、集合/对象存储及技术元数据均取自通用生成模型，不使用具体业务表名。

V1 首次生成后保留，重复生成和 `--force` 不覆盖；同目录后续的 V2、V3 等 SQL 由用户维护。生成器会同步更新 `db/tenant-reference-schema.sql` 作为当前模型的目标结构参考，它不是自动执行的迁移。模型升级需要补版本脚本，不会自动推断删列、数据回填等业务语义，也不向历史数据填入虚构默认值。已执行的 SQL 不能修改，否则 Flyway 校验失败。

迁移包指纹递归包含子目录中的 SQL 及 `.sql.conf` 执行配置，防止只修改子目录脚本或事务配置时沿用旧的就绪状态。整个迁移目录中不允许同名资源重复出现。

不同 deployment 使用各自的资源目录和租户内 Flyway history 表，可以在同一租户 schema 中分模块升级；公共投影收据表采用幂等创建。没有 deployment 的单应用使用 `application` 标识。部署标识变更涉及历史归属，不能当作普通重命名直接切换。

### 执行流程

开启后，启动阶段在 Axon 消费器开始前，按可信绑定逐租户执行：

1. 在固定控制面登记租户/schema 归属，禁止自动改绑，也禁止同一 schema 被另一租户接管。
2. 取得 schema 迁移锁，再将本 deployment 的状态写为 `MIGRATING`；PostgreSQL 使用会话级 advisory lock，Flyway 同时维护自身迁移锁。
3. 创建缺失 schema，并校验、执行本 deployment 的版本脚本。只有其他模块表的 schema 可以继续加入新模块，但已有本模块业务表而没有迁移历史时拒绝自动接管。
4. 对照当前生成契约检查列、存储类型、主键和必要索引，并确认业务账号能读取就绪记录。
5. 完成后记录 `READY`、当前版本及迁移包指纹；失败记录 `FAILED` 和稳定错误码，并使当前应用启动失败，不带着未完成的存储开始消费事件。

控制面技术表 `medol_tenant_storage_location` 保存不可自动改绑的资源、schema 及绑定指纹，`medol_tenant_storage_progress` 按租户和 deployment 保存进度；原有 `medol_tenant_storage_binding` 保留为默认数据库的兼容归属记录，不能绕过它把已有租户直接改绑到其他数据库。这些不是业务建模中的租户状态，也不改变租户的 Registered/Active/Suspended 生命周期。受管存储就绪不等于用户已获成员资格，更不会自动激活租户。

受管模式下，HTTP、命令入口及业务连接均检查本 deployment 的 `READY` 状态和迁移包指纹；该结果不缓存，避免已有的 schema 存在性缓存绕过迁移状态。查询按租户/deployment 主键定位，不扫描全部租户，也不逐条查询业务数据。读取使用独立的小型只读连接池，不占用已挂起的 Axon 控制面事务或单连接业务池。

进程中断后可重新启动，或通过 `TenantStorageProvisioner.migrate(tenantId)` 重试；已完成的版本不会重复建表。异常不会触发自动 `clean`、`repair` 或删除 schema，非事务 DDL 留下的失败迁移需要运维显式处理。旧版本不能忽略数据库中已应用、但自身不存在的未来迁移。存储状态可通过同接口的 `status` 查询；需要管理页面或业务动作时，在手写扩展中接入并保护管理权限，本版不开放未经建模授权的迁移 HTTP 接口。

### 扩展与权限

默认遍历部署中的 `schemas` 及 `bindings` 配置。自定义 `TenantStorageResolver` 在开启启动迁移时需实现 `forEachTenant`，可以分页枚举受保护的绑定；缺失枚举实现会明确失败，不静默跳过。自定义 `TenantStorageProvisioner` Bean 可以替换默认 Flyway 实现，但必须保留存储归属、版本就绪与失败拒绝访问的边界。

默认数据库迁移连接使用标准 `spring.datasource` 参数。需要独立 DDL 账号时，通过 `medol.tenancy.migration.username/password` 引用部署密钥；独立数据库使用目标资源自己的迁移凭据，不接受请求传入地址或凭据。控制面业务账号必须具有控制面 schema 的访问权限，以及归属表、位置表和进度表的 SELECT 权限；DDL 账号还需要创建 schema、表和执行版本脚本的权限。不自动授予数据库权限，状态记录不保存凭据或原始异常文本。

已有手工初始化的租户表不会被直接纳入历史，也不自动复制、合并或回滚旧数据，接管前需独立评审。所有实例应使用一致的受管配置；启用、关闭或执行不兼容升级前应维护/排空请求。`MIGRATING` 会挡住后续访问，但不会取消已经进入的业务事务，本版不承诺不停机升级。

租户化 readmodel sync 尚缺租户化 checkpoint/outbox；生成器会明确拒绝这类配置，不生成可能混租户的默认同步。控制面事件直接投影到租户业务目录也会被拒绝，需要显式建模租户化投递。

## 独立数据库与多 UmaDB

继续使用同一个租户能力与 `TenantStorageResolver` 扩展点，不增加 MEDOL 语法或第二套 provider。解析结果扩展为 `schema`、`dataSource`、`eventStore`、`version`；旧的 `schemas` 简写仍指向默认数据库和默认事件库。

在 operations 的租户配置中声明逻辑连接资源并引用它们：

```json
{
  "operations": {
    "tenancy": {
      "mode": "separate-database",
      "migration": {"enabled": true},
      "dataSources": {
        "participant-a": {
          "url": "jdbc:postgresql://postgres-a:5432/tenant_a",
          "username": "${TENANT_A_USER}",
          "password": "${TENANT_A_PASSWORD}",
          "poolSize": 5
        }
      },
      "eventStores": {
        "participant-a": {
          "target": "umadb-a:50051",
          "plaintext": false,
          "apiKey": "${TENANT_A_UMA_API_KEY}",
          "generation": "1"
        }
      },
      "bindings": {
        "actual-tenant-id": {
          "dataSource": "participant-a",
          "schema": "business",
          "eventStore": "participant-a",
          "version": "1"
        }
      }
    }
  }
}
```

资源凭据只允许 `${ENV_NAME}` 引用，通过已有应用 `environmentVariables` 的 Secret 引用为每个后端注入，不能把实际密码放入连接资源配置。关系库资源可另外设置 `migrationUsername`、`migrationPassword`；未配置时沿用该资源的业务账号。数据源池和 gRPC 通道按资源复用，每类资源上限 32 个，每个数据源独立限制连接数，不随每次请求新建。

`separate-database` 要求每个租户显式绑定已配置的数据源；不同数据库可以使用相同业务 schema，同一资源/schema 不能归属不同租户。关系库独立并不要求事件库独立：省略 `eventStore` 时仍使用默认 UmaDB。反过来，`shared-schema` 或 `separate-schema` 也可通过完整 `bindings` 只拆分事件库。绑定与旧 `schemas` 不能为同一租户重复声明。环境中的 `dataSources`、`eventStores`、`bindings` 均整体替换基础映射。

### 数据库边界

控制面固定使用标准数据源；业务连接按可信绑定选择目标连接池，再选择 schema。管理投影仓储和审计仓储有控制面事务边界，必要时挂起业务事务，不会到租户数据库查询 IAM 或租户管理表。此边界只切换存储路由，不清除逻辑租户身份，权限扩展仍能取得当前租户。业务事务不能中途切换租户；运行中的绑定变化会被拒绝，未知资源或连接失败不会回退默认库。

控制面回查使用独立的固定控制库连接池，避免 Axon 挂起的外层控制事务耗尽主池后，业务事务再次查询控制面而死锁。其大小沿用 `businessPoolSize`，与业务资源各自的 `poolSize` 分别预算；迁移就绪读取继续使用独立的小型只读池。物理隔离模式下，默认租户成员资格校验也使用固定控制库的独立只读连接，避免 JDBC 复用当前业务事务绑定的租户库连接。事件流对不变的绑定做进程内正向校验，不逐事件重复查询控制面；成员资格及受管迁移就绪状态不因此被缓存。

数据库本身必须提前创建。受管迁移在目标数据库执行各 deployment 的历史脚本及结构校验；归属与进度仍集中保存在控制面。位置指纹包含资源、schema、版本及连接目标，禁止通过修改配置直接迁库。独立数据库另用 `medol_storage.database_identity` 登记稳定资源 ID，控制库标记为 `__medol_control__`；用于拒绝连接别名指向同一物理库或把控制库当作租户独立库。密码轮换不改变归属指纹。

业务账号需要目标业务 schema 的正常权限，以及 `medol_storage` 的 USAGE 和身份表 SELECT 权限；迁移账号需要创建该技术 schema/表。关闭自动迁移时，外部初始化也必须建立正确的数据库身份记录，否则连接被拒绝。独立数据库不等于独立服务器，需要服务器级隔离时还应部署独立实例、账号、网络及持久卷。

独立数据库或额外 UmaDB 启用后，即使业务迁移开关关闭，启动也会通过 `TenantStorageProvisioner.register` 登记并验证持久绑定，不能因关闭迁移就绕过改绑检查。这一步只初始化控制面技术登记表，不创建或迁移目标业务表；需要控制面 DDL/登记权限，业务数据库仍由外部工具初始化。自定义 provisioner 需实现该注册接口。共享关系库但独立事件库的租户允许共享控制 schema，绑定登记不会误用独立 schema 的排他归属约束；此模式也要求为租户提供显式绑定。

已登记且指纹一致的外部迁移模式只读取登记记录，不会在每次重启时再执行建表或 INSERT，允许业务账号只持有读取权限。首次登记或新租户开通仍需受控的登记权限。受管迁移在标记 READY 前还会用业务账号验证目标库身份及所有目标表的读取权限；INSERT/UPDATE 等业务授权仍需按实际使用单独授予。

### Axon 与事件源边界

额外事件资源当前仅支持 UmaDB；配置其他事件引擎时会明确失败，不静默忽略。控制面事件使用原默认事件源；业务事件按生成的 `__medol_tenant` 标签解析绑定。状态读取、追加冲突条件及事件写入必须位于同一绑定，跨租户/跨源的原子读取与追加会被拒绝。来源一致性标记与命令处理上下文也参与校验，不能将 A 库读取的标记用于 B 库追加。

物理路由从事件源起点重建状态；当前 Axon 的 Position 是封闭类型，因此对缺少源身份的正数 sourcing offset 明确拒绝，尚不支持自行传入跨源快照或增量状态偏移。流式消费者的持久化 token 不受此限制，继续从各自进度恢复。

Axon 默认工厂不允许一个 handler 同时匹配多个处理器。本实现按事件源分别构建处理器模块，每个模块绑定明确的 `eventSource`。默认事件源保留原处理器名称及 token；额外事件源使用包含资源身份、代次和目标的后缀，避免不同 UmaDB 的 position/token 混用。同一事件源中的多个租户共用订阅，不逐租户重复订阅；共享的仍是应用与控制面 token 存储，不代表消费者权限也已独立部署。

控制面 `medol_tenant_event_resource` 持久登记默认源及额外源的目标/代次指纹，防止只修改默认 UmaDB 地址却沿用旧 token。启用物理资源时，自定义 provisioner 也需实现 `registerEventSource`；业务账号需具有该表的 SELECT 权限。UmaDB 没有可用于本实现的原生租户 namespace/底层实例身份接口，外部地址是否实际指向独立实例仍由运维保证；operations 生成的多实例清单则使用独立卷，并拒绝规范化后重名的卷。

消费者从实际事件标签校验租户归属，并注入可信的事件源元数据；租户投影收据按事件源区分，默认源保留旧收据键。目标投影与收据在同一业务事务提交，控制面 token 更新失败后可重投去重。不引入 PostgreSQL 与 UmaDB 的分布式事务；跨库流程、通知和外部副作用仍需业务幂等或显式可靠编排，不承诺跨系统 exactly-once。

### Operations 资源部署

已有 `operations.infrastructure` 可增加 `additional` 列表，复用 PostgreSQL/UmaDB 的生成逻辑：每项声明 `type`（`postgres` 或 `umadb`）、唯一 `name`、独立 `volumeName`、镜像及 `environmentVariables`。PostgreSQL 项还必须声明 `databases` 和三个 `POSTGRES_*` 环境变量；这些数据库在该实例的独立初始化脚本中创建，不会误用控制库初始化清单。也可以不生成这些实例，直接使用外部数据库地址。

基础设施环境变量支持既有 `valueFromSecret`。Compose 可同时提供 `value` 为该实例专属的环境变量引用，例如 `POSTGRES_PASSWORD` 的 `value` 为 `${TENANT_A_PASSWORD:?Set TENANT_A_PASSWORD}`；Kubernetes 使用其 `secretKeyRef`，避免不同实例共用同名 Compose 变量。额外资源默认不映射宿主机端口，避免开发环境端口冲突；显式暴露时为每个实例设置独立 hostPort。生成器拒绝重复资源名及持久卷名。

修改绑定或事件源代次不是普通配置热更新。迁库、搬迁事件库前需维护并排空请求，复制和校验数据，显式处理原归属记录及消费进度，再启动新绑定；本版不自动执行这些破坏性步骤，也不在失败时清库、修复历史或回退其他资源。文件、缓存和租户内 IAM 角色管理仍不在物理存储隔离范围内。

既有共享 UmaDB 的透明拆分及跨源历史重放映射尚未提供，不能仅复制部分事件、修改地址后就重置所有处理器 token。需要原地搬迁既有租户时，必须另外评审历史事件归属与重放切换方案；当前实现适用于显式初始化的物理存储及新租户资源接入。

## Operations 部署适配

operations 只配置已有租户能力的部署方式，不开启租户能力。没有导入 `tenant-management` 时，不生成租户配置文件、挂载、探针或迁移参数，额外填写 `operations.tenancy` 也不会启用。

沿用现有 `operations.config.json` 或 workspace 的 operations 配置。例如：

```json
{
  "operations": {
    "tenancy": {
      "mode": "separate-schema",
      "controlSchema": "public",
      "schemas": {"tenant-a": "tenant_a"},
      "businessPoolSize": 10,
      "startupTimeoutSeconds": 600,
      "migration": {"enabled": true}
    },
    "environments": {
      "prod": {
        "tenancy": {
          "schemas": {"tenant-prod": "tenant_prod"},
          "startupTimeoutSeconds": 1200
        }
      }
    }
  }
}
```

默认 `mode` 为 `shared-schema`，`migration.enabled` 为 `false`。环境级 `schemas` 整体替换基础映射，不合并开发租户；环境中的其他配置覆盖基础值，迁移开关单独继承。所有后端共用该环境的绑定，不按 deployment 分别配置。配置中的租户标识是实际租户 ID，而不是租户名称；UUID 使用规范的小写格式。使用手写存储解析器时可以保留空映射，但开启启动迁移仍需实现可信绑定枚举。

Compose 输出 `operations/<environment>/configuration/tenant-storage.yml`，Kubernetes/K3s 输出包含同样内容的环境 ConfigMap。后端只读挂载至 `/etc/medol/tenant-storage.yml`，通过标准 `SPRING_CONFIG_ADDITIONAL_LOCATION` 加载；已有附加配置路径会保留。租户映射使用 Spring Map 的方括号键，保留自定义 String 标识中的大小写及标点。不要在应用级环境变量中再次覆盖模式、绑定或迁移开关。

生成前会校验各环境配置，单独生成 operations model 也不跳过。未知参数、`migration: true` 等非对象写法会报错，不能静默忽略。应用级 `MEDOL_TENANCY_MODE`、控制面 schema、租户映射及迁移开关覆盖会被拒绝；`DB_SCHEMA` 必须与统一控制面配置一致，独立 schema 不允许通过应用环境变量开启 Hibernate 自动 DDL。直接修改清单、外部 Spring 配置或进程环境仍属运维责任，不能据此认为任意外部覆盖也被生成器拦截。

独立 schema 自动配置 `ddl-auto=none`。**启动前仍须初始化控制面 schema 和全部控制面表**，租户迁移不负责生成 IAM、租户目录或其他管理表。业务 schema 是否自动初始化由迁移开关决定；关闭时需先外部完成建表和升级。已有 PostgreSQL 持久卷不会重新执行初始化脚本。

默认不注入独立迁移账号，沿用业务数据库凭据。确需独立 DDL 账号时，沿用应用 `environmentVariables` 的 Secret 引用，例如：

```json
{
  "name": "MEDOL_TENANCY_MIGRATION_USERNAME",
  "valueFromSecret": {"name": "tenant-ddl-account", "key": "username"}
}
```

密码以 `MEDOL_TENANCY_MIGRATION_PASSWORD` 引用同一 Secret 的 `password`。Kubernetes/K3s 使用已有 `secretKeyRef`；Compose 要求在环境密钥中提供对应的同名变量，不会读取 Kubernetes Secret。不要在 `operations.tenancy.migration` 写凭据，也不生成空凭据覆盖业务账号。数据库授权仍需运维完成，不会自动授予权限。

租户后端生成 `startupProbe`，默认等待预算为 600 秒，可按租户数量和实际迁移耗时调整。受管迁移的 Compose 健康检查延长启动宽限期，Kubernetes/K3s 使用 `Recreate` 并延长发布进度期限；配置指纹变化会更新 Pod 模板。此策略只避免同一 deployment 的普通滚动升级，不替代跨 deployment 的维护编排。不兼容升级前需排空请求并协调各模块，失败后修正原因重试；镜像回滚不等于数据库回滚，不自动 clean、repair、删除 schema 或改绑租户。

### 已有数据与验证

已有无租户数据不会自动归给当前请求租户。启用前必须迁移业务表的主键、非空租户列和索引，并处理历史事件标签；不能只依赖 Hibernate update 改造旧主键。开发环境可以使用全新数据库验证，生产迁移必须单独评审。

同样，不要在已有多租户数据和事件库上直接移除 import 后启动单租户模型。关闭能力仅控制生成，不是数据合并或降级迁移；切换存储模式需要独立迁移或新环境。

生成器的 `npm run test:tenant-runtime -- --offline` 会导出测试模型、生成多模块后端并执行真实 H2/JPA 测试，覆盖共享/独立 schema、自动初始化及版本迁移、失败与重试、并发和模块历史、同 ID 不同租户、查询隔离、跨租户写入、异步投影、事务边界、状态与唯一性查询、可信请求、成员撤销、后台分页及关闭时不生成运行时。该命令在 `code-generator/.generator` 下执行，需要相邻的 medol 项目及 Maven 依赖，亦可通过 `MEDOL_SOURCE_ROOT` 指定 medol 路径。独立 schema 测试还支持通过 `TENANT_TEST_DB_URL`、`TENANT_TEST_DB_DRIVER`、`TENANT_TEST_DB_USER`、`TENANT_TEST_DB_PASSWORD` 使用专用 PostgreSQL 测试库；测试会建表和写入，不能指向业务库。
