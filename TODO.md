# TODO List

## issues

- 所有字段要有来源，ui、生成等
  - 状态已处理，其它字段 command、event、ui 除生成外一一对应，
- state 语法支持多字段，默认 state DONE,支持多个 state trustState NO
- specification throw exception
- [x] 字段可为空标识
  - 已有- 类型后加?
- [x] 自定义字段类型-嵌套子类
- [x] 数组字段类型
- ast 自定义业务逻辑表达，描述根据命令计算出事件信息? 命令输入后业务逻辑,留个占位函数？GWT 测试驱动？AI写？
- [x] 性能优化，现在运行项目后设备卡顿,dsl稍长后就会变卡
- 样例数据
- [x] hotspot 作用
- [x] 要做一个 agent ，了解 DSL 后调用大模型回答问题
- [x] INTERNAL EXTERNAL 表达调用外部系统或方法
- [x] DSL 支持加备注
- [x] FL 业务 - feature schema 与 dataset 是否是一个聚合
- [x] policy?
  - 事件自动触发
- [x] 完善 Automation
  - policy 补充场景
  - 基于读模型等，判断满足条件后处罚
- [x] Training Round 缺少调用 EdgeRuntime 训练 slice
- [x] Training Round 多轮？
- [x] 数据集应包含训练集与评估集
- [x] 语法校验
- [ ] 字段完整性校验
- [ ] 版本管理
- [x] 导出图片
- [ ] 条件表达式，找已有的表达式
- [x] 生成器统一归类叫 Generators
- [x] Word Generator 产品
- [ ] Agentic
  - [x] medol
  - code generator
- [ ] 支持按 Context 拆分成多个文件，index 文件引用
- [x] ReadModel 添加 list 标识
- [ ] 转 config.json 时删除不需要的 context
- [ ] 汉化？设计时只能使用英文？，生成代码等等时 AI 翻译添加国际化，统一做一次国际化，后续各种生成用同一术语，支持人工调整
- [x] 前端布局预览，不关系具体字段，能展示布局与命令
- [x] Canvas 现在对 context 展示应放在 Domain Map 中，调整 canvas 交互，设计时应聚焦整个 context
- [ ] 页面查询条件怎么表达
  - [ ] 仿照 jhipster 支持多字段查询
  - [ ] supabase 支持？
  - [ ] View toolbar 支持字段顺序调整，用户可控制列表列展示顺序
- [ ] 在生成代码中抛出设计中的 specification 提示信息
- [ ] 读模型更新状态字段怎么对照
- [ ] 版本管理
- [ ] 代码生成添加镜像打包快捷入口
- [ ] 业务系统完善
  - [ ] 页面关联信息名称展示
  - [ ] tags 逻辑丢失
  - [ ] 尽快稳定版本，实现 federation learning 代码细节
- [ ] 网关轻量方案
  - [ ] 集成 APISIX
- [x] 非核心冗余字段怎么处理， xxxName
  - projector 中主动查询相关 readmodel
- [ ] UI 端生成对接设计工具 Figma/v0 等
  - [ ] 交由 Code Agent 基于 medol 建模做设计，综合考虑整体系统
- [ ] 前端 Blueprint / Extension / Override 建模支持
  - [x] code generator 已先输出 `EXTENSIONS.md` 与 typed composition 骨架，区分 generated input、developer-owned custom composition/overrides/extensions，以及 runtime 消费的 resolved composition。
  - [ ] MEDOL/codegen model 输出 frontend application、resource、command、field 对应的扩展点元数据
  - [x] code generator 已为 resource page、toolbar、row action、field renderer、menu icon、header action、form behavior 定义并接入 typed extension point
  - [ ] 支持生成 override manifest / docs，说明默认 fallback、override key、类型签名、稳定手写路径
  - [ ] 后续支持 blueprint 自定义：业务可替换局部页面组合能力，而不是只能整页 override
