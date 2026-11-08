# 业务调度（Scheduling）

[总体说明](README.md) · [内置建模原文](../../src/builtin-models/scheduling.medol)

## 建模接入

```medol
import scheduling as Schedules deploy Support

extend Schedules {
  provider scheduledCommand from Reports.RunReport {
    occurrenceId runId
    scheduledAt requestedAt
  }
}
```

`Reports.RunReport` 必须是已有建模命令，`runId` 为必填 UUID，`requestedAt` 为必填 DateTime（可不映射时间）。复用现有 capability 扩展语法。导出的 `scheduling.targets` 是封闭的命令白名单，不能传 Java 类名、方法名或未建模命令。计划参数在运行时按绑定命令类型校验，不能覆盖生成字段或 occurrenceId/scheduledAt 映射字段。

内置 SchedulePlan 提供 Define/Revise/Activate/Pause/Resume/Retire；配置包括 providerKey、targetKey、argumentsJson、Once/Cron、scheduleExpression、timeZone、Skip/FireOnce。生命周期和每次接受的触发均由 Axon 事件溯源，修改需要 expectedVersion。暂停或退役后，即使旧任务还在调度器中，回调也会被权威状态和版本拦截。planVersion 在接受触发时也会递增，过期表单需要重新加载。

当前生成 SnailJob 2.0.2 适配器，不引入 Redis。周期/时区由 MEDOL 统一求出下一次到期时间，适配器仅注册一次到期触发；provider 实例按计划选择。可配置多个 SnailJob 实例；未来 PowerJob 实现同一 SchedulingProvider 接口并注册 `kind=powerjob` 即可同时使用。当前不包含 PowerJob 适配器，不会默默回退到 SnailJob。迁移时暂停、修改 providerKey、再激活；旧实例配置应保留到撤销同步成功。

Active 表示业务期望状态；调度器注册状态和命令投递状态独立保存。`/api/scheduling/status/{scheduleId}` 返回同步失败及近期触发记录；命令 Dispatched 不等于业务执行完成。命令至少一次投递，稳定 occurrenceId 必须用于目标业务的幂等建模。目标命令自身的状态卡控负责禁止业务执行重叠。一次性计划耗尽后保持 Active、nextAt 为空，暂停再恢复不会重复执行；只有显式修改计划形成新配置后才可重新激活取下一次触发。恢复周期计划从未来时刻开始，不补发历史积压。

SnailJob 的 Boot 4 worker 单独生成到 `scheduling/worker`，避免污染生成后端的 Boot 3 依赖。生成目录还包含 `application-scheduling.yml` 与部署说明；默认未启用后台同步，配置服务、worker、凭证和回调地址后开启。跨部署目标使用经过内部 token 认证的命令校验/投递接口。当前不隐式调度租户命令：生成器拒绝租户作用域目标，应通过显式授权租户的控制面业务命令承接。

同步注册、取消和投递使用持久化工作记录，失败退避重试；记录每个确定的注册身份以恢复未知结果。调度集成消费者禁止 replay，目录投影可重建；备份恢复必须同时保留工作记录与消费位置，不能通过清空回执重放业务。此能力适合业务定时计划，不保证秒以下或高频调度精度。详细时间语义、配置和故障边界见生成的 `scheduling/README.md`。

调度参数使用 `Text` 保存，避免目录投影被默认字符串长度截断；最近触发记录按计划触发时间排序。同步快照落后于权威状态时显示 `AwaitingProjection`，不会误报同步成功。`V2026110801__schedule_delivery_time.sql` 回填既有触发时间并升级目录字段。

## 部署顺序

1. 导入 Scheduling，并用 `provider scheduledCommand` 绑定实际命令。准备目标命令所需参数，occurrenceId 与 scheduledAt 对应字段由运行时填写。
2. 部署 SnailJob 2.0.2 服务及其数据库，创建 namespace 和 Java worker group，配置 group token；服务端 JVM 时区设为 UTC。
3. 在生成后端的 `scheduling/worker` 目录打包独立 worker，配置它到 SnailJob RPC 服务的连接。服务端需能访问注册的 worker，worker 需能访问 Scheduling 后端回调地址。
4. 配置 Scheduling 后端，加载下面的文件；跨部署目标还需要配置命令接收服务。
5. 迁移数据库并启动服务，开启后台同步，然后定义、激活计划；核对期望状态、同步状态和业务命令结果。

## Scheduling 后端配置

生成项目附带 `scheduling/application-scheduling.yml`。在生成后端目录启动时，通过 `SPRING_CONFIG_ADDITIONAL_LOCATION=file:./scheduling/application-scheduling.yml` 加载；已有附加配置路径需保留。

```yaml
medol:
  scheduling:
    enabled: ${MEDOL_SCHEDULING_ENABLED:false}
    callback-base-url: ${MEDOL_SCHEDULING_CALLBACK_URL:}
    providers:
      snail-primary:
        kind: snail-job
        base-url: ${SNAIL_JOB_OPENAPI_URL:}
        namespace: ${SNAIL_JOB_NAMESPACE:}
        group: ${SNAIL_JOB_GROUP:}
        token: ${SNAIL_JOB_TOKEN:}
        server-time-zone: UTC
```

