# 数据归档（Archiving）

```medol
import archiving as Archives deploy Support
```

使用现有 DSL，无新语法；仅显式 import 启用 CodegenModel metadata：

```json
{"archiving":{"context":"Archiving"}}
```

## 请求契约

| 命令 | 输入 | 事件 | 请求目录 |
| --- | --- | --- | --- |
| `RequestArchiveBatch` | `batchId: UUID generated`、`targetKey: String`、`cutoffAt: DateTime`、`batchSize: Int` | `ArchiveBatchRequested` | `ArchiveBatchCatalog` |
| `RequestArchiveRestore` | `restoreId: UUID generated`、`archiveId: UUID` | `ArchiveRestoreRequested` | `ArchiveRestoreCatalog` |

ID 为技术字段，由服务生成。事件包含命令的完整字段快照，目录订阅对应事件。两个独立 concept 为 ArchiveBatch、ArchiveRestore；生命周期状态 Requested **仅表示已入队**，不表示完成或业务对象已经归档。目录记录请求输入，不是物理归档清单，archiveId 必须来自 runtime 实际完成归档的清单，不能用 batchId 冒充。实际进度、失败和完成状态由后端执行表及状态 API 提供；具体 API 路径以 runtime 为准。

## 必须实现的业务 adapter

导入模型不会自动获得业务数据归档能力。业务 adapter 必须显式注册 targetKey，并实现资格判断、冻结与并发检查、导出清单、受控清理和恢复。缺失 adapter、未知 targetKey、资格无法确定或冻结失败均须 fail closed，不能默认允许。runtime 校验 batchSize 在 1..1000 范围内且 cutoffAt 不晚于当前时间，按请求 ID 幂等执行；只有验证持久化导出清单完整后才能清理。恢复必须验证 archiveId、清单完整性及业务冲突。

物理归档移动数据，不应自行将业务对象标记为完成、关闭或删除；这些业务状态仍由业务上下文决定。业务对象的运行状态由后端执行表负责，不放入本上下文批次状态。首版不提供任意表删除，不删除事件，也不自动归档 arbitrary projection。

## 业务 adapter API

`ArchiveTargetAdapter` 以唯一 targetKey 注册为 Spring bean，并显式声明 `projectionBindings: Set<Pair<String, String>>`（context 与 readModel）。只有确实没有投影的目标才能声明空集合。

生成器将本部署实际已安装 guard 的 event-backed readmodel bindings 集合传给 runtime；启动时验证每个注册 adapter 的绑定都属于该集合。拼错、不存在、跨部署、sync/syncSource 同步投影，以及特殊 SystemNotificationSummary 和审计 projection 均拒绝绑定。自定义写入路径仍须手工接入保护，不能声明一个没有 guard 的投影来冒充受保护绑定。

接口方法：

| 方法 | 实现责任 |
| --- | --- |
| `candidates(cutoffAt, limit)` | 返回候选业务对象 ID，执行 target 保留期并遵守扫描上界和批量限制；候选不代表已获准清理 |
| `freeze(objectId, cutoffAt)` | 锁定权威业务状态并执行保留期及资格检查；不符合时返回 null，符合时返回持久化冻结 token 和快照 |
| `cleanup(objectId, frozenToken)` | 校验冻结 token，幂等清理；token 必须在进程故障后仍有效 |
| `restore(restoreId, snapshot)` | 按 restoreId 幂等恢复，由 adapter 按 schemaVersion 实现必要的 schema 升级，拒绝不支持的版本及在线数据冲突 |
| `projectionObjectId(context, readModel, event)` | 为投影保护解析业务对象 ID；默认返回 null，不能把默认实现视为已经接入 guard |

所有 mutation 方法必须加入调用方的主数据库事务；业务写入与投影共用 registry 对象锁。`ArchiveRegistry.lock(targetKey, objectId)` 必须在主数据库事务内调用，锁持续到提交；`state(targetKey, objectId)` 用于读取 registry 状态。