- [ ] ai 生成用户旅程，再结合文生视频工具，生成系统使用引导视频
- [x] 建模中的 Ref 到底填什么，用户怎么能知道怎么填
- [x] 代码生成时，对 automation 前端不需要生成命令入口
- [ ] 前端页面菜单优化，菜单名称长时无法看清具体菜单，交互有问题
- [ ] Axon Framework 5 的生成没有 slice 选择了
- [ ] Axon5 接入 MetaData 注入，并在 readmodel 中统自动生成命令执行人，执行时间
- [ ] 前端 Logo 处 Refine 显示换成项目名称 ，菜单 icon 怎么处理， 右上角 icon 颜色图标调整，自定义明亮配色
- [ ] 代码生成后覆盖问题：decision 等大概率需要调整部分，同过实现类区分，默认脚手架生成实现类，业务完善（agent、人工）建新的实现类
- [ ] 生成模拟数据部分，再进一步调整完善，需要快速提供测试数据，需要 ai 提供思路
- [ ] 外部系统对接，建模中缺少外部系统声明
- [x] Event Strore(DCB) 解决方案
  - [x] 适配 Umadb
  - [ ] Umadb 管理平台
- [ ] Review fl 建模
  - [ ] 所有 command event 不需要显示包含 xxcommandAt xxcommandBy
  - [ ] 本身 ID 不需要 tags 再加
  - [ ] 命令有 ID ，不需要有外关联字段
- [ ] 对 MEDOL 进行建模，梳理需求
- [ ] 完整系统建模 medol 文件会比较长，工程上怎么优化
- [ ] 优化国际化在系统端的生成，code generator 中添加命令，可以实时添加或修改对应语言的国际化文件
  - [ ] 后端国际化（异常信息等）
- [ ] 生成代码格式化
- [ ] Event 信息冗余与版本话怎么选
- [ ] 完善 Automation 实现层面设计
- [ ] 一个 slice 可能多事件的状态处理
- [ ] 建模怎么表达对一批数据做同一件事
- [ ] 跨上下文事件交互- Automation
- [ ] fl 补充模型血缘建模 lineage
- [ ] 平台与 Runtime Agent mTLS
- [ ] umadb 投影 projector 慢
- [ ] 提交成功提示信息优化
- [ ] 值对象展示 - feature schema
- [ ] 跨部署单元的事件依赖
  - [ ] 事件发起方监听调用监听方自定义事件接口
- [ ] readmodel 更新时机，现在是有事件就会落库，是否需要控制主要事件更新才落库。如： RuntimeDatasetBindingCatalog， RuntimeDatasetBindingConfigured 后才是有用信息，现在声明 dataset 后就有数据
- [ ] Sync outbox / readmodel delta 数据清理策略
  - [ ] 当前 outbox 表已有队列式 `purgeProcessedBefore`，但 readmodel delta 同步按 sequence/checkpoint 消费，不会天然把每条记录标记为 PROCESSED，长期运行会持续增长。
  - [ ] 需要设计通用清理语义：短期支持按 TTL 清理过期 delta；长期支持按 channel/consumer checkpoint 水位判断，只有所有消费者都推进后才清理对应 readmodel delta。
  - [ ] 清理任务应作为生成的通用 infrastructure 能力配置化开启，不能写入具体业务系统规则。
- [ ] Read model 字段长度根据名字推断为 text，添加 text 类型或者指定长度
- [ ] Read model projector 里根据字段名推断失败状态和失败原因
  - 保留“直接同名字段赋值”和“stateChange 明确状态赋值”，去掉 failureReason / FailedAt / failed state 的名字猜测。以后如果需要自动生成，应在建模里显式表达事件到 read model 字段的映射或 projection rule。
- [ ] Automation 中命令是否要携带关键信息，供 adapter 使用，解决查询投影的异步问题或者应该依赖 TODO list 触发
- [ ] 生成软著材料
- [ ] 测试完善文档生成翻译等功能
- [ ] 是否所有 port 都有成功失败两种 Event，针对某些失败要考虑技术上的重试，最终失败才抛出业务异常走人工补偿
- [ ] 状态生成与更新逻辑梳理调试
- [ ] medo 一直显示 saving
- [ ] 事件处理结果要能看到，包括成功与失败，
  - [ ] 设计交互 UI，展示进度？
