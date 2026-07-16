# TODO List

## issues

- 所有字段要有来源，ui、生成等
  - 状态已处理，其它字段 command、event、ui 除生成外一一对应，
- state 语法支持多字段，默认 state DONE,支持多个 state trustState NO
- specification throw exception
- [x] 字段可为空标识
  - 已有- 类型后加?
- [X]自定义字段类型-嵌套子类
- [X]数组字段类型
- ast 自定义业务逻辑表达，描述根据命令计算出事件信息? 命令输入后业务逻辑,留个占位函数？GWT 测试驱动？AI写？
- [X]性能优化，现在运行项目后设备卡顿,dsl稍长后就会变卡
- 样例数据
- [X]hotspot 作用
- [X]要做一个 agent ，了解 DSL 后调用大模型回答问题
- [x] INTERNAL EXTERNAL 表达调用外部系统或方法
- [X]DSL 支持加备注
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
- [X] 非核心冗余字段怎么处理， xxxName
  - projector 中主动查询相关 readmodel
- [ ] UI 端生成对接设计工具 Figma/v0 等
  - [ ] 交由 Code Agent 基于 medol 建模做设计，综合考虑整体系统
- [ ] ai 生成用户旅程，再结合文生视频工具，生成系统使用引导视频
- [ ] 建模中的 Ref 到底填什么，用户怎么能知道怎么填
- [X] 代码生成时，对 automation 前端不需要生成命令入口
- [ ] 前端页面菜单优化，菜单名称长时无法看清具体菜单，交互有问题
- [ ] Axon Framework 5 的生成没有 slice 选择了
- [ ] Axon5 接入 MetaData 注入，并在 readmodel 中统自动生成命令执行人，执行时间
- [ ] 前端 Logo 处 Refine 显示换成项目名称 ，菜单 icon 怎么处理， 右上角 icon 颜色图标调整，自定义明亮配色
- [ ] 代码生成后覆盖问题：decision 等大概率需要调整部分，同过实现类区分，默认脚手架生成实现类，业务完善（agent、人工）建新的实现类
- [ ] 生成模拟数据部分，再进一步调整完善，需要快速提供测试数据，需要 ai 提供思路
- [ ] 外部系统对接，建模中缺少外部系统声明
- [ ] Event Strore(DCB) 解决方案
  - [ ]  适配 Umadb
- [ ] Review fl 建模
  - [ ] 所有 command event 不需要显示包含 xxcommandAt xxcommandBy
  - [ ] 本身 ID 不需要 tags 再加
  - [ ] 命令有 ID ，不需要有外关联字段
- [ ] 对 MEDOL 进行建模，梳理需求
- [ ] 完整系统建模 medol 文件会比较长，工程上怎么优化
- [ ] 优化国际化在系统端的生成，code generator 中添加命令，可以实时添加或修改对应语言的国际化文件
  - [ ] 后端国际化（异常信息等）
- [ ] 生成代码格式化

##

建议 DSL 使用时遵守：

一个 aggregate 内的 state slices，应该共享同一个聚合身份与生命周期。

也就是同一 aggregate 里的主要 command/event 应该大致围绕同一主键：