`ArchiveSnapshot` 包含 objectId、businessVersion、schemaVersion、payload、attachmentReferences。冷库附件仅保存持久引用，不搬运附件二进制，adapter 必须保证引用持久可用。runtime 不自动升级业务 schema；恢复前的版本识别、必要的 schema 升级及冲突拒绝必须由 adapter 实现。`FrozenArchive` 包含 token 与 snapshot；`ArchiveDocument` 包含 archiveId、targetKey、snapshot、sha256。单项冻结结果序列化后的大小上限为 4 MiB（包含 FrozenArchive 的 token 和 snapshot），超出会拒绝并回滚冻结事务；附件二进制不得打包进快照。不得删除聚合事件。

## Projection replay registry guard（必须）

runtime/业务 adapter 必须维护持久化归档 registry，以明确的 targetKey、业务对象 ID 和 archiveId 关联已物理归档对象。清理前必须建立有效保护。所有受影响 projection 的实时消费和 replay/rebuild 写入路径必须先查 registry，防止保留的历史事件把已归档行重新写回在线投影；缺失 guard、registry 不可用或状态不确定时拒绝清理与不安全回放，不能跳过保护。恢复完成并验证在线数据后才能解除保护。registry 本身不能随投影重建清空。

这是 runtime 与业务 adapter 的实现要求；MEDOL 只输出请求模型及 metadata，不生成通用任意投影 guard。未接入上述保护的目标不可启用物理归档。

## 部署、租户与导出

runtime 仅安装到归档上下文所在部署。首版业务 adapter **必须与归档 runtime 同部署、同主数据库**：所有 mutation 方法必须加入调用方的主数据库事务，业务写入必须与投影路径共用 registry 对象锁。远程调用不能加入这个本地事务；远程分布式冻结及其一致性协议尚未实现，因此首版不支持跨部署或跨数据库归档，不能仅实现一个 remote adapter 就宣称支持。

首版**不支持租户管控**，防止不同租户具有相同业务 ID 时串档。MEDOL 导出拒绝 archiving 与 tenant-management 同时启用（即使不同部署）；runtime writer 同时需要拒绝 localArchiving 与 model.tenancy 的组合。不能把 Archiving 列入 tenant managementContexts 当成兼容支持。

原始 source.medol / workspace 导出是可还原能力 import、别名和 deployment 的来源。旧式 config 反向转换无法保留此契约，带 archiving metadata 时直接拒绝，避免静默丢失能力。

## 周期归档与保留时长

cutoffAt 仅表示本次扫描上界。业务 adapter **必须执行 target 配置的保留期**，例如保留 730 天时按 `completedAt <= cutoffAt.minusDays(730)` 判断，同时检查业务完成状态、冻结条件等资格；不能仅凭 `completedAt <= cutoffAt` 清理。保留期缺失、无效或无法确定时必须 fail closed。保留期由业务 adapter 配置及解释，不新增命令字段，也不假定存在通用 retentionDays YAML 配置。自然日或固定 24 小时的选择、时区和边界包含关系必须由 target 明确约定。

可直接使用现有 Scheduling 绑定，每次触发动态注入扫描上界，无需包装命令：

```medol
import archiving as Archives deploy Support
import scheduling as Schedules deploy Support

extend Schedules {
  provider scheduledCommand from Archiving.RequestArchiveBatch {
    occurrenceId batchId
    scheduledAt cutoffAt
  }
}
```

`extend Schedules` 支持能力别名；provider 的 source 必须使用真实上下文名 `Archiving.RequestArchiveBatch`。当前 `Archives.RequestArchiveBatch` 不解析为命令，导出会拒绝；此行为已有绑定测试覆盖。

定义调度计划时，计划的 targetKey 填 `Archiving.RequestArchiveBatch`，argumentsJson 填业务 adapter 的 targetKey 与批量大小，例如：

```json
{"targetKey":"completed-orders","batchSize":100}
```

