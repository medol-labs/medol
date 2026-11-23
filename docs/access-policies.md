# Readmodel 数据权限

`access policy` 定义权限字段与授权范围来源。`default access` 让 readmodel 自动继承；只有字段改名、追加约束或替换策略时才需要局部配置。

API 读取权限控制是否允许进入查询；数据策略决定能看到哪些记录；租户隔离始终独立生效；`eligible when` 表达业务可用性，不能代替数据授权。

## 显式启用

只有引用内置能力才启用运行时数据权限：

```medol
import data-access
```

未引用时，策略声明仅保留为模型元数据；不导出启用标记，不生成范围过滤器、范围来源、数据范围权限码、后台权限恢复或增量同步范围检查。IAM 的 API 权限与租户隔离独立运行。移除引用后重新生成会清理旧的生成运行时及 Spring 注册。

这是应用级基础设施能力，不创建额外的业务上下文或后端部署；无需 `deploy`。导出文件的所有者及目录安全检查独立保留，不会因关闭数据权限而允许跨用户下载。

## IAM 范围来源

```medol
import data-access

access policy DepartmentAccess {
  departmentId from identity.departmentIds
}
default access DepartmentAccess

context Orders {
  slice Views {
    readmodel OrderOverview[] {
      orderId: UUID id
      departmentId: UUID
    }
  }
}
```

`departmentId` 同时是稳定的规则名称和默认目标字段。服务端解析 IAM 授权属性后，在业务库执行 `department_id IN (...)`。不接受客户端提交的授权范围。

内置 `IdentityAccessAttributes` 支持 `identity.userId` 和 `identity.organizationId`；它不会把组织字段猜测为部门或业务参与方。`departmentIds` 等自定义属性需要应用注册 `IdentityAccessAttributes` Bean，使用传入的可信 CurrentUser 向 IAM 解析。未实现的属性明确拒绝。IAM HTTP 地址、令牌、缓存等配置属于适配实现，不写入 DSL。

## 业务关联来源

```medol
import data-access

access policy ParticipantAccess {
  organizationId from People.Members.organizationId by userAccountId = identity.userId
}
access policy MembershipAdministration {}
default access ParticipantAccess

context People {
  slice Views {
    readmodel Members[] {
      access MembershipAdministration
      membershipId: UUID id
      userAccountId: UUID
      organizationId: UUID
      state: String
      eligible when { state == "Active" }
    }
    readmodel RuntimeOverview[] {
      runtimeId: UUID id
      organizationId: UUID
    }
  }
}
```

执行顺序：

1. 验证当前用户拥有此范围授权。
2. 内部查询 Members，以 userAccountId 匹配当前主体，应用来源的默认 eligibility，获取去重的 organizationId 集合。
3. 独立查询 RuntimeOverview，以 organizationId 匹配该集合。

目标查询不生成 `EXISTS` 或跨库 JOIN，不复制 IAM 角色关系。范围来源是内部可信查询，不递归调用来源 readmodel 的 HTTP 数据权限；Members 的公开管理入口仍受自己的 API 权限控制。

当前内置业务来源支持同部署 JPA readmodel、`by <UUID字段> = identity.userId`，以及来源默认 eligibility 的等于/不等于条件（AND/OR）。命名 eligibility profile 不会被隐式选用。若关系可撤销，模型必须提供有效状态及对应默认 eligibility；生成器不会根据字段名猜测 Active。其他条件或跨部署来源明确报错，可改用 identity 范围及自定义适配器。

## 局部改名与追加

```medol
readmodel PersonalDatasetOverview[] {
  access {
    organizationId = ownerOrganizationId
    ownerUserId from identity.userId
  }
  datasetId: UUID id
  ownerOrganizationId: UUID
  ownerUserId: UUID
}
```

继承 ParticipantAccess，组织规则改绑 ownerOrganizationId，追加 ownerUserId 约束。两条约束取 AND。追加项不能覆盖已有规则；改名不会改变原规则的授权码。

权限字段必须已经存在且有正确的投影来源，不能通过权限声明自动创建。当前支持必填 UUID、String、Int、Long 标量。缺字段或来源/目标类型不兼容会阻止导出。

