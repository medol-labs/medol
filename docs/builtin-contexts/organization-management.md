# 组织与岗位

通过 `import organization-management as Organization deploy Support` 引入。将 `OrganizationManagement` 加入所需前端的 includes，生成组织、岗位定义、组织岗位、成员和任职管理页面。导入不会授予任何用户权限。

## 概念与业务流程

| 概念 | 用途 |
| --- | --- |
| OrganizationUnit | 行政组织树，支持多个根节点 |
| PositionDefinition | 可在不同组织复用的岗位职责类别 |
| OrganizationPosition | 某组织设置的某岗位；组织与岗位组合唯一 |
| OrganizationMember | 人员身份，独立于登录账号 |
| PositionAssignment | 某成员在一个时间区间内担任组织岗位 |

先创建组织、定义岗位，再设立组织岗位和登记成员，最后确认任职。组织、岗位、成员创建即 Active，可停用与重新启用；这不是审批流程。

组织、岗位、成员编码分别唯一，停用后不回收编码。引用使用稳定 UUID。修改使用 expectedRevision，禁止并发覆盖。组织移动通过 ReviseOrganizationUnit 修改 parentOrganizationId，不得移动到自身或后代；非根组织只能挂在 Active 上级之下。

OrganizationMember.userAccountId 是可选 IAM 账号引用，限制一个账号关联一个成员。首版不自动创建或验证远程 IAM 账号、不授予角色、不把岗位直接变成权限。对外部账号存在性有要求时，应在业务接入层验证。

## 任职与调岗

任职使用 `[validFrom, validUntil)` 半开区间，结束时间可为空。支持兼职；同一成员在同一组织岗位的任职不能重叠，同一时间最多一条主任职。岗位定义、组织岗位、组织、成员都必须有效。

- ConfirmPositionAssignment：确认任职，状态 Confirmed；未来任职在生效时间前不会出现在当前任职查询中。
- EndPositionAssignment：缩短任职区间，状态 Ended；如果结束时点在未来，在到达结束时点前仍属当前任职。
- CancelPositionAssignment：仅撤销尚未开始的任职，状态 Cancelled；已经生效的任职必须结束，保留历史。
- TransferPositionAssignment：在原任职区间内指定切换时点，结束旧任职并建立新任职，整个操作同一事务提交。新任职保留原结束时间，可指定新的组织岗位与主任职标记。

不能通过状态名称独自判断当前任职，必须同时判断时间区间。到期不依赖定时器；需要到期通知时可另行接入 scheduling。

停用组织前必须处理有效子组织与组织岗位；停用岗位定义前必须处理有效组织岗位；停用组织岗位或成员前必须结束或撤销当前及未来任职。依赖校验使用权威数据，不能通过读模型滞后绕过。

## 查询与权限

生成目录提供管理查询，新增引用的选择器使用指定用途 eligible 条件；后端仍独立校验。

- `GET /api/organization/members/{id}/assignments`：当前有效任职。
- `GET /api/organization/units/{id}/subtree`：包含根节点的组织子树 ID。
- `GET /api/organization/history/{id}?after=0&limit=100`：版本、事件、操作者、时间和完整历史快照（含变更原因）；仅平台管理员访问。

这些接口是管理接口，使用对应目录读权限；不是面向所有员工的任意人员查询。应用内可调用 OrganizationService.currentAssignments/subtree，但调用方仍须实施业务数据权限。

任职不等于 IAM 授权。审批资格、组织数据范围、岗位角色映射需要业务或 IAM 显式接入，本模块不猜测。历史报表按“发生时的组织层级”统计时，应消费组织移动事件建立历史关系，不能直接关联当前树。

## 实现与运行

组织操作采用主数据库事务，组织能力级数据库锁串行化管理变更，保证树防环和跨对象任职约束。它适合低频组织管理，不适合大量实时业务交易。

当前记录、不可变版本历史与 outbox 一起提交；outbox 将建模事件发布到 Axon，驱动目录和 operation-audit。这里不是 Axon 事件溯源聚合。不要仅回放 Axon 事件来替代权威管理表，也不要删除历史或未投递 outbox。目录重建使用事件，按 revision 忽略旧版本。

生成 Flyway 迁移 `V2026110804__management.sql`，与系统配置共用基础表；不需要 Redis。事件投递间隔 `medol.management.outbox-delay-ms` 默认为 1000。所有实例连接同一主数据库，数据库备份需包含当前表、历史和 outbox。

首版不支持 tenant-management 组合，导出和生成均明确拒绝。暂不包含矩阵汇报关系、薪资、职级、编制、组织审批或自动 IAM 授权。
