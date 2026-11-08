# 业务日历

`business-calendar` 定义工作日、工作时段、节假日与调休例外，提供业务日期和工时计算。日历负责时间规则，scheduling 负责执行任务；导入日历不会自动创建调度计划。

```medol
import business-calendar as Calendar deploy Support
```

将 `BusinessCalendar` 加入所需前端的 includes，生成日历创建、修订、启用、暂停与目录页面。首版通过 JSON 管理时段规则，未提供拖拽式排班编辑器；不增加 DSL 专用关键字。

## 生命周期与版本

- DefineBusinessCalendar 创建 Draft：calendarId、calendarCode、calendarName、timeZone、validFrom、validThrough、weeklyScheduleJson、dateOverridesJson、reason。
- ActivateBusinessCalendar：Draft / Suspended → Active，校验整个维护日期范围后启用。
- SuspendBusinessCalendar：Active → Suspended，停止新的无版本引用。
- ReviseBusinessCalendar：只允许 Draft / Suspended，修订后回到 Draft，需重新启用。

修改必须携带 expectedRevision 和原因，防止并发覆盖。日历编码唯一且不可修改，引用使用稳定 UUID。只有 Active 日历可作为新的业务引用；管理操作按自己的前置状态选择对象，草稿不会因默认 eligible 被排除在启用操作之外。

所有变更保留完整历史。计算时不传 revision，要求当前状态为 Active；显式传入历史 Active revision，可以复现既有任务使用的规则，即使当前日历已经暂停。Draft / Suspended 的历史版本不能用于计算。

## 每周规则与日期例外

timeZone 使用显式时区，例如 Asia/Shanghai、Europe/Berlin 或 UTC。validFrom / validThrough 是包含首尾的日期范围，支持 1–3660 天，年份范围 0001–9998。

weeklyScheduleJson 必须声明全部七天，以免把漏填误认为默认工作日：

```json
{
  "MONDAY": [{"start":"09:00","end":"12:00"},{"start":"13:00","end":"17:00"}],
  "TUESDAY": [{"start":"09:00","end":"17:00"}],
  "WEDNESDAY": [{"start":"09:00","end":"17:00"}],
  "THURSDAY": [{"start":"09:00","end":"17:00"}],
  "FRIDAY": [{"start":"09:00","end":"17:00"}],
  "SATURDAY": [],
  "SUNDAY": []
}
```

dateOverridesJson 示例：

```json
{
  "2026-10-01": [],
  "2026-10-10": [{"start":"09:00","end":"17:00"}]
}
```

上述日期只是示例，不代表法定节假日安排。指定日期规则完整替换当天的每周规则：空数组表示休息，非空数组可表达调休工作日或半天工作。

每个日期最多 16 段、不重叠的 `[start, end)` 时段。时间格式 HH:mm，只有 end 可使用 24:00；跨午夜班次拆成两个日期的时段。相邻时段允许首尾相接。两份 JSON 各最多 256 KiB，日期例外必须处于维护范围内。

不硬编码周末或任何国家的节假日，不自动从外部网站同步。不同组织或业务可维护不同日历，由业务模型明确引用。

## 计算接口

应用内调用 `BusinessCalendarService.snapshot(calendarId, revision?)`，获取一次权威读取的规则快照；后续多次计算复用这个快照，避免中途读到不同版本。

| 方法 | 行为 |
| --- | --- |
| day(date) | 返回是否工作、规则来源及转换为 Instant 的工作时段 |
| shift(date, days) | 前后偏移工作日；不计起始日期，0 保留原日期，即使当天休息 |
| nextWorkingTime(from) | 返回不早于 from 的首个工作时刻；from 已在工作时段内则保持不变 |
| workingDuration(from, until) | 计算 `[from, until)` 内实际工作时间，返回秒及纳秒部分 |
| addWorkingTime(from, seconds) | 增加非负工作秒数，跳过休息时段；0 保持原时刻 |

偏移工作日最多正负 3660 天；增加工时最多 3660 个自然日对应的秒数。搜索耗尽维护范围时明确拒绝，不无限查找或退回固定周末规则。正好用完一段工时，结果可以是该时段结束时刻；nextWorkingTime 在相同结束时刻会转到下一个工作时段。

结果包含 calendarId、revision、timeZone 和 zoneRulesVersion，方便追踪计算来源。

## 夏令时与长期任务

启用时检查所有覆盖日期。时段端点落入夏令时跳跃造成的不存在时刻，或回拨造成的重复时刻，会明确拒绝；应为相关日期设置例外，不由系统猜测偏移量。

跨夏令时变更的实际工时按 Instant 差计算，可能与表面钟点差不同。例如某段当地 00:00–04:00 工作时间，实际可能是三小时或五小时。

日历 revision 固定业务规则，但不冻结 JVM 的时区数据库。要求跨 tzdb 升级仍保持既有结果的业务，必须同时保存已计算的截止时刻、规则版本和计算结果；不能仅凭日历 ID 重新推算。

新业务先读取当前 Active 版本，受理后保存版本和结果。历史版本查询用于已有任务追溯，不代表暂停日历可以继续接受新的业务引用。需要定时执行时，由业务适配器把计算结果交给 scheduling；日历修改不会自动改变已安排任务。

## HTTP 与权限

以下接口要求 business_calendar_catalog:read 或平台管理员权限，修改操作使用生成命令权限：

- `GET /api/business-calendars/{id}/day?date=2026-01-05`
- `GET /api/business-calendars/{id}/shift?date=2026-01-05&days=3`
- `GET /api/business-calendars/{id}/next-working-time?from=2026-01-05T00:00:00Z`
- `GET /api/business-calendars/{id}/working-duration?from=...&until=...`
- `GET /api/business-calendars/{id}/add-working-time?from=...&seconds=7200`
- `GET /api/business-calendars/{id}/history?after=0&limit=100`

计算接口可附带 revision。日期参数按日历当地日期解释，时刻参数需要 ISO 时间及偏移量。历史接口返回版本、操作者、原因和完整快照。这是管理能力；应用内调用还需由业务实施对象权限，跨部署需要授权客户端适配器。

## 部署与边界

复用 management 的主数据库事务、完整版本历史和持久化 outbox，不依赖 Redis。新增迁移 `V2026110805__business_calendar.sql` 建立独立的日历锁，保留原有 `V2026110804__management.sql`，不会修改已应用的迁移。

事件通过 Axon 更新目录并接入已导入的 operation-audit；运行主存储不是 Axon 聚合事件溯源。目录按 revision 防止状态回退，不能用目录的异步数据代替权威计算。备份包含当前记录、历史和未投递 outbox。

首版不支持 tenant-management 组合；不自动绑定组织、不管理个人排班、不提供任意循环排班周期，也不自动改写现有 scheduling 计划。