`completed-orders` 仅是示例，必须换成已注册 adapter 的目标键。计划 targetKey 选择建模命令，argumentsJson 内的 targetKey 选择归档业务目标，两者不同。不要在 argumentsJson 中填 batchId 或 cutoffAt：Scheduling 分别用稳定 occurrenceId 和 scheduledAt 注入，重复投递保持相同请求 ID 与扫描上界。adapter 不应以重试时的当前时间代替 cutoffAt；还应固定或记录该批次使用的保留策略，避免配置变化导致重试资格漂移。

同一计划下一次触发使用新的扫描上界，再由 adapter 扣除 target 保留期。手工请求同样遵守该保留期，不能通过传入 cutoffAt 绕过业务资格判断。调度部署与 provider 配置见[业务调度](scheduling.md)。

## Runtime API

**`archive_batch_catalog:read` 是归档管理员专用权限**：它同时允许读取归档列表摘要及详情中的完整 snapshot.payload，不仅是批次状态或历史摘要。列表不返回 payload，但同一权限仍可访问完整详情。目前这些接口尚未复用各业务上下文的行级访问策略，不应将该权限授予普通历史查询用户。targetKey 查询条件不是行级授权控制。

执行状态、归档历史与人工重试使用以下接口：

| 方法与路径 | 用途 | 权限 |
| --- | --- | --- |
| `GET /api/archiving/batches/{batchId}` | 批次执行状态 | `archive_batch_catalog:read` |
| `GET /api/archiving/restores/{restoreId}` | 恢复执行状态 | `archive_restore_catalog:read` |
| `GET /api/archiving/archives?targetKey=...&limit=50&after=...` | 物理归档历史摘要 | `archive_batch_catalog:read` |
| `GET /api/archiving/archives/{archiveId}` | 单个归档记录 | `archive_batch_catalog:read` |

历史列表的 targetKey 与 after 均可省略；limit 默认 50，允许 1..1000。结果按 archiveId UUID 升序排列，将上一页最后一个 archiveId 作为 after，不能把该顺序理解为归档时间顺序。历史列表仅返回 `ArchiveSummary(archiveId, targetKey, objectId, businessVersion, schemaVersion)`，不读取完整 payload，也不执行完整快照校验。详情 read 返回完整 ArchiveDocument，并校验 payload、archiveId/targetKey 的 SHA256 及身份/版本字段。批次、恢复状态或归档记录读取缺失时返回 404；无效参数返回 400。人工重试不满足准入条件（包括不存在或类型不匹配的请求）返回 400。上述接口也接受 `*:*` 权限。

| 方法与路径 | 用途 | 权限 |
| --- | --- | --- |
| `POST /api/archiving/batches/{batchId}/retry` | 重试归档批次 | `request_archive_batch:execute` |
| `POST /api/archiving/restores/{restoreId}/retry` | 重试恢复请求 | `request_archive_restore:execute` |

重试接口也接受 `*:*` 权限，仅允许 `FAILED` 且 attempts >= 5，或 `RUNNING` 且租约已过期的对应类型请求。它将状态置为 PENDING、attempts 清零、清除 lease_token、retry_at 设为当前时间并清空 error，保留原请求参数；其他情况拒绝，不表示所有 FAILED 请求都可人工重试。先排查故障原因，再调用接口，不手动修改请求参数。状态接口返回持久化队列记录，执行状态包含 PENDING、RUNNING、FAILED、DONE；FAILED 未达到五次上限时仍可能自动重试。批次状态另含 selected（已选入并记录的归档项数）与 completed（其中已完成的项数），不代表所有扫描候选数量；恢复状态不包含这两个计数。

## 配置与运行

生成目录包含 `archiving/README.md`、`archiving/application-archiving.yml` 和 `archiving/archive-store.sql`。从生成后端目录启动时，用 `SPRING_CONFIG_ADDITIONAL_LOCATION=file:./archiving/application-archiving.yml` 加载配置；已有附加配置路径需保留。