- [ ] Event 应该包含后续消费、审计、投影和重放需要的完整关联信息。
  - [ ] 用户提交 command 中指定 id， handler 从对应 state 中获取相关信息
  - [ ] automation 复制信息
- [ ] 前端按钮只有中间生效
- [ ] 怎么调试排查问题
- [ ] 服务间调用失败重试、发现机制
- [ ] decision 内注入多 concept state 逻辑怎么没了？
  - 重要，要处理这种逻辑，另外印象中改过怎么丢了
- [ ] 控制异常堆栈打印行数生成模板中， exception-conversion-word: "%ex{10}"
- [ ] 优化 ai agent 使用，减少 token 消耗，固定的问题整理 skill
- [ ] 生成分页查询默认按时间排序
- [ ] 多状态
- [ ] 基于 medol 参考 https://github.com/hexclave/hexclave 设计一套 user infrastructure
- [ ] 什么时候用枚举，什么时候用字典， OrganizationType 怎么处理
- [ ] 状态值国际化
- [ ] 时区
- [ ] PostgreSQL 表名超过 63 字节被截断后撞名。处理表名过长问题
- [ ] 扩展 umadb，查询事件执行情况
- [ ] 测试重启，过于繁琐，麻烦。要加强 medol 能力，最好能直接校验状态等建模可获取信息。除了语法校验业务逻辑。fl 建模现在并没有体现优越性，还是在测试改建模
- [ ] IAM service account 长期 token 失效策略：当前设计不做 token 过期和 revoke，权限变更后重新生成 token；如果认证时完全不查询用户状态，禁用 service account 不会让已签发 token 失效。后续需要决定是否用短 TTL 用户状态缓存、全局签名密钥轮换，或明确接受禁用用户只影响后续签发/登录。
- [ ] 数据权限控制

##