| 配置 | 含义 |
| --- | --- |
| `MEDOL_SCHEDULING_ENABLED` | 开启后台同步与命令投递，默认 false；不是计划的 Active 状态 |
| `MEDOL_SCHEDULING_CALLBACK_URL` | worker 可访问的 Scheduling 后端基础地址 |
| `SNAIL_JOB_OPENAPI_URL` | SnailJob HTTP OpenAPI 基础地址，与 RPC 端口分开 |
| `SNAIL_JOB_NAMESPACE` / `SNAIL_JOB_GROUP` / `SNAIL_JOB_TOKEN` | 服务端已创建的 namespace、worker group 及凭证 |
| `MEDOL_SECURITY_INTERNAL_TOKEN` | Scheduling 后端内部认证凭证，写入 worker 的回调请求头 |
| `medol.scheduling.misfire-grace-seconds` | Skip 允许的迟到窗口，默认 60 秒，不能为负数 |
| `medol.scheduling.reconcile-delay-ms` / `delivery-delay-ms` | 后台扫描周期，均默认 1000 毫秒 |

计划中的 `providerKey` 填配置实例键，例如 `snail-primary`，不是 `snail-job` 这个适配器种类。可添加多个不同实例键；适配器专属扩展配置放在该实例的 `options` 映射中。当前只有 SnailJob 适配器；配置 `kind: powerjob` 本身不会安装或实现 PowerJob。

## 独立 worker 配置

在生成的后端目录执行：

```bash
docker build -t medol-scheduling-worker ./scheduling/worker
```

运行容器时注入以下变量：

| 变量 | 含义 |
| --- | --- |
| `SNAIL_JOB_NAMESPACE` / `SNAIL_JOB_GROUP` / `SNAIL_JOB_TOKEN` | 与服务端和后端配置的同一 worker group 对应 |
| `SNAIL_JOB_SERVER_HOST` | SnailJob RPC 主机 |
| `SNAIL_JOB_SERVER_PORT` | RPC 端口，默认 17888 |

独立 worker 使用 Boot 4，生成的业务后端使用 Boot 3；不要把 worker 的依赖直接加到业务后端。worker 使用内置 `snailJobHttpExecutor` 回调 Scheduling，业务命令继续由生成后端处理。

## 跨部署命令目标

同部署目标直接发送 Axon 命令。跨部署时，在 Scheduling 所在后端增加：

```yaml
medol:
  scheduling:
    targets:
      "[Reports.RunReport]":
        base-url: ${REPORTS_BASE_URL}
        token: ${REPORTS_INTERNAL_TOKEN}
```

`Reports.RunReport` 必须与建模绑定一致；Spring Map 键加方括号以保留点号。该 token 应匹配目标后端的内部服务 token，不要求所有后端共用同一个值。目标部署必须生成同一绑定，提供 `/api/scheduling/targets/validate` 与 `/dispatch`。前者只校验类型，后者提交正常业务命令；配置 URL 不能开放任意未建模命令。

## 计划字段与时间语义

| 字段 | 示例或约束 |
| --- | --- |
| `targetKey` | 完整命令键，例如 `Reports.RunReport` |
| `argumentsJson` | 只包含目标命令的业务参数，如 `{"reportCode":"daily"}`；不可覆盖生成字段和触发标识/时间 |
| `scheduleKind` | `Once` 或 `Cron` |
| `scheduleExpression` | Once 使用 ISO-8601 instant；Cron 使用 Spring 六字段表达式，例如 `0 0 9 * * *` |
| `timeZone` | IANA 时区，例如 `Asia/Shanghai`；业务时区独立于 SnailJob 服务端 UTC |
| `misfirePolicy` | `FireOnce` 合并错过的触发为一次；`Skip` 超过允许迟到窗口后记录跳过 |
| `expectedVersion` | 当前目录版本；触发被接受也会推进版本，过期表单须刷新 |

SnailJob 的单次注册需要未来时间，已到期或非常接近到期的触发至少安排到约 15 秒以后，但保留原 scheduledAt。高频计划会受注册与 HTTP 延迟影响并合并触发。一次性计划执行或跳过后都视为已耗尽；暂停恢复不重复执行，显式修订后才形成可重新激活的新配置。

## 状态、排查与恢复

通过 `/api/scheduling/status/{scheduleId}` 查看相应版本的同步状态和最近 100 条触发记录。该接口使用目录读取权限。

- `Pending`：等待同步；`Failed`：同步出错，保留重试；`AwaitingProjection`：运行记录落后于权威业务状态；`Synchronized`：当前快照已完成同步。
- 投递 `Pending` 表示待提交或失败待重试；`Skipped` 表示错过窗口后跳过；`Dispatched` 只表示命令已接受。业务任务完成情况查看业务自己的事件与目录。
- 凭证或回调地址变更后，超期重试携带当前配置；旧任务被关闭时仅在权威计划仍要求该触发的情况下恢复注册。
- provider 迁移需暂停、修订 providerKey、再激活。保留旧连接配置直到取消同步完成，不把原实例键直接改指向另一套服务。
- 执行 `V2026110701__scheduling.sql` 及 `V2026110801__schedule_delivery_time.sql`。后者回填旧触发时间、扩展参数列并补充目录字段；旧事件重放兼容缺失的执行标记。

当前验证覆盖生成、实际 Axon/JPA 链路、模拟 SnailJob HTTP 接口及 PostgreSQL 迁移；真实 SnailJob 集群仍需在部署环境完成端到端联调。