| 配置 | 行为 |
| --- | --- |
| 不写 access | 继承 domain 默认；没有则继承全局默认 |
| `access { ... }` | 调整继承策略的字段绑定，追加规则 |
| `access OtherPolicy` | 替换默认策略 |
| `access OtherPolicy { ... }` | 替换后调整或追加 |
| 显式引用空策略 | 不增加业务数据范围条件，仍需 API 授权并遵守租户边界 |

全局默认也会作用于导入的上下文，生成器不会遇到内置模型缺字段就自动豁免。包含内置能力时，优先在业务 domain 配置默认策略，内置上下文保持自己的权限边界。

## IAM 角色授权

生成器在 IAM 权限目录登记以下权限码，全部转为小写：

- `data:<策略名>:<规则名>:scope`：使用模型声明的范围来源。
- `data:<策略名>:<规则名>:all`：该维度不限制。

例如：

- `data:participantaccess:organizationid:scope`
- `data:participantaccess:organizationid:all`
- `data:participantaccess:owneruserid:scope`

通过现有 IAM 授权命令将这些权限分配给角色。不会因为角色有 read 权限而自动授予范围，也不会因为角色名叫 Admin 或持有 `*:*` 就隐式取消数据约束；需要显式范围授权。多个角色的有效权限合并，同一规则 all 优先于 scope；不同规则始终 AND。追加规则需要自己的授权。策略名和规则名若在转小写后发生碰撞，建模及生成时会拒绝。

`AuthorizationScopeResolver` 可被应用替换，以对接现有 IAM 的不同授权约定。结果必须是 `ALL`、`VALUES` 或 `NONE`；空集合等于无可见数据，绝不代表全部。

## 运行边界

- 列表、详情、计数和常规读模型导出沿用统一查询过滤入口。其他自定义 SQL、报表 Provider 必须显式接入授权。
- 普通内部 findById/投影更新方法不是用户查询接口；此改动不把读取权限自动当成命令执行权限。
- 范围最多 1000 个不同值；业务来源最多读取 1001 个不同值以检测超限。超限拒绝，不截断、不放行。大量范围应调整设计或使用明确的自定义适配方案。
- 一次 Specification 创建时解析范围，数据库分页与计数复用该结果。没有跨请求缓存；长任务每次查询可能重新解析权限，不承诺跨请求或跨批次的权限快照。
- 受保护异步导出在入队前检查 `BackgroundAccessActorResolver` 是否可用；事件处理时按任务元数据的用户 ID 重新读取当前身份和 API 权限，再在隔离的执行上下文中查询。结束或异常都会清理上下文。同部署内置 IAM 自动实现该接口；IAM 分库分服务时需要部署自己的可信 IAM 适配器。不会把 JWT 或权限快照持久化到任务。
- 异步导出文件按当前租户（如启用）与任务所有者隔离，下载校验目录及所有者，随机文件路径避免覆盖。旧版没有所有者目录的导出文件不能继续通过新下载入口访问，需要重新导出。导出文件是创建时的数据快照，下载不重新计算每一行的业务范围。
- 普通同步快照复用 readmodel 查询；outbox 增量包含历史更新、删除，不能直接用当前记录范围过滤，因此只有各维度显式 `ALL` 授权可读取增量。受限用户增量同步需要专门设计删除、撤权与历史可见性协议，当前默认拒绝。
- JWT 权限仍受现有令牌更新/撤销机制约束。
- 业务关系与目标数据是两次读取，不保证并发撤权瞬时生效。没有新增跨库事务。
- 多租户业务来源会保留租户限定；控制面来源使用现有控制面存储边界。

## 从旧字段路径策略迁移

旧语法只有 `Context.Readmodel.field`，无法明确范围来源。解析和往返导出仍保留这些元数据，但启用 data-access 后默认运行时拒绝非空旧策略，要求迁移到 `field from ...`，或提供显式自定义 `ReadModelAccessPolicyFilter`。不再默默使用 PermitAll。

空策略仍有效；未配置任何数据策略的 readmodel 保持原 API 权限行为。