- [ ] FL
  - [ ] Runtime Agent / 参与方 Console 隐私与数据面访问边界需要重新设计：参与方数据不能因为平台 IAM 管理员给用户分配了 organization 或 runtime agent 相关权限就被访问。平台权限只能控制平台侧对象与摘要视图；参与方 Console 应由参与方本地部署和本地身份/凭证控制，Runtime Agent 不应信任普通平台用户 JWT，也不应暴露通用数据查询能力给平台前端。平台到 Runtime Agent 的机器调用必须限定为协议内窄接口、窄 scope，例如心跳、状态上报、训练任务派发、受控结果回传，避免参与方数据泄漏。
  - [ ] 单轮训练失败重试策略完善，平台侧发起
  - [ ] Organization Directory 创建时间
  - [ ] Register Runtime Infrastructure Package 字段信息明确
  - [ ] 安装上传、下载功能
  - [ ] Register Runtime Infrastructure 没有额外字段，只需要一下确认弹框就行，不用跳到 form 页
  - [ ] 定义 port 但未实现的，生成代码时附带 占位代码，阻止业务进行
  - [ ] Register Runtime Infrastructure 不允许重复提交，非新增， axon 怎么控制
  - [ ] install plan 不必要有这么多信息
  - [ ] register runtijme infa 失败后的重试按钮在哪呢
  - [ ] Create Runtime Installation Plan 中 expected node count 不对，这个是指什么数量，有什么意义
  - [ ] 手动部署 agent ，runtime id 怎么来，现在手动和自动部署选项没生效
  - [ ] Runtime infrastructure access views 下的 register runtime infastructure 有问题
  - [ ] Profile AgentDataset 建模完善加 spec，生成 port
  - [ ] ValidateDatasetContract 又是什么，与ValidateAgentDatasetAccess 区别
  - [ ] 参考 FedML
    - https://chatgpt.com/g/g-p-6966527cb3b4819184dfea9640b8124c-what-is-it/c/6a69caf2-7c78-83ec-bcf3-77529fbd175e
  - [ ] 重新设计思考 Agent 手动部署逻辑
    - [ ] 补全 ReportRuntimeInstanceSelfCheckPassed 建模
  - [ ] 项目启动有时会报错 mvn <args> -rf :shared-kernel
  - [ ] 数据集绑定之后重新触发验证
    - [ ] 绑定数据集数量？
  - [ ] 多次启动 load 后 runtime id 出现了多个
  - [ ] 现在看日志一个命令、事件处理了多次，确认是否有问题
  - [ ] data binding ContractValidationFailed 怎么重新执行
  - [ ] runtime agent 注册需要维护 endpoint，平台侧才可以识别具体调用端口
  - [ ] load runtime agent bootstrap configuration 失败后用户看不到任何信息
  - [ ] Register Runtime Infrastructure 不对，要指定具体的 plan 进行 register
  - [ ] Define Training Run Configuration 里 initial model version id
  - [ ] StartRoundWhenParticipantsSelectedProcessor 业务逻辑不满足，没有地方能查看
  - [ ] 一个 feature 多个 dataset
  - [ ] 任务失败，需要重新发起功能
  - [ ] 现派发任务 runtime agent ip 读取配置文件，这里逻辑要调整动态获取 id
  - [ ] GeneratePlanForSelectedRuntimeProcessor 应该循环节点分别发送？现在 runtime id 等信息没有正确传递，建模上应该怎么处理
        循环发送多个事件还是怎么办。
  - [ ] 梳理 adapter 与 domain decision 边界：当前部分 adapter 过重，典型例子是 `ReadModelTrainingRoundParticipantSelectionAdapter`，里面包含 joined member 为空、active runtime、dataset metadata compatible、组织/runtime 匹配、distinct、quorum 等判断。长期应调整为：
    - adapter 只做 read model / 外部系统查询、基础技术过滤、数据快照组装、技术不可用返回。
    - domain decision component 承载业务规则：参与方选择策略、quorum、每组织/每 runtime 选择规则、失败事件选择、重试策略。
    - 建模上把 `SelectTrainingRoundParticipantsService` 这类“做业务选择”的 port 降级为 `LoadTrainingRoundParticipantSelectionSnapshot` 这类查询型 port，事件仍记录完整 selected participant snapshot。
    - 生成器后续应支持这类 snapshot port + decision policy 的默认结构，避免业务规则沉入 infrastructure adapter。
  - [ ] MEDOL 建模需要表达 decision 依赖的业务事实与判断规则：adapter 中现有的业务判断迁移到 decision 前，模型中应能看出 command decision 依赖哪些 state / read model snapshot / port result、成功失败分别产生什么 event、哪些字段来自 command/state/触发事件。不要在模型中表达 SQL/join 等技术查询细节，但不能让 adapter 成为业务规则唯一来源。
  - [ ] 完成 cancel pause job 等流程
  - [ ] federation learning 使用 https://github.com/hexclave/hexclave 做身份与认证管理等基础框架
  - [ ] training run configuration 添加 display name
    - [ ] 需重新设计，算法工程师动态配置对应参数，不同算法参数不一样
  - [ ] submit taining job 切换成 dialog
    - [ ] submit 加校验，不能重复提交
  - [ ] 字典改为中文
  - [ ] 组织状态流程，激活没有作用
  - [ ] 运行时基础设施包，是否直接放字典中就可以


## TODO: Refine Generator UI Type Adaptation

当前 MEDOL 已支持 `ui <ScreenName> <type>` 建模，其中 `type` 包括 `list`、`detail`、`form`、`dialog`、`drawer`、`confirm`、`wizard`、`inline`、`background`。但 Refine generator 目前主要根据 `readmodel []` 和 command 生成资源、路由和表单页，尚未完整消费 `slice.screens[].ui.type`。

