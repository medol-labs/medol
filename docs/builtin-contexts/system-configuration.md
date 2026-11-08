# 系统配置

通过 `import system-configuration as Settings deploy Support` 引入，将 `SystemConfiguration` 加入前端 includes，生成配置集创建、批量修改、回滚和查询页面。

此能力管理运行期间可调整的普通配置。数据库连接、调度器地址等部署配置仍放在运行环境；字典、编号规则和归档策略仍由各自上下文管理；密钥只允许保存外部密钥引用。

## 定义与取值

在生成项目的手写 infrastructure 包实现并注册 `ConfigurationDefinitionProvider` Spring Bean：

- groupKey：配置组稳定标识。
- version：定义版本。
- definitions：允许的键、类型、默认值、是否必填、数值范围、枚举值、是否允许租户覆盖、生效方式和说明。
- validate(values)：完整有效配置的组合校验；必须无副作用，结构化 JSON 的字段规则也在这里校验。

类型支持 boolean、integer、decimal、string、enum、duration、json、secretReference。duration 使用正数 ISO-8601 格式，如 PT30S、PT10M。JSON 只允许对象或数组；使用者必须在 provider 校验其结构。单次配置 JSON 最大 256 KiB。secretReference 只保存引用，不负责读取密钥，也不能代替密钥系统。

管理员不能新增定义之外的键。定义不会自动改变业务行为，消费者必须调用生成的 SystemConfigurationService 并使用返回值。

示例定义：

```kotlin
@Component
class ExportConfiguration(private val mapper: ObjectMapper) : ConfigurationDefinitionProvider {
    override val groupKey = "export"
    override val version = "v1"
    override val definitions = listOf(
        ConfigurationDefinition(
            key = "maxRows", type = "integer",
            defaultValue = mapper.valueToTree(100000),
            minimum = BigDecimal.ONE, maximum = BigDecimal(1000000),
            tenantOverride = true, effect = "NEW_OPERATION"
        )
    )
    override fun validate(values: Map<String, JsonNode>) {}
}
```

示例需导入 Spring、Jackson、BigDecimal 和生成应用的 `management.infrastructure` 类型，放入手写包而非生成目录。

## 创建、修改与回滚

CreateConfigurationSet 指定 configurationSetId、groupKey、scopeType、scopeId、valuesJson 和 reason。同一组和作用域只有一个配置集，空覆盖值用 `{}`。

- APPLICATION 作用域：scopeId 固定为 `application`。
- TENANT 作用域：scopeId 是规范租户 ID，必须已启用 tenant-management，并通过现有 TenantAccess 校验。

ChangeConfigurationSet 使用 expectedRevision 和 changesJson 原子更新多个键：

```json
{"maxRows": 50000}
```

清除覆盖、恢复继承：

```json
{"maxRows": null}
```

配置值本身不支持 null；false、0 和空字符串不会被当作未设置，仍须满足各自约束。修改整组校验通过后才提交。应用级修改还会验证所有已有租户覆盖后的有效组合，避免应用值变化使租户配置变成非法状态。

RollbackConfigurationSet 使用 expectedRevision、targetRevision、reason，把历史覆盖值按当前定义重新校验后写成新版本，不删除历史或回退版本号。

## 有效值、生效方式与一致性

优先级：定义默认值 → 应用级覆盖 → 租户级覆盖。只有声明 tenantOverride 的键才能被租户覆盖。缺失必填值、未知键、类型或范围错误会明确拒绝。

`SystemConfigurationService.resolve(groupKey, tenantId, actor)` 返回有效值、每个值的来源、定义版本、应用与租户配置版本，并提供 boolean/integer/decimal/text/duration 类型化读取方法。返回值与存储独立，修改返回对象不会污染后续读取。

首版每次 resolve 都在事务中读取权威数据，不设分布式值缓存，无需依赖刷新消息传播。代价是每次读取访问数据库，配置消费端应在一次业务操作开始时读取一次，不要在逐行循环中调用。

支持两种生效方式：

- DYNAMIC：后续读取使用新值，实际读取时机由消费者决定。
- NEW_OPERATION：新操作读取并固定返回快照，已开始的任务与其重试继续使用旧值；任务实现者负责持久化该快照。

这不是自动注入配置的全局机制。首版不支持组件重载、重启生效参数、定时发布或审批流。

## 定义升级

配置集中记录 definitionVersion。定义版本变化后，旧版本配置读取明确失败，避免悄悄按新语义解释旧值。通过显式修改迁移取值，按新定义完整校验后记录新版本。兼容升级时，保存校验使用当前定义验证相关旧配置的取值，不要求应用与所有租户先同时完成版本迁移；未迁移配置的读取仍然拒绝，避免静默改变语义。已废弃但实际存在的覆盖键可以用 null 清除，不能凭空写入或清除未知键。

如果一次升级涉及应用与多个租户配置集的破坏性变化，需要专门的协调迁移；当前没有任意多组 schema 迁移工具。应在变更定义前检查所有现存取值，不要把逐个管理页面修改当作完整升级方案。

## API、权限与租户

- `GET /api/system-configuration/definitions`：已安装配置定义。
- `GET /api/system-configuration/effective/{group}?tenantId=...`：有效值及版本。
- `GET /api/system-configuration/history/{id}?after=0&limit=100`：版本、事件、操作者、时间及完整历史快照（含变更原因），可核对回滚目标。

接口需要 configuration_set_catalog:read 或平台管理员权限；修改走生成命令权限。租户配置读取、修改、回滚和历史查询还会调用 TenantAccess.verify，不能通过传入另一个 tenantId 绕过成员关系检查。未启用 tenant-management 时拒绝租户覆盖。

配置管理上下文属于平台控制面，生成的通用目录是跨作用域管理目录，可能包含配置值。目录与命令权限只应授予受信任的配置管理员，不应直接授予普通租户成员作为自助配置页面；普通用户入口需要业务级的范围限制。

## 持久化与部署

当前配置、不可变版本历史和持久化 outbox 同事务提交。建模事件通过 Axon 驱动目录和 operation-audit；实现不是 Axon 事件溯源聚合。投递至少一次，目录按版本防止回退。发布器只处理当前部署已启用能力的 outbox；移除另一个能力遗留的事件不会阻塞配置发布，遗留记录保留供恢复后继续处理。事件和历史包含普通配置值，因此不得存入明文凭证。

生成 Flyway 迁移 `V2026110804__management.sql`，与组织能力共用基础设施。租户业务上下文调用解析接口时显式切回控制面事务；配置迁移目标 schema 必须与控制面 schema 一致。运行不依赖 Redis；事件发布间隔 `medol.management.outbox-delay-ms` 默认 1000。解析接口在配置所属部署本地使用，跨部署消费需要经过授权的客户端适配器。
