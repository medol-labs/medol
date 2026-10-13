# MEDOL 访问策略建模说明

本文说明 `access policy` 的定位和语法边界。

`access policy` 用来描述 readmodel 的业务数据可见性策略元数据。它解决的是“当前访问主体在有读取权限的前提下，能看到哪些投影记录”的建模问题，不直接表达 SQL、Mongo query 或具体鉴权引擎规则。

数据权限需要分层处理：

- 租户、系统组织、独立库表、独立部署等隔离属于部署和运行时安全边界，优先由数据源路由、租户上下文或基础设施处理。
- 角色、权限、菜单、按钮、API、command 操作控制属于 IAM 和应用安全层。
- readmodel 的行级业务可见性由 `access policy` 描述。
- 业务对象是否能被某个流程继续选择或使用由 `eligible when` 描述。

## 核心原则

- 先定义策略，再在 readmodel 中引用策略。
- 如果某个 domain 下的 readmodel 确实共享同一种业务可见性，可以设置 `default access`。
- 如果不同 readmodel 依赖不同业务关系，应该显式写 `access <PolicyName>`，不要用一个默认策略覆盖所有投影。
- 访问字段必须说明所属 context、实体和字段名，MEDOL 不内置 `tenant`、`organization`、`owner` 等固定概念。
- 访问字段是策略锚点，不等价于当前 readmodel 上的字段，也不要求生成器把它机械拼成 where 条件。
- 物理多租户、独立库表、运行时鉴权引擎接入属于生成器、部署和项目适配实现问题，不在本语法中直接建模。

## TODO

数据权限的完整运行时语义后续继续完善，当前 `access policy` 先作为 readmodel 可见性元数据和生成器扩展点保留。

后续需要补齐：

- 同库同 schema 下的租户、系统组织或部署隔离默认实现。
- IAM 角色权限与数据范围配置的标准模型。
- 权限 scope 到查询谓词的映射，避免把大规模用户集合展开成 `IN` 条件。
- 业务可见性策略到关系查询、exists 过滤或外部权限引擎的标准适配方式。
- 字段级隐藏、脱敏、导出权限与聚合报表权限的边界。

## 基本语法

```medol
access policy DefaultAccess {
  RuntimeMonitoring.RuntimeIdentityCatalog.organizationId
}

access policy FederationMembershipAccess {
  FederationManagement.FederationMembershipDirectory.federationId
  FederationManagement.FederationMembershipDirectory.organizationId
}

access policy PublicAccess {
}

default access DefaultAccess

context RuntimeMonitoring {
  slice RuntimeCatalogs {
    readmodel RuntimeIdentityCatalog[] {
      runtimeId: UUID id
      organizationId: UUID
      runtimeName: String
    }

    readmodel RuntimePublicCatalog[] {
      access PublicAccess
      runtimeId: UUID id
      runtimeName: String
    }

    readmodel FederationOverview[] {
      access FederationMembershipAccess
      federationId: UUID id
      federationName: String
    }
  }
}
```

含义：

- `DefaultAccess` 表示访问适配层需要基于 `RuntimeMonitoring.RuntimeIdentityCatalog.organizationId` 这个模型字段识别访问域。
- `FederationMembershipAccess` 表示访问适配层需要基于联邦成员关系判断当前主体能看到哪些联邦记录；它不要求 `FederationOverview` 自身必须有 `organizationId` 字段。
- `PublicAccess` 是空策略，表示数据权限层不生成字段过滤条件；谁能访问由 IAM、API 权限、页面入口或服务端安全边界控制。
- `default access DefaultAccess` 表示未单独声明 `access` 的 readmodel 默认使用该策略。
- `RuntimePublicCatalog` 使用 `PublicAccess` 覆盖默认策略。
- `FederationOverview` 显式使用 `FederationMembershipAccess`，避免被不合适的默认策略误归类。

## 规则类型

### 访问字段路径

```medol
access policy DefaultAccess {
  RuntimeMonitoring.RuntimeIdentityCatalog.organizationId
}
```

访问字段路径使用 `<Context>.<Entity>.<field>` 格式，表示该策略依赖哪个上下文、哪个实体、哪个字段作为业务可见性锚点。

多字段可以写在一行：

```medol
access policy DefaultAccess {
  RuntimeMonitoring.RuntimeIdentityCatalog.organizationId, RuntimeMonitoring.RuntimeIdentityCatalog.runtimeInfrastructureId
}
```

也可以拆成多行：

```medol
access policy DefaultAccess {
  RuntimeMonitoring.RuntimeIdentityCatalog.organizationId
  RuntimeMonitoring.RuntimeIdentityCatalog.runtimeInfrastructureId
}
```

这些字段之间不在 MEDOL 中展开成查询条件。生成器或权限适配层负责把它们映射到当前登录主体、授权范围、关系查询或外部权限引擎。

例如 `FederationMembershipDirectory.federationId` 和 `FederationMembershipDirectory.organizationId` 可以被后端适配为：

- 平台管理员看全部。
- 参与方用户先解析自己可代表的业务参与方，再查这些参与方加入的 federation 集合。
- 业务 readmodel 查询时按 federationId 集合过滤。
- 服务账号或 runtime agent 可以按独立的 service identity 规则处理。

### 空策略

```medol
access policy PublicAccess {
}
```

空策略表示该策略不携带访问字段。readmodel 引用空策略时，数据权限生成器不追加字段级数据过滤。

```medol
access policy SystemAccess {
}
```

`PublicAccess`、`SystemAccess` 这类名称只是业务模型自己的命名。MEDOL 不解释这些名称，也不把它们当作固定权限语义。

## 与 eligible when 的区别

`eligible when` 解决“业务上是否可选、可继续使用”的问题，例如状态不是 Active 时不能被新任务选择。

`access policy` 解决“当前访问主体能看到哪些数据”的问题，例如只能看到本组织、本工作区或自己负责范围内的数据。

两者可以同时存在：

```medol
readmodel FederationOverview[] {
  access FederationAccess
  eligible when {
    Federation.state == Active
  }

  federationId: UUID id
  organizationId: UUID
  state: String
}
```

这里 `access FederationAccess` 控制谁能看到这个投影；`eligible when` 控制这个投影记录是否可被某个业务流程选择。

## 与 IAM 和租户隔离的区别

`access policy` 不替代 IAM。IAM 决定用户、角色或服务账号是否可以访问某个页面、API、command 或导出能力；`access policy` 决定通过该入口后 readmodel 查询结果应该落在哪个业务可见范围内。

`access policy` 也不替代租户隔离。单库多租户、独立 schema、独立数据库、独立部署等技术隔离，应由运行时安全上下文、数据源路由或基础设施完成。模型中如果出现 `Organization`、`Tenant`、`Workspace` 这类概念，也必须先判断它们是不是系统隔离边界；如果只是业务参与方，就不能把它直接作为全局默认隔离条件。

## 生成器处理建议

当前语法只输出稳定元数据：

- `accessPolicies`
- `defaultAccessPolicy`
- readmodel 上的 `accessPolicy`

具体生成器可以按技术栈选择实现方式：

- 在后端 query adapter 中追加访问域过滤。
- 在 repository/readmodel 查询层统一注入访问条件。
- 映射到外部权限引擎的 resource relation 或 attribute check。
- 在物理多租户部署中将策略解释为数据源/租户路由元数据。

MEDOL 不要求所有系统采用同一种权限实现。