后续需要补全：

1. 在 Refine model builder 中解析 slice screen 与 command 的关系，将 `uiName`、`uiType` 写入 command/resource metadata。
2. 保持现有 `form` 类型默认生成路由表单页。
3. `dialog` 类型 command 由行按钮或创建按钮打开 Dialog 表单，而不是跳转页面。
4. `drawer` 类型 command 使用 Drawer/Sheet 承载表单。
5. `confirm` 类型 command 使用 AlertDialog 进行二次确认，必要时支持轻量输入字段。
6. `wizard` 类型 command 支持分步表单渲染，可先基于字段分组或后续 DSL 元数据扩展。
7. `inline` 类型 command 支持表格行内编辑或局部表单提交。
8. `background` 类型 command 不生成用户表单入口，只作为自动化/后台流程元数据保留。
9. 路由、resources metadata、CommandButton、command form 模板和 i18n messages 需要统一适配。
10. 补充 generator 单测，覆盖 `dialog/drawer/confirm/form` 的生成结果，避免 UI 类型退化成普通路由页。

# TODO：优化前端生成展示字段策略

## 目标

避免生成后的列表页、详情页、选择器主要展示 `xxxId`，让业务用户优先看到名称、状态、类型、时间、数量等可读信息。

## 任务

- [ ] 补充建模规范：每个 `readmodel` 应至少有一个业务可读字段标记为 `display`
- [ ] 扫描 `federation-learning.medol`，为缺少业务展示字段的 `readmodel` 补充 `display` 字段
- [ ] 对只有外键 ID 的 `readmodel`，补充派生展示字段，例如 `organizationName`、`federationName`、`datasetName`
- [ ] Refine generator 增加 `displayField` 识别逻辑
- [ ] `displayField` 优先级：
  - `field.display`
  - `name` / `title` / `label` / `displayName`
  - `*Name` / `*Code` / `*Version`
  - `idField`
- [ ] 列表页默认列排序：
  - `displayField` 第一
  - 状态、类型、核心业务字段靠前
  - `xxxId` 默认靠后或隐藏
- [ ] 详情页标题改为 `record[displayField] ?? record[idField]`
- [ ] 资源选择器 label 使用 `displayField`，value 保持 `idField`
- [ ] 字典字段列表展示字典 `displayName`，提交时仍保存 `valueCode`
- [ ] 给 federation-learning 生成结果增加回归检查，确保典型页面不再以 ID 作为主要展示信息

##

建议 DSL 使用时遵守：

一个 aggregate 内的 state slices，应该共享同一个聚合身份与生命周期。

也就是同一 aggregate 里的主要 command/event 应该大致围绕同一主键：


## 内置能力扩展方向（2026-11-17）

- [ ] 外部接口对接管理：外部系统、操作契约、连接测试、调用/回调记录与补偿。
- [ ] 系统问题反馈与工单：提报、分派、处理、确认关闭和重新打开。
- [ ] 打印：复用报表和文档生成，补模板设计、批量任务及按需设备投递。
- [ ] 系统知识与 Agent：自动维护 MEDOL 业务/能力知识，支持人工补充、运行经验积累、授权问答和受控操作。
- [ ] **Medol AI-Native Business Application**：为生成的业务系统集成 AI Capability Generator、Agent Runtime 和 Human-Agent Collaboration，使 AI 理解业务语义、感知页面与业务状态，并通过自然语言完成多步骤业务任务；后续支持 A2UI、WebMCP 和 Browser Agent。目标是让系统不仅可供用户操作，也能被 AI 理解、操作和协同使用。

