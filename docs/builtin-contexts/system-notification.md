# 站内通知（SystemNotification）

[总体说明](README.md) · [内置建模原文](../../src/builtin-models/system-notification.medol)

## 建模接入

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

## 生命周期与当前边界

发布状态固定 UNREAD；单条已读属于通知生命周期，全部已读是独立的收件人批量确认，不使用收件人 ID 检查单条通知状态。

通知收件人的可信身份绑定、批量已读的时间边界及重复事件幂等，需要通知执行和投影实现配合。

## 文案、权限与投递配置

站内通知通过 `import` 及业务事件的 `notifiable` 接入，不需要单独配置消息代理开关。文案通过生成的稳定 messageKey 和应用翻译资源管理；分类枚举与业务事件字段仍在模型中维护。

先确认收件人身份与查询/已读权限，再验证列表、未读汇总和 toast。业务事件进入通知处理器，不意味着已经发送邮件或外部消息；这些渠道需要实际投递适配器及相应连接配置，当前建模声明不会自动建立渠道。

生产使用持久化事件存储与通知投影，并按本页边界处理重复投递和批量已读语义。
