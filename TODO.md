# TODO List

## issues

- 所有字段要有来源，ui、生成等
  - 状态已处理，其它字段 command、event、ui 除生成外一一对应，
- state 语法支持多字段，默认 state DONE,支持多个 state trustState NO
- specification throw exception
- [x] 字段可为空标识
  - 已有- 类型后加?
- 自定义字段类型-嵌套子类
- 数组字段类型
- ast 自定义业务逻辑表达，描述根据命令计算出事件信息? 命令输入后业务逻辑,留个占位函数？GWT 测试驱动？AI写？
- 性能优化，现在运行项目后设备卡顿,dsl稍长后就会变卡
- 样例数据
- hotspot 作用
- 要做一个 agent ，了解 DSL 后调用大模型回答问题
- [x] INTERNAL EXTERNAL 表达调用外部系统或方法
- DSL 支持加备注
- [x] FL 业务 - feature schema 与 dataset 是否是一个聚合
- [x] policy?
  - 事件自动触发
- [x] 完善 Automation
  - policy 补充场景
  - 基于读模型等，判断满足条件后处罚
- [x] Training Round 缺少调用 EdgeRuntime 训练 slice
- [x] Training Round 多轮？
- [x] 数据集应包含训练集与评估集
- [ ] 语法校验
- [ ] 字段完整性校验
- [ ] 版本管理
- [ ] 导出图片
- [ ] 条件表达式，找已有的表达式
- [X] 生成器统一归类叫 Generators
- [ ] Word Generator 产品

##

建议 DSL 使用时遵守：

一个 aggregate 内的 state slices，应该共享同一个聚合身份与生命周期。

也就是同一 aggregate 里的主要 command/event 应该大致围绕同一主键：
