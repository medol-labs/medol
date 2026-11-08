# 操作审计（OperationAudit）

[总体说明](README.md) · [内置建模原文](../../src/builtin-models/operation-audit.medol)

## 建模接入

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

## 部署配置与使用

没有独立的 `audit.enabled` 建模开关；实际导入 `operation-audit` 才启用生成契约。需要采集的部署分别导入，并分别选择前端审计目录。

运行配置复用该部署的数据库、Axon 事件存储与认证配置。生成后端默认从 `MEDOL_AXON_EVENT_STORAGE` 选择事件存储实现；生产恢复需要持久化实现，不能使用测试用 `inmemory` 作为恢复依据。读取目录需要生成的审计权限，启用租户时这是平台级跨租户权限。

验证时分别触发成功命令、业务拒绝、未登录或无权限请求，再查看 HTTP、COMMAND/QUERY、EVENT 各类记录及 correlationId。记录阶段不同，不把它们相加作为操作次数。归档、保留期和集中汇聚按本页“当前边界”处理。
