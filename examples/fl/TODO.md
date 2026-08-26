# Federation Modeling Issues

## Create Runtime Installation Plan

- Orchestrator Version 不用户输入？谁知道是什么
- Orchestrator Type 只保留 K3S
- Archetecture 提供下拉选择
- Node Labels 是什么
- OrchestratorType k3s 后端枚举怎么生成了个 K3_S
- [ ] Issue Runtime Bootstrap Token 前端选择时间的，提示 Invalid datetime，先处理
- [ ] Metadata 必须每个 command handler 单独配置？
- [ ] list 页面添加“查询”或者“刷新”按钮
- [ ] 多系统菜单是按现在加下拉还是在左侧菜单再加一个分类
- [ ] Issue Runtime Bootstrap Token network profile id runtime install plan id 没有显示名称
- [ ] Docker compose 做调度器
    - [ ] 本机 docker compose 运行 fl
- [ ] 适配开发环境，注册完不走调度平台直接交互
- [ ] 安装 k3s
- [ ] umadb
    - [ ] Projector 没有执行，没有更新 readmodel

## Runtime Agent Endpoint Access

- [ ] 前端只部署一套时，runtime agent 后端不能继续使用构建期静态 `apiUrl`。
- [ ] 平台侧通过 `RuntimeAgentEndpointCatalog` 维护每个 `runtimeAgentId` / `organizationId` 的可访问 endpoint。
- [ ] 前端访问 runtime-agent 模块时按当前用户、组织、runtimeId 动态解析 endpoint。
- [ ] endpoint scope 需要区分参与方浏览器本地可达、局域网可达、平台代理转发等模式。
- [ ] runtime agent 需要支持 central console origin 的 CORS 与平台签发/校验的短期访问凭证。
- [ ] 生成器层面只提供 dynamic endpoint/dataProvider 扩展点，不写入 federation-learning 具体业务查询逻辑。



## Dictionary 

当前 [federation-learning.medol] 里，`RuntimeOnboarding` 相关动态字典项包括：

| dictionaryCode | 使用次数 | 用途字段 |
| --- | ---: | --- |
| `RUNTIME_ENVIRONMENT_TYPE` | 5 | `runtimeEnvironmentType` |
| `RUNTIME_AGENT_INSTALL_MODE` | 9 | `agentInstallMode` |
| `RUNTIME_AGENT_ENDPOINT_SCOPE` | 5 | `endpointScope` |

这些字段集中在：

- `CreateRuntimeInstallationPlan`
- `IssueRuntimeBootstrapConfig`
- `RuntimeInstallationPlanCatalog`
- `RuntimeBootstrapRequestCatalog`
- `RegisterRuntimeInfrastructure`
- `RuntimeInfrastructureAccessView`

当前模型只声明了这些字典 code 的使用位置，没有在 `.medol` 里定义具体 `valueCode/displayName` 预置值。具体值需要通过 `DictionaryMaintenance` 的命令维护：

- `RegisterDictionary`
- `AddDictionaryValue`
- `DisableDictionaryValue`
- `EnableDictionaryValue`

字典值读模型是 `DictionaryValueCatalog`，其 provider 映射是：

```text
code  = dictionaryCode
value = valueCode
label = displayName
active = active
state = state
order = displayOrder
```

另外，静态枚举不是动态字典；当前文件里还定义了一个 enum：

```text
OrganizationType:
- HOSPITAL
- RESEARCH_INSTITUTE
- PUBLIC_HEALTH_AGENCY
- LABORATORY
- REHABILITATION_CENTER
```