| 配置 | 含义 |
| --- | --- |
| `ARCHIVING_ENABLED` | 默认 false；关闭时拒绝新的归档/恢复命令并停止 worker，历史读取及 projection guard 不因关闭而停用 |
| `ARCHIVE_DATASOURCE_URL` | 独立 PostgreSQL 冷归档库 JDBC URL；按生成 README 配置 `connectTimeout=5&socketTimeout=30`（秒） |
| `ARCHIVE_DATASOURCE_USERNAME` / `ARCHIVE_DATASOURCE_PASSWORD` | 显式配置冷库凭证 |
| `medol.archiving.worker-delay-ms` | 工作扫描周期，默认 1000 毫秒 |
| `medol.archiving.outbox-delay-ms` | 完成事件投递扫描周期，默认 1000 毫秒 |

业务 adapter 与 runtime 共用主库事务；冷归档库必须是另一数据库，并使用独立权限、凭证及备份。主库 Flyway 迁移 `V2026110802__archiving.sql` 安装队列、journal、registry 和 outbox；在冷库手工执行 `archiving/archive-store.sql`。注册 adapter、完整投影绑定及业务写入锁后再启用。附件字节不会自动迁移。

worker 每次只领取 1 个请求，自动尝试上限五次，失败后等待 30 秒，运行租约为五分钟。每次领取生成独立 lease_token，完成或失败更新必须匹配当前 token，防止租约过期的旧 worker 覆写新 worker 的队列状态；业务执行仍依靠对象锁和 journal 保证重复执行安全。冷库写入单独提交，读取并验证 SHA256 后才清理主库；主库清理和 journal 在同一事务内回滚。恢复命令提交时即检查 registry 当前状态及活动 archiveId；实际恢复事务持锁后再次检查，不能用旧历史归档覆盖在线对象。同一恢复请求已完成后的重试先检查执行 journal，不重复访问冷库或恢复数据。完成事件通过 outbox 至少一次投递，消费者须按事件 ID 去重。归档集成消费者禁止 replay，备份恢复必须保留队列、journal、registry、medol_archive_bindings、outbox 和消费位置，不以清空记录重放业务。

停用归档时，只要仍配置有效的冷库 URL 和访问凭证，历史列表及详情仍可读取；停用不会移除 project 保护。构造 ArchivingService 时校验配置和主库事务关系，但不连接冷库，避免冷库不可用阻止服务启动。实际历史读取或归档操作仍需要冷库可用；停用不等于关闭 outbox 或撤销保护。

## Projection guard 的维护限制

归档在 freeze 前通过 protectBindings 将 target 的完整 projectionBindings 声明持久化到 `medol_archive_bindings`。每次 project 都会检查所有受保护 target（registry 状态不为 LIVE 或 RESTORED）的当前绑定是否与持久化声明完全一致；adapter 缺失、声明缺失、binding 删除、改名或清空都会 fail closed，不会因匹配不到当前投影而放行。该校验覆盖所有受保护 target，因此一处声明不一致也会阻止其他经此 hook 的投影处理。

失败批次续跑到每项清理前、恢复执行写入前，也会重新校验持久化绑定；不一致时保留热数据或归档状态并记录失败。清理还须确认该项仍持有 registry 当前 FROZEN 状态及 archiveId。

只有该 target 已无受保护对象后，新的归档执行才允许更新持久化绑定声明；不能直接修改声明表绕过校验。备份恢复必须同时保留 registry 与 medol_archive_bindings。生成投影 hook 随后取得 registry 对象锁，已声明 binding 的事件无法解析对象 ID 时拒绝处理。关闭 ARCHIVING_ENABLED 不关闭这些保护。

**移除 archiving import 后重新生成仍有风险**：生成器将不再安装 guard，持久化声明本身无法保护已经绕过 hook 的写入。因此，有受保护数据时不得卸载 import，也不得绕过 hook 直接调用投影 updater。需要修改绑定或卸载能力时，必须先恢复相关对象，或完成经验证的保护迁移；关闭 enabled 才是保留保护的执行停用方式。

投影 hook 不会自动阻止聚合命令执行。所有业务写入和命令入口必须显式取得同一 registry 锁并检查保护状态；只加锁而不检查状态仍不足以禁止修改已冻结或已归档对象。自定义投影写入路径也必须接入保护。
