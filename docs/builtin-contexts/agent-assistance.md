# Agent 辅助能力

此模块通过现有 `extend/provider` 声明助手和业务工具范围，由生成器接入生成应用的 TanStack AI 1.x 服务、聊天面板和表单工具。MEDOL 自身的建模助手依赖不变。

```medol
import agent-assistance as Agents deploy Support

extend Agents {
  provider assistant {
    name SalesAssistant
    mode operator
  }
  provider agentQuery from Sales.OrderCatalog {
    assistant SalesAssistant
  }
  provider agentCommand from Sales.CreateOrder {
    assistant SalesAssistant
    confirmation required
  }
}
```

示例中的业务读模型和命令必须实际存在，引用使用真实 `Context.Element` 名。`assistant` 声明助手名及 chat/operator/bi 模式；`agentQuery` 只能绑定读模型，`agentCommand` 只能绑定命令。所有写操作要求 operator 模式及 required 确认，不能由运行配置降低。查询默认无需确认，也可显式指定 required。

导入本身不开放工具；未声明的助手、重复绑定、未知模型引用及未知策略键拒绝导出。普通同名 context 不启用此能力。模型声明的是工具范围上限，不授予业务权限，也不保证业务 adapter 已实现。

生成器输出 SDK 无关的能力清单及助手声明。手写助手配置可以选择模型允许的工具，不能增加模型外的能力；首次生成默认关闭并使用空工具列表。重新生成保留手写配置，但旧配置必须重新经过策略校验。页面挂载状态、身份及当前业务资格仍需要执行时校验。

内置 context 是能力契约入口，助手定义目前随建模版本管理，没有另外生成一套助手配置管理 CRUD。生成器已接通服务端鉴权与流式响应、普通表单自动注册、读取/填值/校验/撤销、最终参数确认及私有会话保存。生成应用中的 `agent-service/README.md` 包含启用与部署步骤。

默认不开启：先在生成的 `src/ai/assistants.custom.json` 选择模型允许的能力并启用，重新生成验证配置，安装依赖并启动独立 Agent 服务。模型密钥只配置在服务端。聊天与 BI 模式只读；operator 模式的写操作必须经 SDK 审批和最终参数确认。

目前可自动注册普通生成表单和读模型查询。引用选择器保留人工选择，以复用其资格与快照逻辑；文件上传、下载及自定义/直接动作需要专用适配器，不允许绕过现有流程直接 POST。BI 使用已建模读模型，不生成任意 SQL 或业务指标。

私有历史按账号、租户、助手隔离，通过修订校验和原子写入避免并发覆盖。未完成的工具调用不作为已完成历史恢复；结果未知的写操作在恢复会话后仍需用户检查业务结果并明确允许重试。默认文件存储适用于单进程服务；多副本持久化、历史保留策略、助手配置管理、完整执行审计和业务完成条件绑定仍需进一步完善。

## 校验与执行边界

建模错误现在直接进入编辑器语义诊断，不必等到导出：只读助手绑定命令、未知引用、重复助手和未知策略均提示错误。导出复用同一校验规则。

生成器保留手写配置的同时重新验证，即使 `enabled: false` 也不接受已被模型撤销的工具。能力标识采用 `Context.Element`，调整 slice 位置不会改变其身份。参数清单按真实导出字段排除技术字段、派生字段、自动编号及端口输出。

命令执行采用准备、确认、提交三步。确认针对转换后的最终参数，绑定账号、租户、配置、表单实例及修订，过期或发生变化后必须重新准备。确认只能由可信交互触发，不能注册为模型可以自行调用的工具。后端仍执行权限、状态、eligible 等业务校验。

执行结果区分 accepted、completed、rejected、unknown：HTTP 成功只代表接受命令，异步业务完成需要真实完成条件。网络异常不自动重试写操作；提交成功后 afterSubmit 失败也不当成业务拒绝。执行协调器只保证当前实例内同一提案不会重复提交，不替代服务端幂等和审计持久化。
