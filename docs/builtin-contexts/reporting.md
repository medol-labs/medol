# 业务报表

`reporting` 提供报表定义版本、参数契约、表格查询、异步 CSV 导出、个人执行记录和受控下载。具体统计口径、跨表关联、投影进度检查及归档数据查询由业务 `ReportProvider` 实现，不在 MEDOL 中增加 SQL 或 BI 表达式。

## 接入

```medol
import reporting as Reports deploy Support
import operation-audit as Audit deploy Support
```

在前端 `includes` 中加入 `Reporting`。报表定义目录提供管理表单，详情页提供参数输入、分页查询、导出和最近 50 条个人导出记录。报表运行时生成到拥有该上下文的部署；Provider 必须注册在该部署，不能通过导入自动访问另一部署数据库。

首版不支持 `tenant-management`，组合导入会明确拒绝。不要把跨租户读取藏在 Provider 中绕开这个限制。

## Provider 契约

在手写 infrastructure 包注册实现 `ReportProvider` 的 Spring Bean，接口位于生成项目的 `management.infrastructure`。

| 成员 | 约定 |
| --- | --- |
| `key` | 唯一、稳定的业务查询提供者编码 |
| `contract` | 版本号、参数字段、输出列；类型支持 STRING / INTEGER / DECIMAL / BOOLEAN / DATE / INSTANT |
| `fingerprint` | 查询实现语义指纹，统计口径变化时必须修改 |
| `authorize(actor, parameters, action)` | 按当前身份校验 QUERY / EXPORT / DOWNLOAD 的行范围和全部输出列权限；拒绝应抛出 AccessDeniedException |
| `query(actor, parameters, offset, limit)` | 返回不超过 limit 的记录、hasMore 和实际数据来源信息 |
| `openExport(actor, parameters)` | 返回可关闭的 ReportStream；每次 nextBatch 不得超过请求条数，空列表代表结束 |

后台没有 HTTP 登录上下文，Provider 必须使用传入的身份重新读取有效权限。组织任职不会自动变成报表数据权限。所有列契约固定；不能访问某敏感列时应拒绝整个报表，或定义另一个受限报表版本。

参数要求完整类型校验，不接受未知字段。Provider 仍须校验业务含义，例如起止日期先后、统计周期上限、组织归属等。SQL 绑定参数，固定允许的表和排序，不接受客户端 SQL、表名或表达式。

常规同库报表读取业务投影；高频重统计可建立专用统计投影；跨部署历史分析可使用分析库。不要逐条加载聚合，也不要每次扫描事件存储。

## 定义与版本

`CreateReportDefinition` 创建 Draft，输入 reportKey、versionLabel、reportName、providerKey、contractVersion。Provider 必须已经安装。运行时记录完整契约和实现指纹，生成事件和目录投影。

`ReviseReportDefinition` 只允许修改 Draft；报表编码和版本标签不能改变。`PublishReportDefinition` 再次校验 Provider 契约和指纹，进入 Published；`RetireReportDefinition` 进入 Retired。修改均要求 expectedRevision。

Published 版本不可修改，新查询和新导出只能使用 Published。修改统计口径、参数、输出列或实现指纹后，应创建新版本；不能让原 Published 版本静默指向新实现。待执行任务固定定义和指纹，失配时拒绝运行。历史任务的鉴权仍需要原 Provider 可用，升级时应保留对应 Provider。

## 查询与导出

实时查询同步返回，不为每次翻页建立任务。来源包含 `sourceVersion` 和 `consistency`：

- EVENTUAL：允许投影延迟，来源信息应说明实际刷新位置或数据版本。
- SNAPSHOT：Provider 保证所有结果来自同一实际快照，不能仅写一个请求时间冒充快照。

分页查询之间可能发生数据变化。需要固定结果时使用一次导出，并由 Provider 在整个流式读取期间维护一致快照。如果要求“某截止时间前的事件全部纳入”，Provider 必须检查相关投影进度；内置运行时不会猜测水位。

导出经历 Requested → Processing → Completed / Failed。数据库保存私有参数和固定定义；文件保存实际 CSV 结果及摘要。源数据说明保存在执行记录中，不进入公共事件。

工作线程在短事务中领取任务，然后释放锁取数。执行租约十分钟，批次之间检查五分钟执行预算。Provider 必须自己设置数据库只读事务、语句超时并释放连接，运行时无法中断任意阻塞的 Provider。

失败或租约过期的 Processing 可显式重试；需要原申请人、当前权限和 expectedRevision。每次重试再次取数，结果可能更新；尝试次数和状态变更进入历史。独立 attempt token 防止旧线程覆盖新尝试的结果。不自动重试，也不把相同参数视为历史结果可复现的保证。

文件流式写入暂存目录，完整写入并同步后原子发布，随后提交完成状态。下载重新校验所有者、业务权限和 SHA-256。下载审计表示已授权交付，不代表浏览器已经完整接收文件。

## 配置与限制

```yaml
medol:
  reporting:
    enabled: true
    storage-path: /var/lib/app/reports
    poll-ms: 2000
```

默认 enabled=false、storage-path=build/reports。多实例必须共享持久目录，文件系统需要支持原子目录移动和目录 fsync。数据库执行记录、管理历史/outbox 与文件一并备份；不能按可重建读模型清空。清理未引用的尝试目录、暂存目录前必须确认没有工作线程使用。

| 项目 | 首版上限 |
| --- | --- |
| 参数 / 输出列 | 30 / 100 |
| 参数 JSON | 64 KiB |
| 查询 | 每页 200 条，offset 不超过 10000，响应 4 MiB |
| CSV | 100 万条，128 MiB |
| 单个字符串字段 | 16384 字符 |

超过上限明确失败，不静默截断。CSV 为 UTF-8，使用 CRLF、引号转义并防止公式注入。参数表单保留整数和小数原始 JSON 数字精度，CSV 保留服务端数值精度；浏览器表格预览受 JavaScript 数值精度限制，要求精确展示的大数应在输出契约中使用 STRING。

## API 与权限

所有接口位于 `/api/reports`。

| 接口 | 权限 |
| --- | --- |
| `GET /{versionId}/contract`、`POST /{versionId}/query` | report_definition_catalog:read |
| `POST /{versionId}/exports` | request_report_execution:execute |
| `GET /{versionId}/executions`、`GET /executions/{id}` | request_report_execution:execute |
| `GET /executions/{id}/file` | request_report_execution:execute |
| `POST /executions/{id}/retry` | retry_report_execution:execute |

`*:*` 可满足入口权限，但仍须通过 Provider 数据授权和任务所有者校验。查询请求为 `{parameters: {...}, offset: 0, limit: 50}`；导出请求为 `{executionId: UUID, parameters: {...}}`；重试请求为 `{expectedRevision: 3}`。个人任务列表支持 offset / limit，按创建时间和 ID 倒序返回；并发创建时不同页可能移动。

不生成 unrestricted 的任务读模型。公开模型事件只含版本、执行状态、申请人、条数、摘要、通用错误码等元数据，不含参数、查询结果或 CSV 内容。审计目录仍应仅授权给审计管理人员。

## 与其他内置能力的关系

运行状态使用 JDBC 事务和持久化 outbox，发布事件进入 Axon，再驱动目录和可选的 operation-audit；不是 Axon 事件溯源任务存储。

调度、业务日历、文档生成和归档查询均需显式业务接入：调度命令需符合 scheduling 的发生标识契约；日历确定业务日期；文档生成可消费固定报表结果；归档数据需要 Provider 明确合并。首版不自动建立这些联动，不包含 XLSX、PDF、图表设计器或任意 SQL 编辑器。
