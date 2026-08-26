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

##

- [ ] FL
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
  -

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