详细边界、生成与运行时职责、实施阶段统一维护在 [内置上下文 TODO：候选能力](docs/builtin-contexts/TODO.md#候选内置能力2026-11-17)。以上为待设计/实现项，不代表已提供对应 import 或运行能力。

## 建模与生成代码质量控制（2026-11-19）

目标：slice 是实现单位，不是正确性边界。建立 slice、跨 slice 业务旅程和系统运行三层验证，让遗漏可发现、未验证部分可见、发布有证据，而不依赖 AI 自行考虑周全。以下均为待实现能力。

### 跨 slice 契约诊断

- [ ] **QUALITY-CONTRACT-01**：在字段来源追踪基础上建立生产者/消费者契约图，检查触发事件、command、state、port result、下游事件和投影之间的数据完整性、类型与标识一致性；事件应提供下游消费和重放所需快照，关键字段不能用随机 ID 或空值掩盖缺失。
- [ ] **QUALITY-CONTRACT-02**：检查状态可达性、命令前置条件与触发路径冲突、并发分支对同一生命周期的影响；检查自动化循环的终止条件、等待退出条件及失败后的恢复路径。
- [ ] **QUALITY-CONTRACT-03**：诊断事件触发后立即依赖异步投影的时序风险；要求明确一致性假设、数据来源及投影未就绪时的行为，不将“事件已发生”等同于“投影已更新”。
- [ ] **QUALITY-CONTRACT-04**：检查重复消费、重试与外部副作用契约，区分明确失败、超时和结果未知；明确幂等标识、去重边界、补偿或对账责任。
- [ ] **QUALITY-CONTRACT-05**：检查后台流程的用户可见闭环：受理、执行中、成功、失败原因及恢复入口。对需要等待、取消或人工处理的流程给出显式诊断。
- [ ] **QUALITY-CONTRACT-06**：基于明确语义输出可定位的错误/风险诊断；可证明的冲突阻断，无法证明的假设要求说明或复核，不按字段名猜测业务规则。优先复用现有语义，仅对影响生成或验证且无法表达的契约评估 DSL 扩展。

### 业务旅程验收

- [ ] **QUALITY-JOURNEY-01**：在 slice spec 之外设计跨 slice 旅程场景，描述用户目标、前置数据、关键事实、最终结果和业务不变量；避免绑定每一步内部实现或精确执行时序。
- [ ] **QUALITY-JOURNEY-02**：覆盖正常完成、无可用资源后恢复、下游不可用、结果未知、重复事件、投影延迟、进程重启、取消和人工重试。验证用户能感知状态并采取下一步操作。
- [ ] **QUALITY-JOURNEY-03**：业务预期需独立确认，不完全从被测生成逻辑推导；防止生成器与自动生成测试共同复制同一错误。先选一条真实业务旅程，将历史故障固化为可重复执行的回归场景，再提炼通用能力。
- [ ] **QUALITY-JOURNEY-04**：补真实数据库/事件存储及跨部署验证，覆盖追加、订阅、重放、并发、服务鉴权、序列化契约、调用成功但回执丢失；端到端验证前端展示的受理与业务完成不混淆。Mock 单测不能替代这些边界测试。
- [ ] **QUALITY-JOURNEY-05**：在 Medol 工作区导航中提供与建模编辑器并列的「旅程验收」独立入口和页面，不复用建模编辑区或画布。页面提供用例列表、编辑、参数组和执行记录；可选择模型版本、只读引用模型元素，并按需跳回相关 slice。用例通过 Given / When / Then 分组编写，作为工作区制品随模型版本管理，不写进业务 `.medol` 源码，不修改既有 slice spec 语义，不新增 DSL，也不要求作者手写脚本或执行计划。
- [ ] **QUALITY-JOURNEY-06**：结合 [Tosca 模块化步骤](https://docs.tricentis.com/tosca-cloud/en-us/content/create_tests/design_modules.htm)、[FitNesse 查询预期表](https://fitnesse.org/FitNesse/UserGuide/WritingAcceptanceTests/SliM.html) 和[数据驱动用例](https://robotframework.org/RobotDemo/)：从模型选择 command、readmodel 和字段，用类型化绑定引用前序输出；在预期表配置记录定位、数量和跨记录字段比较；同一验收规则复用不同参数组，预期不同则另写用例。业务预期由人工声明，不从被测模型推导。
- [ ] **QUALITY-JOURNEY-07**：校验用例引用的模型元素、字段、参数类型及断言所需的可观察性，定位到对应步骤和 slice。生成 Simulation 时，将同版模型和用例结合目标生成器的接口契约，转换为现有执行计划。记录源用例 ID 和模型版本；模型校验通过不等于运行验收通过。Simulation 可补充手工特殊用例，通过模型元素 ID 关联覆盖范围，标明来源，重新生成不覆盖。
- [ ] **QUALITY-JOURNEY-08**：以两轮训练为首个端到端验收：在 Medol 界面定位平台第一轮聚合记录和每个参与方的第二轮有效执行记录，断言两侧模型 ID 非空且 `RoundExecutionCatalog.baseModelId` 等于 `TrainingRoundProgress.aggregatedModelId`。先验证 2 节点参数组，再用同一预期复用 20 节点参数组；错误模型反例须定位节点、轮次、实际与预期 ID。执行和报告细节见 Simulation TODO。
- [ ] **QUALITY-JOURNEY-09**：在「旅程验收」独立页面支持从选定模型版本同步候选用例，人工不必从空表开始。不从测试代码或脚本反推：仅基于模型显式声明的命令、事件、自动化关系、字段映射和已有 slice spec，带入可确定的操作、输入绑定及候选观察点；自动化命令由被测系统执行，不生成额外调用。需要真实准备数据、跨 slice 验收预期、跨记录断言或等待期限时，明确标为待补充，不把 Given 历史事件当作造数步骤。草稿保留来源元素 ID 和模型版本，经人工补齐并审核后才能生成执行计划；再次同步时展示变更与失效引用，不覆盖人工维护的步骤和预期。
- [ ] **QUALITY-JOURNEY-10**：人工通过界面，AI 通过授权工具，均可查找、选择和调用同一个已审核用例。调用时指定用例版本、参数组和目标环境，复用统一校验、权限、执行和报告；有副作用的用例按环境策略确认。AI 可以提议创建或调整草稿，但不能绕过审核、临时改变断言，或把自行生成的脚本当作已审核用例运行。

### 生成代码质量门禁

- [ ] **QUALITY-GATE-01**：生成实现清单，区分“已生成并验证”“需人工实现”“缺少建模信息”“不支持的组合”，关联模型元素、生成产物、扩展点及验证证据。仅生成了代码不能标记为已验证。
- [ ] **QUALITY-GATE-02**：建立可机器检查的占位/实现状态，识别空 decision、缺失 adapter、占位返回和关键业务 TODO。开发可生成不完整骨架，发布必须阻止未完成的必需能力；不以编译成功代替业务实现完成。
- [ ] **QUALITY-GATE-03**：重新生成后检查手写 domain/infrastructure 扩展与新契约兼容性，验证干净生成、编译、测试及支持的部署组合；框架修复落入生成器，不以手改生成 context 通过门禁。
- [ ] **QUALITY-GATE-04**：定义分层门禁：模型诊断、生成契约、编译与静态检查、slice 测试、旅程测试、实际运行边界验证。报告区分通过、失败、未运行和不适用，保留模型/生成器版本及测试证据；关键未验证项不得隐式当成通过。
- [ ] **QUALITY-GATE-05**：每次变更提供影响清单：变更的模型与契约、受影响生产者/消费者/投影/手写扩展/页面、已验证场景和剩余风险。独立 AI 审查仅辅助发现问题，不替代测试证据及业务人员对规则的确认。

实施顺序：先建立跨 slice 契约图与诊断，再打通一条真实旅程验收，随后将实现清单和验证证据接入生成/CI 发布门禁。通用检查保持业务无关，具体系统场景留在对应模型与测试中。

## mind

- 建模人工参与 ai 辅助，生成器具体实现等注册为 skill tool 等，借助 ai 进一步实现更自动化、智能化的代码生成。生成后 ai 逐 slice 进行完善。
