# 联邦学习平台（Federation Learning Platform） 产品需求文档

<!-- em:section id="prd.section.overview" -->
## 文档目的

本文档整理产品功能、CRUD 操作、页面入口、业务结果，用于产品评审、研发对齐、测试用例设计。

**建模范围:** 联邦管理（Federation Management）, 数据集治理（Dataset Governance）, 训练编排（Training Orchestration）, 模型生命周期（Model Lifecycle）, 运行时运维（Runtime Operations）, 密钥与认证管理（Key And Attestation Management）

### 业务说明

- 联邦管理负责组织、联邦和受信计算节点。
- 数据集治理将架构、数据集资产、运行时访问配置和训练评估包分离。
- 训练编排负责任务意图以及每轮分布式训练与评估。
- 模型生命周期在训练产出最终评估候选之后开始。
- 运行时运维将心跳监控、训练告警和仅追加审计记录分离。
- 密钥与认证管理负责节点认证报告、安全聚合密钥材料和数据集访问凭证，取代散落在其他上下文中的临时加密字段。

<!-- em:section id="prd.section.scope" -->
## 产品范围与角色

**核心业务对象:** 联邦（Federation）, 计算节点（Compute Node）, 特征架构（Feature Schema）, 数据集（Dataset）, 数据集访问配置（Dataset Access Profile）, 训练评估数据集包（Training Evaluation Dataset Bundle）, 训练运行配置（Training Run Configuration）, 训练任务（Training Job）, 训练轮次（Training Round）, 模型版本（Model Version）, 节点运行时健康（Node Runtime Health）, 训练告警（Training Alert）, 审计记录（Audit Record）, 节点加密密钥（Node Encryption Key）, 节点认证报告（Node Attestation Report）, 安全聚合密钥（Secure Aggregation Key）, 安全聚合轮次（Secure Aggregation Round）, 数据集访问凭证（Dataset Access Credential）

**参与角色:** 组织管理员（Organization Admin）, 合规官（Compliance Officer）, 平台管理员（Platform Admin）, 联邦所有者（Federation Owner）, 治理审查员（Governance Reviewer）, 节点操作员（Node Operator）, 安全审查员（Security Reviewer）, 数据管理员（Data Steward）, 数据所有者（Data Owner）, MLOps 工程师（MLOps Engineer）, 研究负责人（Research Lead）, 边缘运行时（Edge Runtime）, 发布管理员（Release Manager）, 安全聚合服务（Secure Aggregation Service）

<!-- em:section id="prd.section.featureInventory" -->
## 功能与 CRUD 清单

| 业务域 | 业务对象 | 功能 | 操作类型 | 页面/入口 | 执行角色 | 业务结果 |
| --- | --- | --- | --- | --- | --- | --- |
| 联邦管理（Federation Management） | 联邦（Federation） | 创建联邦（Create Federation） | 新增 | 联邦设置界面（Federation Setup Screen） (表单) | 平台管理员（Platform Admin） | 启动生命周期 联邦（Federation）; 产生事件 联邦已创建（Federation Created）; 状态变为 草稿（Draft） |
| 联邦管理（Federation Management） | 联邦（Federation） | 联邦概览（Federation Overview） | 查询 | 联邦概览（Federation Overview） 查询入口 | 系统/未明确 | 展示 联邦概览（Federation Overview） |
| 联邦管理（Federation Management） | 联邦（Federation） | 邀请参与者（Invite Participant） | 业务操作 | 参与者邀请界面（Participant Invitation Screen） (弹窗) | 联邦所有者（Federation Owner） | 产生事件 参与者已邀请（Participant Invited） |
| 联邦管理（Federation Management） | 联邦（Federation） | 批准参与者（Approve Participant） | 业务操作 | 成员审查界面（Membership Review Screen） (弹窗) | 治理审查员（Governance Reviewer） | 产生事件 参与者已加入（Participant Joined）; 状态变为 活跃（Active） |
| 联邦管理（Federation Management） | 联邦（Federation） | 拒绝参与者（Reject Participant） | 业务操作 | 成员审查界面（Membership Review Screen） (弹窗) | 治理审查员（Governance Reviewer） | 产生事件 参与者已拒绝（Participant Rejected） |
| 联邦管理（Federation Management） | 联邦（Federation） | 撤销参与者邀请（Revoke Participant Invitation） | 业务操作 | 参与者邀请界面（Participant Invitation Screen） (确认操作) | 联邦所有者（Federation Owner） | 产生事件 参与者邀请已撤销（Participant Invitation Revoked） |
| 联邦管理（Federation Management） | 联邦（Federation） | 暂停参与者（Suspend Participant） | 业务操作 | 成员审查界面（Membership Review Screen） (弹窗) | 治理审查员（Governance Reviewer） | 产生事件 参与者已暂停（Participant Suspended） |
| 联邦管理（Federation Management） | 联邦（Federation） | 移除参与者（Remove Participant） | 业务操作 | 成员审查界面（Membership Review Screen） (确认操作) | 治理审查员（Governance Reviewer） | 产生事件 参与者已移除（Participant Removed） |
| 联邦管理（Federation Management） | 联邦（Federation） | 联邦成员目录（Federation Membership Directory） | 查询 | 联邦成员目录（Federation Membership Directory） 查询入口 | 系统/未明确 | 展示 联邦成员目录（Federation Membership Directory） |
| 联邦管理（Federation Management） | 计算节点（Compute Node） | 注册计算节点（Register Compute Node） | 新增 | 节点注册界面（Node Registration Screen） | 节点操作员（Node Operator） | 启动生命周期 计算节点（Compute Node）; 产生事件 计算节点已注册（Compute Node Registered）; 状态变为 已注册（Registered） |
| 联邦管理（Federation Management） | 计算节点（Compute Node） | 更新节点能力（Update Node Capability） | 业务操作 | 节点能力界面（Node Capability Screen） | 节点操作员（Node Operator） | 产生事件 节点能力已更新（Node Capability Updated）; 状态变为 能力已声明（Capability Declared） |
| 联邦管理（Federation Management） | 计算节点（Compute Node） | 信任计算节点（Trust Compute Node） | 业务操作 | 节点信任界面（Node Trust Screen） | 安全审查员（Security Reviewer） | 产生事件 计算节点已信任（Compute Node Trusted）; 状态变为 已信任（Trusted） |
| 联邦管理（Federation Management） | 计算节点（Compute Node） | 暂停计算节点（Suspend Compute Node） | 业务操作 | 节点信任界面（Node Trust Screen） | 安全审查员（Security Reviewer） | 产生事件 计算节点已暂停（Compute Node Suspended）; 状态变为 已暂停（Suspended） |
| 联邦管理（Federation Management） | 计算节点（Compute Node） | 计算节点目录（Compute Node Catalog） | 查询 | 计算节点目录（Compute Node Catalog） 查询入口 | 系统/未明确 | 展示 计算节点目录（Compute Node Catalog） |
| 联邦管理（Federation Management） | Concept:组织（Organization） | 注册组织（Register Organization） | 新增 | 组织注册界面（Organization Registration Screen） | 组织管理员（Organization Admin） | 启动生命周期 Concept:组织（Organization）; 产生事件 组织已注册（Organization Registered）; 状态变为 已注册（Registered） |
| 联邦管理（Federation Management） | Concept:组织（Organization） | 验证组织身份（Verify Organization Identity） | 业务操作 | 组织验证界面（Organization Verification Screen） | 合规官（Compliance Officer） | 产生事件 组织身份已验证（Organization Identity Verified）; 状态变为 身份已验证（Identity Verified） |
| 联邦管理（Federation Management） | Concept:组织（Organization） | 激活组织（Activate Organization） | 业务操作 | 组织管理员界面（Organization Admin Screen） | 平台管理员（Platform Admin） | 产生事件 组织已激活（Organization Activated）; 状态变为 活跃（Active） |
| 联邦管理（Federation Management） | Concept:组织（Organization） | 停用组织（Deactivate Organization） | 业务操作 | 组织管理员界面（Organization Admin Screen） | 平台管理员（Platform Admin） | 产生事件 组织已停用（Organization Deactivated）; 状态变为 已停用（Deactivated） |
| 联邦管理（Federation Management） | Concept:组织（Organization） | 组织目录（Organization Directory） | 查询 | 组织目录（Organization Directory） | 系统/未明确 | 展示 组织目录（Organization Directory） |
| 数据集治理（Dataset Governance） | 特征架构（Feature Schema） | 定义特征架构（Define Feature Schema） | 新增 | 特征架构编辑器（Feature Schema Editor） | 数据管理员（Data Steward） | 启动生命周期 特征架构（Feature Schema）; 产生事件 特征架构已发布（Feature Schema Published）; 状态变为 已发布（Published） |
| 数据集治理（Dataset Governance） | 特征架构（Feature Schema） | 特征架构目录（Feature Schema Catalog） | 查询 | 特征架构目录（Feature Schema Catalog） 查询入口 | 系统/未明确 | 展示 特征架构目录（Feature Schema Catalog） |
| 数据集治理（Dataset Governance） | 数据集（Dataset） | 注册数据集（Register Dataset） | 新增 | 数据集注册界面（Dataset Registration Screen） | 数据所有者（Data Owner） | 启动生命周期 数据集（Dataset）; 产生事件 数据集已注册（Dataset Registered）; 状态变为 已注册（Registered） |
| 数据集治理（Dataset Governance） | 数据集（Dataset） | 验证数据集合约（Validate Dataset Contract） | 业务操作 | 系统流程/入口未明确 | 系统/未明确 | 产生事件 数据集合约已验证（Dataset Contract Validated）; 状态变为 合约已验证（Contract Validated） |
| 数据集治理（Dataset Governance） | 数据集（Dataset） | 拒绝数据集用于训练（Reject Dataset For Training） | 业务操作 | 数据集审批界面（Dataset Approval Screen） | 合规官（Compliance Officer） | 产生事件 数据集已拒绝用于训练（Dataset Rejected For Training）; 状态变为 已拒绝（Rejected） |
| 数据集治理（Dataset Governance） | 数据集（Dataset） | 批准数据集用于训练（Approve Dataset For Training） | 业务操作 | 数据集审批界面（Dataset Approval Screen） | 合规官（Compliance Officer） | 产生事件 数据集已批准用于训练（Dataset Approved For Training）; 状态变为 已批准（Approved） |
| 数据集治理（Dataset Governance） | 数据集（Dataset） | 作废数据集训练审批（Expire Dataset Training Approval） | 业务操作 | 系统流程/入口未明确 | 系统/未明确 | 产生事件 数据集训练审批已过期（Dataset Training Approval Expired）; 状态变为 审批已过期（Approval Expired） |
| 数据集治理（Dataset Governance） | 数据集（Dataset） | 撤销数据集训练审批（Revoke Dataset Training Approval） | 业务操作 | 数据集审批界面（Dataset Approval Screen） | 合规官（Compliance Officer） | 产生事件 数据集训练审批已撤销（Dataset Training Approval Revoked）; 状态变为 审批已撤销（Approval Revoked） |
| 数据集治理（Dataset Governance） | 数据集（Dataset） | 数据集能力（Dataset Capability） | 查询 | 数据集能力（Dataset Capability） 查询入口 | 系统/未明确 | 展示 数据集能力（Dataset Capability） |
| 数据集治理（Dataset Governance） | 数据集访问配置（Dataset Access Profile） | 配置数据集访问配置（Configure Dataset Access Profile） | 新增 | 数据集访问配置界面（Dataset Access Profile Screen） | 节点操作员（Node Operator） | 启动生命周期 数据集访问配置（Dataset Access Profile）; 产生事件 数据集访问配置已配置（Dataset Access Profile Configured）; 状态变为 已配置（Configured） |
| 数据集治理（Dataset Governance） | 数据集访问配置（Dataset Access Profile） | 请求运行时数据集访问验证（Request Runtime Dataset Access Validation） | 业务操作 | 系统流程/入口未明确 | 系统/未明确 | 产生事件 数据集访问验证已请求（Dataset Access Validation Requested）; 状态变为 验证已请求（Validation Requested） |
| 数据集治理（Dataset Governance） | 数据集访问配置（Dataset Access Profile） | 完成运行时数据集访问验证（Complete Runtime Dataset Access Validation） | 业务操作 | 系统流程/入口未明确 | 系统/未明确 | 产生事件 运行时数据集访问已验证（Runtime Dataset Access Validated）; 状态变为 已验证（Validated） |
| 数据集治理（Dataset Governance） | 数据集访问配置（Dataset Access Profile） | 数据集运行时访问目录（Dataset Runtime Access Catalog） | 查询 | 数据集运行时访问目录（Dataset Runtime Access Catalog） 查询入口 | 系统/未明确 | 展示 数据集运行时访问目录（Dataset Runtime Access Catalog） |
| 数据集治理（Dataset Governance） | 训练评估数据集包（Training Evaluation Dataset Bundle） | 声明训练评估数据集（Declare Training Evaluation Datasets） | 新增 | 数据集包界面（Dataset Bundle Screen） | 数据所有者（Data Owner） | 启动生命周期 训练评估数据集包（Training Evaluation Dataset Bundle）; 产生事件 训练评估数据集已声明（Training Evaluation Datasets Declared）; 状态变为 已声明（Declared） |
| 数据集治理（Dataset Governance） | 训练评估数据集包（Training Evaluation Dataset Bundle） | 训练评估数据集目录（Training Evaluation Dataset Catalog） | 查询 | 训练评估数据集目录（Training Evaluation Dataset Catalog） 查询入口 | 系统/未明确 | 展示 训练评估数据集目录（Training Evaluation Dataset Catalog） |
| 训练编排（Training Orchestration） | 训练运行配置（Training Run Configuration） | 定义训练运行配置（Define Training Run Configuration） | 新增 | 训练运行配置界面（Training Run Configuration Screen） | MLOps 工程师（MLOps Engineer） | 启动生命周期 训练运行配置（Training Run Configuration）; 产生事件 训练运行配置已定义（Training Run Configuration Defined）; 状态变为 草稿（Draft） |
| 训练编排（Training Orchestration） | 训练运行配置（Training Run Configuration） | 验证训练运行配置（Validate Training Run Configuration） | 业务操作 | 系统流程/入口未明确 | 系统/未明确 | 产生事件 训练运行配置已验证（Training Run Configuration Validated）; 状态变为 已验证（Validated） |
| 训练编排（Training Orchestration） | 训练运行配置（Training Run Configuration） | 锁定训练运行配置（Lock Training Run Configuration） | 业务操作 | 系统流程/入口未明确 | 系统/未明确 | 产生事件 训练运行配置已锁定（Training Run Configuration Locked）; 状态变为 已锁定（Locked） |
| 训练编排（Training Orchestration） | 训练运行配置（Training Run Configuration） | 训练运行配置目录（Training Run Configuration Catalog） | 查询 | 训练运行配置目录（Training Run Configuration Catalog） 查询入口 | 系统/未明确 | 展示 训练运行配置目录（Training Run Configuration Catalog） |
| 训练编排（Training Orchestration） | 训练任务（Training Job） | 创建训练任务（Create Training Job） | 新增 | 训练任务创建界面（Training Job Creation Screen） | 研究负责人（Research Lead） | 启动生命周期 训练任务（Training Job）; 产生事件 训练任务已创建（Training Job Created）; 状态变为 草稿（Draft） |
| 训练编排（Training Orchestration） | 训练任务（Training Job） | 配置训练策略（Configure Training Strategy） | 业务操作 | 训练策略界面（Training Strategy Screen） | MLOps 工程师（MLOps Engineer） | 产生事件 训练策略已配置（Training Strategy Configured）; 状态变为 策略已配置（Strategy Configured） |
| 训练编排（Training Orchestration） | 训练任务（Training Job） | 提交训练任务（Submit Training Job） | 业务操作 | 训练提交界面（Training Submission Screen） | 研究负责人（Research Lead） | 产生事件 训练任务已提交（Training Job Submitted）; 状态变为 已提交（Submitted） |
| 训练编排（Training Orchestration） | 训练任务（Training Job） | 请求节点参与（Request Node Participation） | 业务操作 | 系统流程/入口未明确 | 系统/未明确 | 产生事件 节点参与已请求（Node Participation Requested）; 状态变为 正在招募节点（Recruiting Nodes） |
| 训练编排（Training Orchestration） | 训练任务（Training Job） | 接受节点参与（Accept Node Participation） | 业务操作 | 节点参与界面（Node Participation Screen） | 节点操作员（Node Operator） | 产生事件 节点已就绪可用于训练（Node Ready For Training） |
| 训练编排（Training Orchestration） | 训练任务（Training Job） | 训练参与者资格（Training Participant Eligibility） | 查询 | 训练参与者资格（Training Participant Eligibility） 查询入口 | 系统/未明确 | 展示 训练参与者资格（Training Participant Eligibility） |
| 训练编排（Training Orchestration） | 训练任务（Training Job） | 跟踪训练任务运行中（Track Training Job Running） | 业务操作 | 系统流程/入口未明确 | 系统/未明确 | 产生事件 训练任务运行中（Training Job Running）; 状态变为 运行中（Running） |
| 训练编排（Training Orchestration） | 训练任务（Training Job） | 暂停训练任务（Pause Training Job） | 业务操作 | 训练运维界面（Training Operations Screen） | MLOps 工程师（MLOps Engineer） | 产生事件 训练任务已暂停（Training Job Paused）; 状态变为 已暂停（Paused） |
| 训练编排（Training Orchestration） | 训练任务（Training Job） | 恢复训练任务（Resume Training Job） | 业务操作 | 训练运维界面（Training Operations Screen） | MLOps 工程师（MLOps Engineer） | 产生事件 训练任务已恢复（Training Job Resumed）; 状态变为 运行中（Running） |
| 训练编排（Training Orchestration） | 训练任务（Training Job） | 取消训练任务（Cancel Training Job） | 业务操作 | 训练运维界面（Training Operations Screen） | MLOps 工程师（MLOps Engineer） | 产生事件 训练任务已取消（Training Job Canceled）; 状态变为 已取消（Canceled） |
| 训练编排（Training Orchestration） | 训练任务（Training Job） | 安排下一训练轮次（Schedule Next Training Round） | 自动化 | 系统流程/入口未明确 | 系统/未明确 | 结果待业务确认 |
| 训练编排（Training Orchestration） | 训练任务（Training Job） | 完成训练任务（Complete Training Job） | 业务操作 | 系统流程/入口未明确 | 系统/未明确 | 产生事件 训练任务已完成（Training Job Completed）; 状态变为 已完成（Completed） |
| 训练编排（Training Orchestration） | 训练任务（Training Job） | 训练任务仪表板（Training Job Dashboard） | 查询 | 训练任务仪表板（Training Job Dashboard） 查询入口 | 系统/未明确 | 展示 训练任务仪表板（Training Job Dashboard） |
| 训练编排（Training Orchestration） | 训练轮次（Training Round） | 启动训练轮次（Start Training Round） | 新增 | 系统流程/入口未明确 | 系统/未明确 | 启动生命周期 训练轮次（Training Round）; 产生事件 训练轮次已开始（Training Round Started）; 状态变为 运行中（Running） |
| 训练编排（Training Orchestration） | 训练轮次（Training Round） | 分发全局模型（Distribute Global Model） | 业务操作 | 系统流程/入口未明确 | 系统/未明确 | 产生事件 全局模型已分发（Global Model Distributed）; 状态变为 正在收集更新（Collecting Updates） |
| 训练编排（Training Orchestration） | 训练轮次（Training Round） | 提交本地模型更新（Submit Local Model Update） | 业务操作 | 系统流程/入口未明确 | 边缘运行时（Edge Runtime） | 产生事件 本地模型更新已提交（Local Model Update Submitted） |
| 训练编排（Training Orchestration） | 训练轮次（Training Round） | 提交本地模型评估（Submit Local Model Evaluation） | 业务操作 | 系统流程/入口未明确 | 系统/未明确 | 产生事件 本地模型评估已提交（Local Model Evaluation Submitted） |
| 训练编排（Training Orchestration） | 训练轮次（Training Round） | 请求安全聚合（Request Secure Aggregation） | 业务操作 | 系统流程/入口未明确 | 系统/未明确 | 产生事件 安全聚合已请求（Secure Aggregation Requested）; 状态变为 正在聚合（Aggregating） |
| 训练编排（Training Orchestration） | 训练轮次（Training Round） | 完成安全聚合（Complete Secure Aggregation） | 业务操作 | 系统流程/入口未明确 | 系统/未明确 | 产生事件 全局模型已更新（Global Model Updated）; 状态变为 正在评估全局模型（Evaluating Global Model） |
| 训练编排（Training Orchestration） | 训练轮次（Training Round） | 提交全局模型评估（Submit Global Model Evaluation） | 业务操作 | 系统流程/入口未明确 | 系统/未明确 | 产生事件 全局模型评估已提交（Global Model Evaluation Submitted） |
| 训练编排（Training Orchestration） | 训练轮次（Training Round） | 完成训练轮次（Complete Training Round） | 业务操作 | 系统流程/入口未明确 | 系统/未明确 | 产生事件 训练轮次已完成（Training Round Completed）; 状态变为 已完成（Completed） |
| 训练编排（Training Orchestration） | 训练轮次（Training Round） | 训练轮次进度（Training Round Progress） | 查询 | 训练轮次进度（Training Round Progress） 查询入口 | 系统/未明确 | 展示 训练轮次进度（Training Round Progress） |
| 模型生命周期（Model Lifecycle） | 模型版本（Model Version） | 注册候选模型（Register Candidate Model） | 新增 | 系统流程/入口未明确 | 系统/未明确 | 启动生命周期 模型版本（Model Version）; 产生事件 模型候选已注册（Model Candidate Registered）; 状态变为 候选（Candidate） |
| 模型生命周期（Model Lifecycle） | 模型版本（Model Version） | 批准模型（Approve Model） | 业务操作 | 模型审批界面（Model Approval Screen） | 治理审查员（Governance Reviewer） | 产生事件 模型已批准（Model Approved）; 状态变为 已批准（Approved） |
| 模型生命周期（Model Lifecycle） | 模型版本（Model Version） | 提升模型至生产（Promote Model To Production） | 业务操作 | 模型发布界面（Model Release Screen） | 发布管理员（Release Manager） | 产生事件 模型已提升至生产（Model Promoted To Production）; 状态变为 生产（Production） |
| 模型生命周期（Model Lifecycle） | 模型版本（Model Version） | 回滚模型版本（Rollback Model Version） | 业务操作 | 模型发布界面（Model Release Screen） | 发布管理员（Release Manager） | 产生事件 模型版本已回滚（Model Version Rolled Back）; 状态变为 已回滚（Rolled Back） |
| 模型生命周期（Model Lifecycle） | 模型版本（Model Version） | 停用模型版本（Retire Model Version） | 业务操作 | 模型发布界面（Model Release Screen） | 发布管理员（Release Manager） | 产生事件 模型版本已停用（Model Version Retired）; 状态变为 已停用（Retired） |
| 模型生命周期（Model Lifecycle） | 模型版本（Model Version） | 模型版本目录（Model Version Catalog） | 查询 | 模型版本目录（Model Version Catalog） 查询入口 | 系统/未明确 | 展示 模型版本目录（Model Version Catalog） |
| 运行时运维（Runtime Operations） | 节点运行时健康（Node Runtime Health） | 记录运行时心跳（Record Runtime Heartbeat） | 新增 | 运行时监控界面（Runtime Monitor Screen） | 边缘运行时（Edge Runtime） | 启动生命周期 节点运行时健康（Node Runtime Health）; 产生事件 运行时心跳已记录（Runtime Heartbeat Recorded）; 状态变为 健康（Healthy） |
| 运行时运维（Runtime Operations） | 节点运行时健康（Node Runtime Health） | 运行时健康仪表板（Runtime Health Dashboard） | 查询 | 运行时健康仪表板（Runtime Health Dashboard） 查询入口 | 系统/未明确 | 展示 运行时健康仪表板（Runtime Health Dashboard） |
| 运行时运维（Runtime Operations） | 训练告警（Training Alert） | 触发训练告警（Raise Training Alert） | 新增 | 系统流程/入口未明确 | 系统/未明确 | 启动生命周期 训练告警（Training Alert）; 产生事件 训练告警已触发（Training Alert Raised）; 状态变为 已触发（Raised） |
| 运行时运维（Runtime Operations） | 训练告警（Training Alert） | 训练告警目录（Training Alert Catalog） | 查询 | 训练告警目录（Training Alert Catalog） 查询入口 | 系统/未明确 | 展示 训练告警目录（Training Alert Catalog） |
| 运行时运维（Runtime Operations） | 审计记录（Audit Record） | 追加审计跟踪（Append Audit Trail） | 新增 | 系统流程/入口未明确 | 系统/未明确 | 启动生命周期 审计记录（Audit Record）; 产生事件 审计跟踪已追加（Audit Trail Appended）; 状态变为 已追加（Appended） |
| 运行时运维（Runtime Operations） | 审计记录（Audit Record） | 审计记录日志（Audit Record Log） | 查询 | 审计记录日志（Audit Record Log） 查询入口 | 系统/未明确 | 展示 审计记录日志（Audit Record Log） |
| 密钥与认证管理（Key And Attestation Management） | 节点加密密钥（Node Encryption Key） | 生成节点密钥（Generate Node Key） | 新增 | 节点密钥管理界面（Node Key Management Screen） | 安全审查员（Security Reviewer） | 启动生命周期 节点加密密钥（Node Encryption Key）; 产生事件 节点密钥已生成（Node Key Generated）; 状态变为 已生成（Generated） |
| 密钥与认证管理（Key And Attestation Management） | 节点加密密钥（Node Encryption Key） | 分发节点密钥（Distribute Node Key） | 业务操作 | 系统流程/入口未明确 | 系统/未明确 | 产生事件 节点密钥已分发（Node Key Distributed）; 状态变为 已分发（Distributed） |
| 密钥与认证管理（Key And Attestation Management） | 节点加密密钥（Node Encryption Key） | 激活节点密钥（Activate Node Key） | 业务操作 | 节点密钥管理界面（Node Key Management Screen） | 节点操作员（Node Operator） | 产生事件 节点密钥已激活（Node Key Activated）; 状态变为 活跃（Active） |
| 密钥与认证管理（Key And Attestation Management） | 节点加密密钥（Node Encryption Key） | 撤销节点密钥（Revoke Node Key） | 业务操作 | 节点密钥管理界面（Node Key Management Screen） | 安全审查员（Security Reviewer） | 产生事件 节点密钥已撤销（Node Key Revoked）; 状态变为 已撤销（Revoked） |
| 密钥与认证管理（Key And Attestation Management） | 节点加密密钥（Node Encryption Key） | 作废节点密钥（Expire Node Key） | 业务操作 | 系统流程/入口未明确 | 系统/未明确 | 产生事件 节点密钥已过期（Node Key Expired）; 状态变为 已过期（Expired） |
| 密钥与认证管理（Key And Attestation Management） | 节点加密密钥（Node Encryption Key） | 节点密钥目录（Node Key Catalog） | 查询 | 节点密钥目录（Node Key Catalog） 查询入口 | 系统/未明确 | 展示 节点密钥目录（Node Key Catalog） |
| 密钥与认证管理（Key And Attestation Management） | 节点认证报告（Node Attestation Report） | 提交节点认证报告（Submit Node Attestation Report） | 新增 | 节点认证提交界面（Node Attestation Submission Screen） | 节点操作员（Node Operator） | 启动生命周期 节点认证报告（Node Attestation Report）; 产生事件 节点认证报告已提交（Node Attestation Report Submitted）; 状态变为 已提交（Submitted） |
| 密钥与认证管理（Key And Attestation Management） | 节点认证报告（Node Attestation Report） | 验证节点认证报告（Verify Node Attestation Report） | 业务操作 | 节点认证审查界面（Node Attestation Review Screen） | 安全审查员（Security Reviewer） | 产生事件 节点认证报告已验证（Node Attestation Report Verified）; 状态变为 已验证（Verified） |
| 密钥与认证管理（Key And Attestation Management） | 节点认证报告（Node Attestation Report） | 作废节点认证报告（Expire Node Attestation Report） | 业务操作 | 系统流程/入口未明确 | 系统/未明确 | 产生事件 节点认证报告已过期（Node Attestation Report Expired）; 状态变为 已过期（Expired） |
| 密钥与认证管理（Key And Attestation Management） | 节点认证报告（Node Attestation Report） | 撤销节点认证报告（Revoke Node Attestation Report） | 业务操作 | 节点认证审查界面（Node Attestation Review Screen） | 安全审查员（Security Reviewer） | 产生事件 节点认证报告已撤销（Node Attestation Report Revoked）; 状态变为 已撤销（Revoked） |
| 密钥与认证管理（Key And Attestation Management） | 节点认证报告（Node Attestation Report） | 节点认证目录（Node Attestation Catalog） | 查询 | 节点认证目录（Node Attestation Catalog） 查询入口 | 系统/未明确 | 展示 节点认证目录（Node Attestation Catalog） |
| 密钥与认证管理（Key And Attestation Management） | 安全聚合密钥（Secure Aggregation Key） | 生成安全聚合密钥（Generate Secure Aggregation Key） | 新增 | 安全聚合密钥界面（Secure Aggregation Key Screen） | MLOps 工程师（MLOps Engineer） | 启动生命周期 安全聚合密钥（Secure Aggregation Key）; 产生事件 安全聚合密钥已生成（Secure Aggregation Key Generated）; 状态变为 已生成（Generated） |
| 密钥与认证管理（Key And Attestation Management） | 安全聚合密钥（Secure Aggregation Key） | 分发密钥份额（Distribute Key Share） | 业务操作 | 安全聚合密钥界面（Secure Aggregation Key Screen） | MLOps 工程师（MLOps Engineer） | 产生事件 安全聚合密钥份额已分发（Secure Aggregation Key Share Distributed）; 状态变为 已分发（Distributed） |
| 密钥与认证管理（Key And Attestation Management） | 安全聚合密钥（Secure Aggregation Key） | 标记安全聚合密钥已使用（Mark Secure Aggregation Key Used） | 业务操作 | 系统流程/入口未明确 | 系统/未明确 | 产生事件 安全聚合密钥已使用（Secure Aggregation Key Used）; 状态变为 已使用（Used） |
| 密钥与认证管理（Key And Attestation Management） | 安全聚合密钥（Secure Aggregation Key） | 撤销安全聚合密钥（Revoke Secure Aggregation Key） | 业务操作 | 安全聚合密钥界面（Secure Aggregation Key Screen） | 安全审查员（Security Reviewer） | 产生事件 安全聚合密钥已撤销（Secure Aggregation Key Revoked）; 状态变为 已撤销（Revoked） |
| 密钥与认证管理（Key And Attestation Management） | 安全聚合密钥（Secure Aggregation Key） | 安全聚合密钥目录（Secure Aggregation Key Catalog） | 查询 | 安全聚合密钥目录（Secure Aggregation Key Catalog） 查询入口 | 系统/未明确 | 展示 安全聚合密钥目录（Secure Aggregation Key Catalog） |
| 密钥与认证管理（Key And Attestation Management） | 安全聚合轮次（Secure Aggregation Round） | 初始化安全聚合轮次（Initialize Secure Aggregation Round） | 新增 | 系统流程/入口未明确 | 系统/未明确 | 启动生命周期 安全聚合轮次（Secure Aggregation Round）; 产生事件 安全聚合轮次已初始化（Secure Aggregation Round Initialized）; 状态变为 已初始化（Initialized） |
| 密钥与认证管理（Key And Attestation Management） | 安全聚合轮次（Secure Aggregation Round） | 分发聚合掩码份额（Distribute Aggregation Mask Shares） | 业务操作 | 系统流程/入口未明确 | 安全聚合服务（Secure Aggregation Service） | 产生事件 聚合掩码份额已分发（Aggregation Mask Share Distributed）; 状态变为 份额已分发（Shares Distributed） |
| 密钥与认证管理（Key And Attestation Management） | 安全聚合轮次（Secure Aggregation Round） | 收集聚合掩码份额（Collect Aggregation Mask Shares） | 业务操作 | 系统流程/入口未明确 | 安全聚合服务（Secure Aggregation Service） | 产生事件 聚合掩码份额已收集（Aggregation Mask Shares Collected）; 状态变为 份额已收集（Shares Collected） |
| 密钥与认证管理（Key And Attestation Management） | 安全聚合轮次（Secure Aggregation Round） | 完成安全聚合解密（Complete Secure Aggregation Decrypt） | 业务操作 | 系统流程/入口未明确 | 系统/未明确 | 产生事件 安全聚合已解密（Secure Aggregation Decrypted）; 状态变为 已聚合（Aggregated） |
| 密钥与认证管理（Key And Attestation Management） | 安全聚合轮次（Secure Aggregation Round） | 撤销安全聚合轮次（Revoke Secure Aggregation Round） | 业务操作 | 安全聚合界面（Secure Aggregation Screen） | 安全审查员（Security Reviewer） | 产生事件 安全聚合轮次已撤销（Secure Aggregation Round Revoked）; 状态变为 已撤销（Revoked） |
| 密钥与认证管理（Key And Attestation Management） | 安全聚合轮次（Secure Aggregation Round） | 安全聚合轮次目录（Secure Aggregation Round Catalog） | 查询 | 安全聚合轮次目录（Secure Aggregation Round Catalog） 查询入口 | 系统/未明确 | 展示 安全聚合轮次目录（Secure Aggregation Round Catalog） |
| 密钥与认证管理（Key And Attestation Management） | 数据集访问凭证（Dataset Access Credential） | 签发数据集访问凭证（Issue Dataset Access Credential） | 新增 | 数据集访问凭证界面（Dataset Access Credential Screen） | 节点操作员（Node Operator） | 启动生命周期 数据集访问凭证（Dataset Access Credential）; 产生事件 数据集访问凭证已签发（Dataset Access Credential Issued）; 状态变为 已签发（Issued） |
| 密钥与认证管理（Key And Attestation Management） | 数据集访问凭证（Dataset Access Credential） | 轮换数据集访问凭证（Rotate Dataset Access Credential） | 业务操作 | 数据集访问凭证界面（Dataset Access Credential Screen） | 节点操作员（Node Operator） | 产生事件 数据集访问凭证已轮换（Dataset Access Credential Rotated）; 状态变为 已轮换（Rotated） |
| 密钥与认证管理（Key And Attestation Management） | 数据集访问凭证（Dataset Access Credential） | 撤销数据集访问凭证（Revoke Dataset Access Credential） | 业务操作 | 数据集访问凭证界面（Dataset Access Credential Screen） | 合规官（Compliance Officer） | 产生事件 数据集访问凭证已撤销（Dataset Access Credential Revoked）; 状态变为 已撤销（Revoked） |
| 密钥与认证管理（Key And Attestation Management） | 数据集访问凭证（Dataset Access Credential） | 数据集访问凭证目录（Dataset Access Credential Catalog） | 查询 | 数据集访问凭证目录（Dataset Access Credential Catalog） 查询入口 | 系统/未明确 | 展示 数据集访问凭证目录（Dataset Access Credential Catalog） |

<!-- em:section id="prd.section.modules" -->
## 模块需求与验收

### 联邦（Federation）

**生命周期:** 草稿（Draft） -> 活跃（Active） -> 已暂停（Suspended）

<!-- em:section id="prd.section.slice.创建联邦（CreateFederation）" source="domain/FederationLearningPlatform/context/FederationManagement/aggregate/Federation/slice/CreateFederation" -->
#### 创建联邦（Create Federation） · 新增

- **入口:** 联邦设置界面（Federation Setup Screen） (表单)
- **角色:** 平台管理员（Platform Admin）
- **业务对象:** 联邦（Federation）
- **提交操作:** 创建联邦（Create Federation）
- **成功结果:** 联邦已创建（Federation Created）
- **结果状态:** 草稿（Draft）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| federationId | UUID | Single | id, generated, technical | - | - |
| federationName | String | Single | - | - | - |
| description | String | Single | - | - | - |
| governancePolicyId | UUID | Single | - | - | - |
| minimumParticipantCount | Int | Single | - | - | - |
| minimumTrustedNodeCount | Int | Single | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.联邦概览（FederationOverview）" source="domain/FederationLearningPlatform/context/FederationManagement/aggregate/Federation/slice/FederationOverview" -->
#### 联邦概览（Federation Overview） · 查询

- **入口:** 联邦概览（Federation Overview） 查询入口
- **角色:** 系统/未明确
- **业务对象:** 联邦（Federation）
- **查询结果:** 联邦概览（Federation Overview）

<!-- em:section id="prd.section.slice.邀请参与者（InviteParticipant）" source="domain/FederationLearningPlatform/context/FederationManagement/aggregate/Federation/slice/InviteParticipant" -->
#### 邀请参与者（Invite Participant） · 业务操作

- **入口:** 参与者邀请界面（Participant Invitation Screen） (弹窗)
- **角色:** 联邦所有者（Federation Owner）
- **业务对象:** 联邦（Federation）
- **提交操作:** 邀请参与者（Invite Participant）
- **成功结果:** 参与者已邀请（Participant Invited）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| federationId | UUID | Single | id, technical | - | - |
| organizationId | UUID | Single | - | - | - |
| invitationNote | String | Single | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.批准参与者（ApproveParticipant）" source="domain/FederationLearningPlatform/context/FederationManagement/aggregate/Federation/slice/ApproveParticipant" -->
#### 批准参与者（Approve Participant） · 业务操作

- **入口:** 成员审查界面（Membership Review Screen） (弹窗)
- **角色:** 治理审查员（Governance Reviewer）
- **业务对象:** 联邦（Federation）
- **提交操作:** 批准参与者（Approve Participant）
- **成功结果:** 参与者已加入（Participant Joined）
- **结果状态:** 活跃（Active）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| federationId | UUID | Single | id, technical | - | - |
| organizationId | UUID | Single | - | - | - |
| approvalNote | String | Optional | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.拒绝参与者（RejectParticipant）" source="domain/FederationLearningPlatform/context/FederationManagement/aggregate/Federation/slice/RejectParticipant" -->
#### 拒绝参与者（Reject Participant） · 业务操作

- **入口:** 成员审查界面（Membership Review Screen） (弹窗)
- **角色:** 治理审查员（Governance Reviewer）
- **业务对象:** 联邦（Federation）
- **提交操作:** 拒绝参与者（Reject Participant）
- **成功结果:** 参与者已拒绝（Participant Rejected）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| federationId | UUID | Single | id, technical | - | - |
| organizationId | UUID | Single | - | - | - |
| rejectionReason | String | Single | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.撤销参与者邀请（RevokeParticipantInvitation）" source="domain/FederationLearningPlatform/context/FederationManagement/aggregate/Federation/slice/RevokeParticipantInvitation" -->
#### 撤销参与者邀请（Revoke Participant Invitation） · 业务操作

- **入口:** 参与者邀请界面（Participant Invitation Screen） (确认操作)
- **角色:** 联邦所有者（Federation Owner）
- **业务对象:** 联邦（Federation）
- **提交操作:** 撤销参与者邀请（Revoke Participant Invitation）
- **成功结果:** 参与者邀请已撤销（Participant Invitation Revoked）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| federationId | UUID | Single | id, technical | - | - |
| organizationId | UUID | Single | - | - | - |
| revokeReason | String | Single | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.暂停参与者（SuspendParticipant）" source="domain/FederationLearningPlatform/context/FederationManagement/aggregate/Federation/slice/SuspendParticipant" -->
#### 暂停参与者（Suspend Participant） · 业务操作

- **入口:** 成员审查界面（Membership Review Screen） (弹窗)
- **角色:** 治理审查员（Governance Reviewer）
- **业务对象:** 联邦（Federation）
- **提交操作:** 暂停参与者（Suspend Participant）
- **成功结果:** 参与者已暂停（Participant Suspended）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| federationId | UUID | Single | id, technical | - | - |
| organizationId | UUID | Single | - | - | - |
| suspensionReason | String | Single | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.移除参与者（RemoveParticipant）" source="domain/FederationLearningPlatform/context/FederationManagement/aggregate/Federation/slice/RemoveParticipant" -->
#### 移除参与者（Remove Participant） · 业务操作

- **入口:** 成员审查界面（Membership Review Screen） (确认操作)
- **角色:** 治理审查员（Governance Reviewer）
- **业务对象:** 联邦（Federation）
- **提交操作:** 移除参与者（Remove Participant）
- **成功结果:** 参与者已移除（Participant Removed）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| federationId | UUID | Single | id, technical | - | - |
| organizationId | UUID | Single | - | - | - |
| removalReason | String | Single | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.联邦成员目录（FederationMembershipDirectory）" source="domain/FederationLearningPlatform/context/FederationManagement/aggregate/Federation/slice/FederationMembershipDirectory" -->
#### 联邦成员目录（Federation Membership Directory） · 查询

- **入口:** 联邦成员目录（Federation Membership Directory） 查询入口
- **角色:** 系统/未明确
- **业务对象:** 联邦（Federation）
- **查询结果:** 联邦成员目录（Federation Membership Directory）

### 计算节点（Compute Node）

**生命周期:** 已注册（Registered） -> 能力已声明（Capability Declared） -> 已信任（Trusted） -> 已暂停（Suspended）

<!-- em:section id="prd.section.slice.注册计算节点（RegisterComputeNode）" source="domain/FederationLearningPlatform/context/FederationManagement/aggregate/ComputeNode/slice/RegisterComputeNode" -->
#### 注册计算节点（Register Compute Node） · 新增

- **入口:** 节点注册界面（Node Registration Screen）
- **角色:** 节点操作员（Node Operator）
- **业务对象:** 计算节点（Compute Node）
- **提交操作:** 注册计算节点（Register Compute Node）
- **成功结果:** 计算节点已注册（Compute Node Registered）
- **结果状态:** 已注册（Registered）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| nodeId | UUID | Single | id, generated, technical | - | - |
| organizationId | UUID | Single | - | - | - |
| nodeName | String | Single | - | - | - |
| nodeType | String | Single | - | - | - |
| hardwareProfile | String | Single | - | - | - |
| runtimeProfile | String | Single | - | - | - |
| confidentialComputeSupported | Boolean | Single | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.更新节点能力（UpdateNodeCapability）" source="domain/FederationLearningPlatform/context/FederationManagement/aggregate/ComputeNode/slice/UpdateNodeCapability" -->
#### 更新节点能力（Update Node Capability） · 业务操作

- **入口:** 节点能力界面（Node Capability Screen）
- **角色:** 节点操作员（Node Operator）
- **业务对象:** 计算节点（Compute Node）
- **提交操作:** 更新节点能力（Update Node Capability）
- **成功结果:** 节点能力已更新（Node Capability Updated）
- **结果状态:** 能力已声明（Capability Declared）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| nodeId | UUID | Single | id, technical | - | - |
| gpuCount | Int | Single | - | - | - |
| cpuCoreCount | Int | Single | - | - | - |
| memoryGb | Int | Single | - | - | - |
| storageGb | Int | Single | - | - | - |
| supportedFrameworks | String | List | - | - | - |
| maxConcurrentJobs | Int | Single | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.信任计算节点（TrustComputeNode）" source="domain/FederationLearningPlatform/context/FederationManagement/aggregate/ComputeNode/slice/TrustComputeNode" -->
#### 信任计算节点（Trust Compute Node） · 业务操作

- **入口:** 节点信任界面（Node Trust Screen）
- **角色:** 安全审查员（Security Reviewer）
- **业务对象:** 计算节点（Compute Node）
- **提交操作:** 信任计算节点（Trust Compute Node）
- **成功结果:** 计算节点已信任（Compute Node Trusted）
- **结果状态:** 已信任（Trusted）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| nodeId | UUID | Single | id, technical | - | - |
| trustLevel | String | Single | - | - | - |
| attestationReportId | UUID | Single | - | - | - |
| attestationExpiresAt | DateTime | Single | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.暂停计算节点（SuspendComputeNode）" source="domain/FederationLearningPlatform/context/FederationManagement/aggregate/ComputeNode/slice/SuspendComputeNode" -->
#### 暂停计算节点（Suspend Compute Node） · 业务操作

- **入口:** 节点信任界面（Node Trust Screen）
- **角色:** 安全审查员（Security Reviewer）
- **业务对象:** 计算节点（Compute Node）
- **提交操作:** 暂停计算节点（Suspend Compute Node）
- **成功结果:** 计算节点已暂停（Compute Node Suspended）
- **结果状态:** 已暂停（Suspended）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| nodeId | UUID | Single | id, technical | - | - |
| suspensionReason | String | Single | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.计算节点目录（ComputeNodeCatalog）" source="domain/FederationLearningPlatform/context/FederationManagement/aggregate/ComputeNode/slice/ComputeNodeCatalog" -->
#### 计算节点目录（Compute Node Catalog） · 查询

- **入口:** 计算节点目录（Compute Node Catalog） 查询入口
- **角色:** 系统/未明确
- **业务对象:** 计算节点（Compute Node）
- **查询结果:** 计算节点目录（Compute Node Catalog）

### 特征架构（Feature Schema）

**生命周期:** 已发布（Published）

<!-- em:section id="prd.section.slice.定义特征架构（DefineFeatureSchema）" source="domain/FederationLearningPlatform/context/DatasetGovernance/aggregate/FeatureSchema/slice/DefineFeatureSchema" -->
#### 定义特征架构（Define Feature Schema） · 新增

- **入口:** 特征架构编辑器（Feature Schema Editor）
- **角色:** 数据管理员（Data Steward）
- **业务对象:** 特征架构（Feature Schema）
- **提交操作:** 定义特征架构（Define Feature Schema）
- **成功结果:** 特征架构已发布（Feature Schema Published）
- **结果状态:** 已发布（Published）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| featureSchemaId | UUID | Single | id, generated, technical | - | - |
| domain | String | Single | - | - | - |
| version | Int | Single | - | - | - |
| featureCount | Int | Single | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.特征架构目录（FeatureSchemaCatalog）" source="domain/FederationLearningPlatform/context/DatasetGovernance/aggregate/FeatureSchema/slice/FeatureSchemaCatalog" -->
#### 特征架构目录（Feature Schema Catalog） · 查询

- **入口:** 特征架构目录（Feature Schema Catalog） 查询入口
- **角色:** 系统/未明确
- **业务对象:** 特征架构（Feature Schema）
- **查询结果:** 特征架构目录（Feature Schema Catalog）

### 数据集（Dataset）

**生命周期:** 已注册（Registered） -> 合约已验证（Contract Validated） -> 已批准（Approved） -> 已拒绝（Rejected） -> 审批已过期（Approval Expired） -> 审批已撤销（Approval Revoked）

<!-- em:section id="prd.section.slice.注册数据集（RegisterDataset）" source="domain/FederationLearningPlatform/context/DatasetGovernance/aggregate/Dataset/slice/RegisterDataset" -->
#### 注册数据集（Register Dataset） · 新增

- **入口:** 数据集注册界面（Dataset Registration Screen）
- **角色:** 数据所有者（Data Owner）
- **业务对象:** 数据集（Dataset）
- **提交操作:** 注册数据集（Register Dataset）
- **成功结果:** 数据集已注册（Dataset Registered）
- **结果状态:** 已注册（Registered）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| datasetId | UUID | Single | id, generated, technical | - | - |
| organizationId | UUID | Single | - | - | - |
| featureSchemaId | UUID | Single | - | - | - |
| datasetType | String | Single | - | - | - |
| datasetUsage | String | Single | - | - | - |
| sampleCount | Int | Single | - | - | - |
| sensitivityLevel | String | Single | - | - | - |
| containsPII | Boolean | Single | - | - | - |
| region | String | Single | - | - | - |
| usagePolicyId | UUID | Single | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.验证数据集合约（ValidateDatasetContract）" source="domain/FederationLearningPlatform/context/DatasetGovernance/aggregate/Dataset/slice/ValidateDatasetContract" -->
#### 验证数据集合约（Validate Dataset Contract） · 业务操作

- **入口:** 系统流程/入口未明确
- **角色:** 系统/未明确
- **业务对象:** 数据集（Dataset）
- **提交操作:** 验证数据集合约（Validate Dataset Contract）
- **成功结果:** 数据集合约已验证（Dataset Contract Validated）
- **结果状态:** 合约已验证（Contract Validated）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| datasetId | UUID | Single | id, technical | - | - |
| featureSchemaId | UUID | Single | - | - | - |
| validationProfile | String | Single | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.拒绝数据集用于训练（RejectDatasetForTraining）" source="domain/FederationLearningPlatform/context/DatasetGovernance/aggregate/Dataset/slice/RejectDatasetForTraining" -->
#### 拒绝数据集用于训练（Reject Dataset For Training） · 业务操作

- **入口:** 数据集审批界面（Dataset Approval Screen）
- **角色:** 合规官（Compliance Officer）
- **业务对象:** 数据集（Dataset）
- **提交操作:** 拒绝数据集用于训练（Reject Dataset For Training）
- **成功结果:** 数据集已拒绝用于训练（Dataset Rejected For Training）
- **结果状态:** 已拒绝（Rejected）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| datasetId | UUID | Single | id, technical | - | - |
| rejectionReason | String | Single | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.批准数据集用于训练（ApproveDatasetForTraining）" source="domain/FederationLearningPlatform/context/DatasetGovernance/aggregate/Dataset/slice/ApproveDatasetForTraining" -->
#### 批准数据集用于训练（Approve Dataset For Training） · 业务操作

- **入口:** 数据集审批界面（Dataset Approval Screen）
- **角色:** 合规官（Compliance Officer）
- **业务对象:** 数据集（Dataset）
- **提交操作:** 批准数据集用于训练（Approve Dataset For Training）
- **成功结果:** 数据集已批准用于训练（Dataset Approved For Training）
- **结果状态:** 已批准（Approved）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| datasetId | UUID | Single | id, technical | - | - |
| allowedFederatedUse | String | Single | - | - | - |
| expiresAt | DateTime | Single | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.作废数据集训练审批（ExpireDatasetTrainingApproval）" source="domain/FederationLearningPlatform/context/DatasetGovernance/aggregate/Dataset/slice/ExpireDatasetTrainingApproval" -->
#### 作废数据集训练审批（Expire Dataset Training Approval） · 业务操作

- **入口:** 系统流程/入口未明确
- **角色:** 系统/未明确
- **业务对象:** 数据集（Dataset）
- **提交操作:** 作废数据集训练审批（Expire Dataset Training Approval）
- **成功结果:** 数据集训练审批已过期（Dataset Training Approval Expired）
- **结果状态:** 审批已过期（Approval Expired）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| datasetId | UUID | Single | id, technical | - | - |
| expiredAt | DateTime | Single | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.撤销数据集训练审批（RevokeDatasetTrainingApproval）" source="domain/FederationLearningPlatform/context/DatasetGovernance/aggregate/Dataset/slice/RevokeDatasetTrainingApproval" -->
#### 撤销数据集训练审批（Revoke Dataset Training Approval） · 业务操作

- **入口:** 数据集审批界面（Dataset Approval Screen）
- **角色:** 合规官（Compliance Officer）
- **业务对象:** 数据集（Dataset）
- **提交操作:** 撤销数据集训练审批（Revoke Dataset Training Approval）
- **成功结果:** 数据集训练审批已撤销（Dataset Training Approval Revoked）
- **结果状态:** 审批已撤销（Approval Revoked）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| datasetId | UUID | Single | id, technical | - | - |
| revokeReason | String | Single | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.数据集能力（DatasetCapability）" source="domain/FederationLearningPlatform/context/DatasetGovernance/aggregate/Dataset/slice/DatasetCapability" -->
#### 数据集能力（Dataset Capability） · 查询

- **入口:** 数据集能力（Dataset Capability） 查询入口
- **角色:** 系统/未明确
- **业务对象:** 数据集（Dataset）
- **查询结果:** 数据集能力（Dataset Capability）

### 数据集访问配置（Dataset Access Profile）

**生命周期:** 已配置（Configured） -> 验证已请求（Validation Requested） -> 已验证（Validated）

<!-- em:section id="prd.section.slice.配置数据集访问配置（ConfigureDatasetAccessProfile）" source="domain/FederationLearningPlatform/context/DatasetGovernance/aggregate/DatasetAccessProfile/slice/ConfigureDatasetAccessProfile" -->
#### 配置数据集访问配置（Configure Dataset Access Profile） · 新增

- **入口:** 数据集访问配置界面（Dataset Access Profile Screen）
- **角色:** 节点操作员（Node Operator）
- **业务对象:** 数据集访问配置（Dataset Access Profile）
- **提交操作:** 配置数据集访问配置（Configure Dataset Access Profile）
- **成功结果:** 数据集访问配置已配置（Dataset Access Profile Configured）
- **结果状态:** 已配置（Configured）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| accessProfileId | UUID | Single | id, generated, technical | - | - |
| datasetId | UUID | Single | - | - | - |
| nodeId | UUID | Single | - | - | - |
| runtimeId | UUID | Single | - | - | - |
| connectorType | String | Single | - | - | - |
| connectionProfileRef | String | Single | - | - | - |
| credentialRef | String | Single | - | - | - |
| storageLocationRef | String | Single | - | - | - |
| dataFormat | String | Single | - | - | - |
| readerPlugin | String | Single | - | - | - |
| readMode | String | Single | - | - | - |
| featureMappingId | UUID | Optional | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.请求运行时数据集访问验证（RequestRuntimeDatasetAccessValidation）" source="domain/FederationLearningPlatform/context/DatasetGovernance/aggregate/DatasetAccessProfile/slice/RequestRuntimeDatasetAccessValidation" -->
#### 请求运行时数据集访问验证（Request Runtime Dataset Access Validation） · 业务操作

- **入口:** 系统流程/入口未明确
- **角色:** 系统/未明确
- **业务对象:** 数据集访问配置（Dataset Access Profile）
- **提交操作:** 请求运行时数据集访问验证（Request Runtime Dataset Access Validation）
- **成功结果:** 数据集访问验证已请求（Dataset Access Validation Requested）
- **结果状态:** 验证已请求（Validation Requested）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| accessProfileId | UUID | Single | id, technical | - | - |
| datasetId | UUID | Single | - | - | - |
| runtimeId | UUID | Single | - | - | - |
| validationMode | String | Single | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.完成运行时数据集访问验证（CompleteRuntimeDatasetAccessValidation）" source="domain/FederationLearningPlatform/context/DatasetGovernance/aggregate/DatasetAccessProfile/slice/CompleteRuntimeDatasetAccessValidation" -->
#### 完成运行时数据集访问验证（Complete Runtime Dataset Access Validation） · 业务操作

- **入口:** 系统流程/入口未明确
- **角色:** 系统/未明确
- **业务对象:** 数据集访问配置（Dataset Access Profile）
- **提交操作:** 完成运行时数据集访问验证（Complete Runtime Dataset Access Validation）
- **成功结果:** 运行时数据集访问已验证（Runtime Dataset Access Validated）
- **结果状态:** 已验证（Validated）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| accessProfileId | UUID | Single | id, technical | - | - |
| datasetId | UUID | Single | - | - | - |
| runtimeId | UUID | Single | - | - | - |
| readable | Boolean | Single | - | - | - |
| schemaReadable | Boolean | Single | - | - | - |
| sampleBatchReadable | Boolean | Single | - | - | - |
| validationReportId | UUID | Single | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.数据集运行时访问目录（DatasetRuntimeAccessCatalog）" source="domain/FederationLearningPlatform/context/DatasetGovernance/aggregate/DatasetAccessProfile/slice/DatasetRuntimeAccessCatalog" -->
#### 数据集运行时访问目录（Dataset Runtime Access Catalog） · 查询

- **入口:** 数据集运行时访问目录（Dataset Runtime Access Catalog） 查询入口
- **角色:** 系统/未明确
- **业务对象:** 数据集访问配置（Dataset Access Profile）
- **查询结果:** 数据集运行时访问目录（Dataset Runtime Access Catalog）

### 训练评估数据集包（Training Evaluation Dataset Bundle）

**生命周期:** 已声明（Declared）

<!-- em:section id="prd.section.slice.声明训练评估数据集（DeclareTrainingEvaluationDatasets）" source="domain/FederationLearningPlatform/context/DatasetGovernance/aggregate/TrainingEvaluationDatasetBundle/slice/DeclareTrainingEvaluationDatasets" -->
#### 声明训练评估数据集（Declare Training Evaluation Datasets） · 新增

- **入口:** 数据集包界面（Dataset Bundle Screen）
- **角色:** 数据所有者（Data Owner）
- **业务对象:** 训练评估数据集包（Training Evaluation Dataset Bundle）
- **提交操作:** 声明训练评估数据集（Declare Training Evaluation Datasets）
- **成功结果:** 训练评估数据集已声明（Training Evaluation Datasets Declared）
- **结果状态:** 已声明（Declared）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| datasetBundleId | UUID | Single | id, generated, technical | - | - |
| organizationId | UUID | Single | - | - | - |
| nodeId | UUID | Single | - | - | - |
| ownerRole | String | Single | - | - | - |
| trainingDatasetId | UUID | Single | - | - | - |
| trainingDatasetAccessProfileId | UUID | Single | - | - | - |
| evaluationDatasetId | UUID | Single | - | - | - |
| evaluationDatasetAccessProfileId | UUID | Single | - | - | - |
| featureSchemaId | UUID | Single | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.训练评估数据集目录（TrainingEvaluationDatasetCatalog）" source="domain/FederationLearningPlatform/context/DatasetGovernance/aggregate/TrainingEvaluationDatasetBundle/slice/TrainingEvaluationDatasetCatalog" -->
#### 训练评估数据集目录（Training Evaluation Dataset Catalog） · 查询

- **入口:** 训练评估数据集目录（Training Evaluation Dataset Catalog） 查询入口
- **角色:** 系统/未明确
- **业务对象:** 训练评估数据集包（Training Evaluation Dataset Bundle）
- **查询结果:** 训练评估数据集目录（Training Evaluation Dataset Catalog）

### 训练运行配置（Training Run Configuration）

**生命周期:** 草稿（Draft） -> 已验证（Validated） -> 已锁定（Locked）

<!-- em:section id="prd.section.slice.定义训练运行配置（DefineTrainingRunConfiguration）" source="domain/FederationLearningPlatform/context/TrainingOrchestration/aggregate/TrainingRunConfiguration/slice/DefineTrainingRunConfiguration" -->
#### 定义训练运行配置（Define Training Run Configuration） · 新增

- **入口:** 训练运行配置界面（Training Run Configuration Screen）
- **角色:** MLOps 工程师（MLOps Engineer）
- **业务对象:** 训练运行配置（Training Run Configuration）
- **提交操作:** 定义训练运行配置（Define Training Run Configuration）
- **成功结果:** 训练运行配置已定义（Training Run Configuration Defined）
- **结果状态:** 草稿（Draft）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| trainingRunConfigurationId | UUID | Single | id, generated, technical | - | - |
| federationId | UUID | Single | - | - | - |
| featureSchemaId | UUID | Single | - | - | - |
| strategyName | String | Single | - | - | - |
| aggregationAlgorithm | String | Single | - | - | - |
| maxRounds | Int | Single | - | - | - |
| minimumNodesPerRound | Int | Single | - | - | - |
| roundTimeoutSeconds | Int | Single | - | - | - |
| nodeResponseTimeoutSeconds | Int | Single | - | - | - |
| localEpochs | Int | Single | - | - | - |
| batchSize | Int | Single | - | - | - |
| learningRate | Decimal | Single | - | - | - |
| optimizer | String | Single | - | - | - |
| lossFunction | String | Single | - | - | - |
| gradientClippingNorm | Decimal | Optional | - | - | - |
| secureAggregationRequired | Boolean | Single | - | - | - |
| differentialPrivacyEnabled | Boolean | Single | - | - | - |
| dpNoiseMultiplier | Decimal | Optional | - | - | - |
| dpClipNorm | Decimal | Optional | - | - | - |
| minimumAccuracy | Decimal | Single | - | - | - |
| minimumFairnessScore | Decimal | Optional | - | - | - |
| failureToleranceRatio | Decimal | Single | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.验证训练运行配置（ValidateTrainingRunConfiguration）" source="domain/FederationLearningPlatform/context/TrainingOrchestration/aggregate/TrainingRunConfiguration/slice/ValidateTrainingRunConfiguration" -->
#### 验证训练运行配置（Validate Training Run Configuration） · 业务操作

- **入口:** 系统流程/入口未明确
- **角色:** 系统/未明确
- **业务对象:** 训练运行配置（Training Run Configuration）
- **提交操作:** 验证训练运行配置（Validate Training Run Configuration）
- **成功结果:** 训练运行配置已验证（Training Run Configuration Validated）
- **结果状态:** 已验证（Validated）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| trainingRunConfigurationId | UUID | Single | id, technical | - | - |
| validationProfile | String | Single | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.锁定训练运行配置（LockTrainingRunConfiguration）" source="domain/FederationLearningPlatform/context/TrainingOrchestration/aggregate/TrainingRunConfiguration/slice/LockTrainingRunConfiguration" -->
#### 锁定训练运行配置（Lock Training Run Configuration） · 业务操作

- **入口:** 系统流程/入口未明确
- **角色:** 系统/未明确
- **业务对象:** 训练运行配置（Training Run Configuration）
- **提交操作:** 锁定训练运行配置（Lock Training Run Configuration）
- **成功结果:** 训练运行配置已锁定（Training Run Configuration Locked）
- **结果状态:** 已锁定（Locked）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| trainingRunConfigurationId | UUID | Single | id, technical | - | - |
| trainingJobId | UUID | Single | - | - | - |
| lockedBy | String | Single | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.训练运行配置目录（TrainingRunConfigurationCatalog）" source="domain/FederationLearningPlatform/context/TrainingOrchestration/aggregate/TrainingRunConfiguration/slice/TrainingRunConfigurationCatalog" -->
#### 训练运行配置目录（Training Run Configuration Catalog） · 查询

- **入口:** 训练运行配置目录（Training Run Configuration Catalog） 查询入口
- **角色:** 系统/未明确
- **业务对象:** 训练运行配置（Training Run Configuration）
- **查询结果:** 训练运行配置目录（Training Run Configuration Catalog）

### 训练任务（Training Job）

**生命周期:** 草稿（Draft） -> 策略已配置（Strategy Configured） -> 已提交（Submitted） -> 正在招募节点（Recruiting Nodes） -> 运行中（Running） -> 已暂停（Paused） -> 已取消（Canceled） -> 已完成（Completed）

<!-- em:section id="prd.section.slice.创建训练任务（CreateTrainingJob）" source="domain/FederationLearningPlatform/context/TrainingOrchestration/aggregate/TrainingJob/slice/CreateTrainingJob" -->
#### 创建训练任务（Create Training Job） · 新增

- **入口:** 训练任务创建界面（Training Job Creation Screen）
- **角色:** 研究负责人（Research Lead）
- **业务对象:** 训练任务（Training Job）
- **提交操作:** 创建训练任务（Create Training Job）
- **成功结果:** 训练任务已创建（Training Job Created）
- **结果状态:** 草稿（Draft）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| trainingJobId | UUID | Single | id, generated, technical | - | - |
| federationId | UUID | Single | - | - | - |
| featureSchemaId | UUID | Single | - | - | - |
| trainingRunConfigurationId | UUID | Single | - | - | - |
| aggregatorDatasetBundleId | UUID | Single | - | - | - |
| aggregatorTrainingDatasetId | UUID | Single | - | - | - |
| aggregatorTrainingDatasetAccessProfileId | UUID | Single | - | - | - |
| aggregatorEvaluationDatasetId | UUID | Single | - | - | - |
| aggregatorEvaluationDatasetAccessProfileId | UUID | Single | - | - | - |
| objective | String | Single | - | - | - |
| targetMetric | String | Single | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.配置训练策略（ConfigureTrainingStrategy）" source="domain/FederationLearningPlatform/context/TrainingOrchestration/aggregate/TrainingJob/slice/ConfigureTrainingStrategy" -->
#### 配置训练策略（Configure Training Strategy） · 业务操作

- **入口:** 训练策略界面（Training Strategy Screen）
- **角色:** MLOps 工程师（MLOps Engineer）
- **业务对象:** 训练任务（Training Job）
- **提交操作:** 配置训练策略（Configure Training Strategy）
- **成功结果:** 训练策略已配置（Training Strategy Configured）
- **结果状态:** 策略已配置（Strategy Configured）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| trainingJobId | UUID | Single | id, technical | - | - |
| trainingRunConfigurationId | UUID | Single | - | - | - |
| strategyName | String | Single | - | - | - |
| maxRounds | Int | Single | - | - | derived from TrainingRunConfiguration.maxRounds rule: 将已锁定的训练运行配置轮次预算复制到训练任务策略。 |
| minimumNodesPerRound | Int | Single | - | - | derived from TrainingRunConfiguration.minimumNodesPerRound rule: 将已配置的最小节点法定人数复制到训练任务策略。 |
| secureAggregationRequired | Boolean | Single | - | - | derived from TrainingRunConfiguration.secureAggregationRequired rule: 将安全聚合需求复制到训练任务策略。 |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.提交训练任务（SubmitTrainingJob）" source="domain/FederationLearningPlatform/context/TrainingOrchestration/aggregate/TrainingJob/slice/SubmitTrainingJob" -->
#### 提交训练任务（Submit Training Job） · 业务操作

- **入口:** 训练提交界面（Training Submission Screen）
- **角色:** 研究负责人（Research Lead）
- **业务对象:** 训练任务（Training Job）
- **提交操作:** 提交训练任务（Submit Training Job）
- **成功结果:** 训练任务已提交（Training Job Submitted）
- **结果状态:** 已提交（Submitted）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| trainingJobId | UUID | Single | id, technical | - | - |
| trainingRunConfigurationId | UUID | Single | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.请求节点参与（RequestNodeParticipation）" source="domain/FederationLearningPlatform/context/TrainingOrchestration/aggregate/TrainingJob/slice/RequestNodeParticipation" -->
#### 请求节点参与（Request Node Participation） · 业务操作

- **入口:** 系统流程/入口未明确
- **角色:** 系统/未明确
- **业务对象:** 训练任务（Training Job）
- **提交操作:** 请求节点参与（Request Node Participation）
- **成功结果:** 节点参与已请求（Node Participation Requested）
- **结果状态:** 正在招募节点（Recruiting Nodes）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| trainingJobId | UUID | Single | id, technical | - | - |
| trainingRunConfigurationId | UUID | Single | - | - | - |
| nodeId | UUID | Single | - | - | - |
| participantDatasetBundleId | UUID | Single | - | - | - |
| trainingDatasetAccessProfileId | UUID | Single | - | - | - |
| evaluationDatasetAccessProfileId | UUID | Single | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.接受节点参与（AcceptNodeParticipation）" source="domain/FederationLearningPlatform/context/TrainingOrchestration/aggregate/TrainingJob/slice/AcceptNodeParticipation" -->
#### 接受节点参与（Accept Node Participation） · 业务操作

- **入口:** 节点参与界面（Node Participation Screen）
- **角色:** 节点操作员（Node Operator）
- **业务对象:** 训练任务（Training Job）
- **提交操作:** 接受节点参与（Accept Node Participation）
- **成功结果:** 节点已就绪可用于训练（Node Ready For Training）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| trainingJobId | UUID | Single | id, technical | - | - |
| trainingRunConfigurationId | UUID | Single | - | - | - |
| nodeId | UUID | Single | - | - | - |
| participantDatasetBundleId | UUID | Single | - | - | - |
| availableGpuCount | Int | Single | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.训练参与者资格（TrainingParticipantEligibility）" source="domain/FederationLearningPlatform/context/TrainingOrchestration/aggregate/TrainingJob/slice/TrainingParticipantEligibility" -->
#### 训练参与者资格（Training Participant Eligibility） · 查询

- **入口:** 训练参与者资格（Training Participant Eligibility） 查询入口
- **角色:** 系统/未明确
- **业务对象:** 训练任务（Training Job）
- **查询结果:** 训练参与者资格（Training Participant Eligibility）

<!-- em:section id="prd.section.slice.跟踪训练任务运行中（TrackTrainingJobRunning）" source="domain/FederationLearningPlatform/context/TrainingOrchestration/aggregate/TrainingJob/slice/TrackTrainingJobRunning" -->
#### 跟踪训练任务运行中（Track Training Job Running） · 业务操作

- **入口:** 系统流程/入口未明确
- **角色:** 系统/未明确
- **业务对象:** 训练任务（Training Job）
- **提交操作:** 标记训练任务运行中（Mark Training Job Running）
- **成功结果:** 训练任务运行中（Training Job Running）
- **结果状态:** 运行中（Running）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| trainingJobId | UUID | Single | id, technical | - | - |
| trainingRunConfigurationId | UUID | Single | - | - | - |
| roundId | UUID | Single | - | - | - |
| roundNumber | Int | Single | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.暂停训练任务（PauseTrainingJob）" source="domain/FederationLearningPlatform/context/TrainingOrchestration/aggregate/TrainingJob/slice/PauseTrainingJob" -->
#### 暂停训练任务（Pause Training Job） · 业务操作

- **入口:** 训练运维界面（Training Operations Screen）
- **角色:** MLOps 工程师（MLOps Engineer）
- **业务对象:** 训练任务（Training Job）
- **提交操作:** 暂停训练任务（Pause Training Job）
- **成功结果:** 训练任务已暂停（Training Job Paused）
- **结果状态:** 已暂停（Paused）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| trainingJobId | UUID | Single | id, technical | - | - |
| trainingRunConfigurationId | UUID | Single | - | - | - |
| pauseReason | String | Single | - | - | - |
| requestedBy | String | Single | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.恢复训练任务（ResumeTrainingJob）" source="domain/FederationLearningPlatform/context/TrainingOrchestration/aggregate/TrainingJob/slice/ResumeTrainingJob" -->
#### 恢复训练任务（Resume Training Job） · 业务操作

- **入口:** 训练运维界面（Training Operations Screen）
- **角色:** MLOps 工程师（MLOps Engineer）
- **业务对象:** 训练任务（Training Job）
- **提交操作:** 恢复训练任务（Resume Training Job）
- **成功结果:** 训练任务已恢复（Training Job Resumed）
- **结果状态:** 运行中（Running）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| trainingJobId | UUID | Single | id, technical | - | - |
| trainingRunConfigurationId | UUID | Single | - | - | - |
| resumeReason | String | Optional | - | - | - |
| requestedBy | String | Single | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.取消训练任务（CancelTrainingJob）" source="domain/FederationLearningPlatform/context/TrainingOrchestration/aggregate/TrainingJob/slice/CancelTrainingJob" -->
#### 取消训练任务（Cancel Training Job） · 业务操作

- **入口:** 训练运维界面（Training Operations Screen）
- **角色:** MLOps 工程师（MLOps Engineer）
- **业务对象:** 训练任务（Training Job）
- **提交操作:** 取消训练任务（Cancel Training Job）
- **成功结果:** 训练任务已取消（Training Job Canceled）
- **结果状态:** 已取消（Canceled）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| trainingJobId | UUID | Single | id, technical | - | - |
| trainingRunConfigurationId | UUID | Single | - | - | - |
| cancelReason | String | Optional | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.安排下一训练轮次（ScheduleNextTrainingRound）" source="domain/FederationLearningPlatform/context/TrainingOrchestration/aggregate/TrainingJob/slice/ScheduleNextTrainingRound" -->
#### 安排下一训练轮次（Schedule Next Training Round） · 自动化

- **入口:** 系统流程/入口未明确
- **角色:** 系统/未明确
- **业务对象:** 训练任务（Training Job）

<!-- em:section id="prd.section.slice.完成训练任务（CompleteTrainingJob）" source="domain/FederationLearningPlatform/context/TrainingOrchestration/aggregate/TrainingJob/slice/CompleteTrainingJob" -->
#### 完成训练任务（Complete Training Job） · 业务操作

- **入口:** 系统流程/入口未明确
- **角色:** 系统/未明确
- **业务对象:** 训练任务（Training Job）
- **提交操作:** 完成训练任务（Complete Training Job）
- **成功结果:** 训练任务已完成（Training Job Completed）
- **结果状态:** 已完成（Completed）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| trainingJobId | UUID | Single | id, technical | - | - |
| trainingRunConfigurationId | UUID | Single | - | - | - |
| finalRoundId | UUID | Single | - | - | - |
| finalModelVersionId | UUID | Single | - | - | - |
| stopReason | String | Single | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.训练任务仪表板（TrainingJobDashboard）" source="domain/FederationLearningPlatform/context/TrainingOrchestration/aggregate/TrainingJob/slice/TrainingJobDashboard" -->
#### 训练任务仪表板（Training Job Dashboard） · 查询

- **入口:** 训练任务仪表板（Training Job Dashboard） 查询入口
- **角色:** 系统/未明确
- **业务对象:** 训练任务（Training Job）
- **查询结果:** 训练任务仪表板（Training Job Dashboard）

### 训练轮次（Training Round）

**生命周期:** 运行中（Running） -> 正在收集更新（Collecting Updates） -> 正在聚合（Aggregating） -> 正在评估全局模型（Evaluating Global Model） -> 已完成（Completed）

<!-- em:section id="prd.section.slice.启动训练轮次（StartTrainingRound）" source="domain/FederationLearningPlatform/context/TrainingOrchestration/aggregate/TrainingRound/slice/StartTrainingRound" -->
#### 启动训练轮次（Start Training Round） · 新增

- **入口:** 系统流程/入口未明确
- **角色:** 系统/未明确
- **业务对象:** 训练轮次（Training Round）
- **提交操作:** 启动训练轮次（Start Training Round）
- **成功结果:** 训练轮次已开始（Training Round Started）
- **结果状态:** 运行中（Running）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| trainingJobId | UUID | Single | id, technical | - | - |
| trainingRunConfigurationId | UUID | Single | - | - | - |
| roundId | UUID | Single | generated, technical | - | - |
| roundNumber | Int | Single | - | - | - |
| readyNodeCount | Int | Single | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.分发全局模型（DistributeGlobalModel）" source="domain/FederationLearningPlatform/context/TrainingOrchestration/aggregate/TrainingRound/slice/DistributeGlobalModel" -->
#### 分发全局模型（Distribute Global Model） · 业务操作

- **入口:** 系统流程/入口未明确
- **角色:** 系统/未明确
- **业务对象:** 训练轮次（Training Round）
- **提交操作:** 分发全局模型（Distribute Global Model）
- **成功结果:** 全局模型已分发（Global Model Distributed）
- **结果状态:** 正在收集更新（Collecting Updates）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| trainingJobId | UUID | Single | id, technical | - | - |
| trainingRunConfigurationId | UUID | Single | - | - | - |
| roundId | UUID | Single | - | - | - |
| modelVersionId | UUID | Single | - | - | - |
| targetNodeCount | Int | Single | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.提交本地模型更新（SubmitLocalModelUpdate）" source="domain/FederationLearningPlatform/context/TrainingOrchestration/aggregate/TrainingRound/slice/SubmitLocalModelUpdate" -->
#### 提交本地模型更新（Submit Local Model Update） · 业务操作

- **入口:** 系统流程/入口未明确
- **角色:** 边缘运行时（Edge Runtime）
- **业务对象:** 训练轮次（Training Round）
- **提交操作:** 提交本地模型更新（Submit Local Model Update）
- **成功结果:** 本地模型更新已提交（Local Model Update Submitted）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| trainingJobId | UUID | Single | id, technical | - | - |
| trainingRunConfigurationId | UUID | Single | - | - | - |
| roundId | UUID | Single | - | - | - |
| nodeId | UUID | Single | - | - | - |
| trainingDatasetAccessProfileId | UUID | Single | - | - | - |
| evaluationDatasetAccessProfileId | UUID | Single | - | - | - |
| localModelVersionId | UUID | Single | - | - | - |
| updateArtifactId | UUID | Single | - | - | - |
| trainingLoss | Decimal | Single | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.提交本地模型评估（SubmitLocalModelEvaluation）" source="domain/FederationLearningPlatform/context/TrainingOrchestration/aggregate/TrainingRound/slice/SubmitLocalModelEvaluation" -->
#### 提交本地模型评估（Submit Local Model Evaluation） · 业务操作

- **入口:** 系统流程/入口未明确
- **角色:** 系统/未明确
- **业务对象:** 训练轮次（Training Round）
- **提交操作:** 提交本地模型评估（Submit Local Model Evaluation）
- **成功结果:** 本地模型评估已提交（Local Model Evaluation Submitted）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| trainingJobId | UUID | Single | id, technical | - | - |
| trainingRunConfigurationId | UUID | Single | - | - | - |
| roundId | UUID | Single | - | - | - |
| nodeId | UUID | Single | - | - | - |
| localModelVersionId | UUID | Single | - | - | - |
| evaluationDatasetAccessProfileId | UUID | Single | - | - | - |
| localAccuracy | Decimal | Single | - | - | - |
| localFairnessScore | Decimal | Single | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.请求安全聚合（RequestSecureAggregation）" source="domain/FederationLearningPlatform/context/TrainingOrchestration/aggregate/TrainingRound/slice/RequestSecureAggregation" -->
#### 请求安全聚合（Request Secure Aggregation） · 业务操作

- **入口:** 系统流程/入口未明确
- **角色:** 系统/未明确
- **业务对象:** 训练轮次（Training Round）
- **提交操作:** 请求安全聚合（Request Secure Aggregation）
- **成功结果:** 安全聚合已请求（Secure Aggregation Requested）
- **结果状态:** 正在聚合（Aggregating）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| trainingJobId | UUID | Single | id, technical | - | - |
| trainingRunConfigurationId | UUID | Single | - | - | - |
| roundId | UUID | Single | - | - | - |
| evaluatedUpdateCount | Int | Single | - | - | - |
| aggregationProvider | String | Single | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.完成安全聚合（CompleteSecureAggregation）" source="domain/FederationLearningPlatform/context/TrainingOrchestration/aggregate/TrainingRound/slice/CompleteSecureAggregation" -->
#### 完成安全聚合（Complete Secure Aggregation） · 业务操作

- **入口:** 系统流程/入口未明确
- **角色:** 系统/未明确
- **业务对象:** 训练轮次（Training Round）
- **提交操作:** 完成安全聚合（Complete Secure Aggregation）
- **成功结果:** 全局模型已更新（Global Model Updated）
- **结果状态:** 正在评估全局模型（Evaluating Global Model）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| trainingJobId | UUID | Single | id, technical | - | - |
| trainingRunConfigurationId | UUID | Single | - | - | - |
| roundId | UUID | Single | - | - | - |
| requestId | UUID | Single | - | - | - |
| aggregatedModelVersionId | UUID | Single | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.提交全局模型评估（SubmitGlobalModelEvaluation）" source="domain/FederationLearningPlatform/context/TrainingOrchestration/aggregate/TrainingRound/slice/SubmitGlobalModelEvaluation" -->
#### 提交全局模型评估（Submit Global Model Evaluation） · 业务操作

- **入口:** 系统流程/入口未明确
- **角色:** 系统/未明确
- **业务对象:** 训练轮次（Training Round）
- **提交操作:** 提交全局模型评估（Submit Global Model Evaluation）
- **成功结果:** 全局模型评估已提交（Global Model Evaluation Submitted）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| trainingJobId | UUID | Single | id, technical | - | - |
| trainingRunConfigurationId | UUID | Single | - | - | - |
| roundId | UUID | Single | - | - | - |
| aggregatedModelVersionId | UUID | Single | - | - | - |
| aggregatorEvaluationDatasetAccessProfileId | UUID | Single | - | - | - |
| globalAccuracy | Decimal | Single | - | - | - |
| globalFairnessScore | Decimal | Single | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.完成训练轮次（CompleteTrainingRound）" source="domain/FederationLearningPlatform/context/TrainingOrchestration/aggregate/TrainingRound/slice/CompleteTrainingRound" -->
#### 完成训练轮次（Complete Training Round） · 业务操作

- **入口:** 系统流程/入口未明确
- **角色:** 系统/未明确
- **业务对象:** 训练轮次（Training Round）
- **提交操作:** 完成训练轮次（Complete Training Round）
- **成功结果:** 训练轮次已完成（Training Round Completed）
- **结果状态:** 已完成（Completed）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| trainingJobId | UUID | Single | id, technical | - | - |
| trainingRunConfigurationId | UUID | Single | - | - | - |
| roundId | UUID | Single | - | - | - |
| aggregatedModelVersionId | UUID | Single | - | - | - |
| globalAccuracy | Decimal | Single | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.训练轮次进度（TrainingRoundProgress）" source="domain/FederationLearningPlatform/context/TrainingOrchestration/aggregate/TrainingRound/slice/TrainingRoundProgress" -->
#### 训练轮次进度（Training Round Progress） · 查询

- **入口:** 训练轮次进度（Training Round Progress） 查询入口
- **角色:** 系统/未明确
- **业务对象:** 训练轮次（Training Round）
- **查询结果:** 训练轮次进度（Training Round Progress）

### 模型版本（Model Version）

**生命周期:** 候选（Candidate） -> 已批准（Approved） -> 生产（Production） -> 已回滚（Rolled Back） -> 已停用（Retired）

<!-- em:section id="prd.section.slice.注册候选模型（RegisterCandidateModel）" source="domain/FederationLearningPlatform/context/ModelLifecycle/aggregate/ModelVersion/slice/RegisterCandidateModel" -->
#### 注册候选模型（Register Candidate Model） · 新增

- **入口:** 系统流程/入口未明确
- **角色:** 系统/未明确
- **业务对象:** 模型版本（Model Version）
- **提交操作:** 注册候选模型（Register Candidate Model）
- **成功结果:** 模型候选已注册（Model Candidate Registered）
- **结果状态:** 候选（Candidate）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| modelVersionId | UUID | Single | id, technical | - | - |
| trainingJobId | UUID | Single | - | - | - |
| finalRoundId | UUID | Single | - | - | - |
| modelArtifactId | UUID | Single | - | - | - |
| modelHash | String | Single | - | - | - |
| evaluationReportId | UUID | Single | - | - | - |
| lineageRef | String | Single | - | - | - |
| finalGlobalAccuracy | Decimal | Single | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.批准模型（ApproveModel）" source="domain/FederationLearningPlatform/context/ModelLifecycle/aggregate/ModelVersion/slice/ApproveModel" -->
#### 批准模型（Approve Model） · 业务操作

- **入口:** 模型审批界面（Model Approval Screen）
- **角色:** 治理审查员（Governance Reviewer）
- **业务对象:** 模型版本（Model Version）
- **提交操作:** 批准模型（Approve Model）
- **成功结果:** 模型已批准（Model Approved）
- **结果状态:** 已批准（Approved）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| modelVersionId | UUID | Single | id, technical | - | - |
| approvalNote | String | Optional | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.提升模型至生产（PromoteModelToProduction）" source="domain/FederationLearningPlatform/context/ModelLifecycle/aggregate/ModelVersion/slice/PromoteModelToProduction" -->
#### 提升模型至生产（Promote Model To Production） · 业务操作

- **入口:** 模型发布界面（Model Release Screen）
- **角色:** 发布管理员（Release Manager）
- **业务对象:** 模型版本（Model Version）
- **提交操作:** 提升模型至生产（Promote Model To Production）
- **成功结果:** 模型已提升至生产（Model Promoted To Production）
- **结果状态:** 生产（Production）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| modelVersionId | UUID | Single | id, technical | - | - |
| releaseChannel | String | Single | - | - | - |
| deploymentTarget | String | Single | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.回滚模型版本（RollbackModelVersion）" source="domain/FederationLearningPlatform/context/ModelLifecycle/aggregate/ModelVersion/slice/RollbackModelVersion" -->
#### 回滚模型版本（Rollback Model Version） · 业务操作

- **入口:** 模型发布界面（Model Release Screen）
- **角色:** 发布管理员（Release Manager）
- **业务对象:** 模型版本（Model Version）
- **提交操作:** 回滚模型版本（Rollback Model Version）
- **成功结果:** 模型版本已回滚（Model Version Rolled Back）
- **结果状态:** 已回滚（Rolled Back）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| modelVersionId | UUID | Single | id, technical | - | - |
| previousModelVersionId | UUID | Single | - | - | - |
| rollbackReason | String | Single | - | - | - |
| requestedBy | String | Single | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.停用模型版本（RetireModelVersion）" source="domain/FederationLearningPlatform/context/ModelLifecycle/aggregate/ModelVersion/slice/RetireModelVersion" -->
#### 停用模型版本（Retire Model Version） · 业务操作

- **入口:** 模型发布界面（Model Release Screen）
- **角色:** 发布管理员（Release Manager）
- **业务对象:** 模型版本（Model Version）
- **提交操作:** 停用模型版本（Retire Model Version）
- **成功结果:** 模型版本已停用（Model Version Retired）
- **结果状态:** 已停用（Retired）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| modelVersionId | UUID | Single | id, technical | - | - |
| retirementReason | String | Single | - | - | - |
| requestedBy | String | Single | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.模型版本目录（ModelVersionCatalog）" source="domain/FederationLearningPlatform/context/ModelLifecycle/aggregate/ModelVersion/slice/ModelVersionCatalog" -->
#### 模型版本目录（Model Version Catalog） · 查询

- **入口:** 模型版本目录（Model Version Catalog） 查询入口
- **角色:** 系统/未明确
- **业务对象:** 模型版本（Model Version）
- **查询结果:** 模型版本目录（Model Version Catalog）

### 节点运行时健康（Node Runtime Health）

**生命周期:** 健康（Healthy）

<!-- em:section id="prd.section.slice.记录运行时心跳（RecordRuntimeHeartbeat）" source="domain/FederationLearningPlatform/context/RuntimeOperations/aggregate/NodeRuntimeHealth/slice/RecordRuntimeHeartbeat" -->
#### 记录运行时心跳（Record Runtime Heartbeat） · 新增

- **入口:** 运行时监控界面（Runtime Monitor Screen）
- **角色:** 边缘运行时（Edge Runtime）
- **业务对象:** 节点运行时健康（Node Runtime Health）
- **提交操作:** 记录运行时心跳（Record Runtime Heartbeat）
- **成功结果:** 运行时心跳已记录（Runtime Heartbeat Recorded）
- **结果状态:** 健康（Healthy）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| nodeId | UUID | Single | id, technical | - | - |
| federationId | UUID | Single | - | - | - |
| cpuLoad | Decimal | Single | - | - | - |
| gpuLoad | Decimal | Single | - | - | - |
| memoryLoad | Decimal | Single | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.运行时健康仪表板（RuntimeHealthDashboard）" source="domain/FederationLearningPlatform/context/RuntimeOperations/aggregate/NodeRuntimeHealth/slice/RuntimeHealthDashboard" -->
#### 运行时健康仪表板（Runtime Health Dashboard） · 查询

- **入口:** 运行时健康仪表板（Runtime Health Dashboard） 查询入口
- **角色:** 系统/未明确
- **业务对象:** 节点运行时健康（Node Runtime Health）
- **查询结果:** 运行时健康仪表板（Runtime Health Dashboard）

### 训练告警（Training Alert）

**生命周期:** 已触发（Raised）

<!-- em:section id="prd.section.slice.触发训练告警（RaiseTrainingAlert）" source="domain/FederationLearningPlatform/context/RuntimeOperations/aggregate/TrainingAlert/slice/RaiseTrainingAlert" -->
#### 触发训练告警（Raise Training Alert） · 新增

- **入口:** 系统流程/入口未明确
- **角色:** 系统/未明确
- **业务对象:** 训练告警（Training Alert）
- **提交操作:** 触发训练告警（Raise Training Alert）
- **成功结果:** 训练告警已触发（Training Alert Raised）
- **结果状态:** 已触发（Raised）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| alertId | UUID | Single | id, generated, technical | - | - |
| nodeId | UUID | Single | - | - | - |
| trainingJobId | UUID | Optional | - | - | - |
| severity | String | Single | - | - | - |
| message | String | Single | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.训练告警目录（TrainingAlertCatalog）" source="domain/FederationLearningPlatform/context/RuntimeOperations/aggregate/TrainingAlert/slice/TrainingAlertCatalog" -->
#### 训练告警目录（Training Alert Catalog） · 查询

- **入口:** 训练告警目录（Training Alert Catalog） 查询入口
- **角色:** 系统/未明确
- **业务对象:** 训练告警（Training Alert）
- **查询结果:** 训练告警目录（Training Alert Catalog）

### 审计记录（Audit Record）

**生命周期:** 已追加（Appended）

<!-- em:section id="prd.section.slice.追加审计跟踪（AppendAuditTrail）" source="domain/FederationLearningPlatform/context/RuntimeOperations/aggregate/AuditRecord/slice/AppendAuditTrail" -->
#### 追加审计跟踪（Append Audit Trail） · 新增

- **入口:** 系统流程/入口未明确
- **角色:** 系统/未明确
- **业务对象:** 审计记录（Audit Record）
- **提交操作:** 追加审计跟踪（Append Audit Trail）
- **成功结果:** 审计跟踪已追加（Audit Trail Appended）
- **结果状态:** 已追加（Appended）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| auditRecordId | UUID | Single | id, generated, technical | - | - |
| sourceEventName | String | Single | - | - | - |
| sourceEntityId | UUID | Optional | - | - | - |
| severity | String | Single | - | - | - |
| payloadHash | String | Single | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.审计记录日志（AuditRecordLog）" source="domain/FederationLearningPlatform/context/RuntimeOperations/aggregate/AuditRecord/slice/AuditRecordLog" -->
#### 审计记录日志（Audit Record Log） · 查询

- **入口:** 审计记录日志（Audit Record Log） 查询入口
- **角色:** 系统/未明确
- **业务对象:** 审计记录（Audit Record）
- **查询结果:** 审计记录日志（Audit Record Log）

### 节点加密密钥（Node Encryption Key）

**生命周期:** 已生成（Generated） -> 已分发（Distributed） -> 活跃（Active） -> 已撤销（Revoked） -> 已过期（Expired）

<!-- em:section id="prd.section.slice.生成节点密钥（GenerateNodeKey）" source="domain/FederationLearningPlatform/context/KeyAndAttestationManagement/aggregate/NodeEncryptionKey/slice/GenerateNodeKey" -->
#### 生成节点密钥（Generate Node Key） · 新增

- **入口:** 节点密钥管理界面（Node Key Management Screen）
- **角色:** 安全审查员（Security Reviewer）
- **业务对象:** 节点加密密钥（Node Encryption Key）
- **提交操作:** 生成节点密钥（Generate Node Key）
- **成功结果:** 节点密钥已生成（Node Key Generated）
- **结果状态:** 已生成（Generated）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| nodeKeyId | UUID | Single | id, generated, technical | - | - |
| nodeId | UUID | Single | - | - | - |
| keyAlgorithm | String | Single | - | - | - |
| keyPurpose | String | Single | - | - | - |
| publicKeyRef | String | Single | - | - | - |
| keyExpiresAt | DateTime | Single | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.分发节点密钥（DistributeNodeKey）" source="domain/FederationLearningPlatform/context/KeyAndAttestationManagement/aggregate/NodeEncryptionKey/slice/DistributeNodeKey" -->
#### 分发节点密钥（Distribute Node Key） · 业务操作

- **入口:** 系统流程/入口未明确
- **角色:** 系统/未明确
- **业务对象:** 节点加密密钥（Node Encryption Key）
- **提交操作:** 分发节点密钥（Distribute Node Key）
- **成功结果:** 节点密钥已分发（Node Key Distributed）
- **结果状态:** 已分发（Distributed）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| nodeKeyId | UUID | Single | id, technical | - | - |
| nodeId | UUID | Single | - | - | - |
| distributionChannel | String | Single | - | - | - |
| deliveredAt | DateTime | Single | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.激活节点密钥（ActivateNodeKey）" source="domain/FederationLearningPlatform/context/KeyAndAttestationManagement/aggregate/NodeEncryptionKey/slice/ActivateNodeKey" -->
#### 激活节点密钥（Activate Node Key） · 业务操作

- **入口:** 节点密钥管理界面（Node Key Management Screen）
- **角色:** 节点操作员（Node Operator）
- **业务对象:** 节点加密密钥（Node Encryption Key）
- **提交操作:** 激活节点密钥（Activate Node Key）
- **成功结果:** 节点密钥已激活（Node Key Activated）
- **结果状态:** 活跃（Active）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| nodeKeyId | UUID | Single | id, technical | - | - |
| nodeId | UUID | Single | - | - | - |
| activationNote | String | Optional | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.撤销节点密钥（RevokeNodeKey）" source="domain/FederationLearningPlatform/context/KeyAndAttestationManagement/aggregate/NodeEncryptionKey/slice/RevokeNodeKey" -->
#### 撤销节点密钥（Revoke Node Key） · 业务操作

- **入口:** 节点密钥管理界面（Node Key Management Screen）
- **角色:** 安全审查员（Security Reviewer）
- **业务对象:** 节点加密密钥（Node Encryption Key）
- **提交操作:** 撤销节点密钥（Revoke Node Key）
- **成功结果:** 节点密钥已撤销（Node Key Revoked）
- **结果状态:** 已撤销（Revoked）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| nodeKeyId | UUID | Single | id, technical | - | - |
| nodeId | UUID | Single | - | - | - |
| revocationReason | String | Single | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.作废节点密钥（ExpireNodeKey）" source="domain/FederationLearningPlatform/context/KeyAndAttestationManagement/aggregate/NodeEncryptionKey/slice/ExpireNodeKey" -->
#### 作废节点密钥（Expire Node Key） · 业务操作

- **入口:** 系统流程/入口未明确
- **角色:** 系统/未明确
- **业务对象:** 节点加密密钥（Node Encryption Key）
- **提交操作:** 作废节点密钥（Expire Node Key）
- **成功结果:** 节点密钥已过期（Node Key Expired）
- **结果状态:** 已过期（Expired）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| nodeKeyId | UUID | Single | id, technical | - | - |
| nodeId | UUID | Single | - | - | - |
| expiredAt | DateTime | Single | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.节点密钥目录（NodeKeyCatalog）" source="domain/FederationLearningPlatform/context/KeyAndAttestationManagement/aggregate/NodeEncryptionKey/slice/NodeKeyCatalog" -->
#### 节点密钥目录（Node Key Catalog） · 查询

- **入口:** 节点密钥目录（Node Key Catalog） 查询入口
- **角色:** 系统/未明确
- **业务对象:** 节点加密密钥（Node Encryption Key）
- **查询结果:** 节点密钥目录（Node Key Catalog）

### 节点认证报告（Node Attestation Report）

**生命周期:** 已提交（Submitted） -> 已验证（Verified） -> 已过期（Expired） -> 已撤销（Revoked）

<!-- em:section id="prd.section.slice.提交节点认证报告（SubmitNodeAttestationReport）" source="domain/FederationLearningPlatform/context/KeyAndAttestationManagement/aggregate/NodeAttestationReport/slice/SubmitNodeAttestationReport" -->
#### 提交节点认证报告（Submit Node Attestation Report） · 新增

- **入口:** 节点认证提交界面（Node Attestation Submission Screen）
- **角色:** 节点操作员（Node Operator）
- **业务对象:** 节点认证报告（Node Attestation Report）
- **提交操作:** 提交节点认证报告（Submit Node Attestation Report）
- **成功结果:** 节点认证报告已提交（Node Attestation Report Submitted）
- **结果状态:** 已提交（Submitted）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| attestationReportId | UUID | Single | id, generated, technical | - | - |
| nodeId | UUID | Single | - | - | - |
| attestationType | String | Single | - | - | - |
| hardwareFingerprint | String | Single | - | - | - |
| measurementHash | String | Single | - | - | - |
| signedBy | String | Single | - | - | - |
| submittedAt | DateTime | Single | - | - | - |
| expiresAt | DateTime | Single | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.验证节点认证报告（VerifyNodeAttestationReport）" source="domain/FederationLearningPlatform/context/KeyAndAttestationManagement/aggregate/NodeAttestationReport/slice/VerifyNodeAttestationReport" -->
#### 验证节点认证报告（Verify Node Attestation Report） · 业务操作

- **入口:** 节点认证审查界面（Node Attestation Review Screen）
- **角色:** 安全审查员（Security Reviewer）
- **业务对象:** 节点认证报告（Node Attestation Report）
- **提交操作:** 验证节点认证报告（Verify Node Attestation Report）
- **成功结果:** 节点认证报告已验证（Node Attestation Report Verified）
- **结果状态:** 已验证（Verified）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| attestationReportId | UUID | Single | id, technical | - | - |
| nodeId | UUID | Single | - | - | - |
| verificationOutcome | String | Single | - | - | - |
| verificationNote | String | Optional | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.作废节点认证报告（ExpireNodeAttestationReport）" source="domain/FederationLearningPlatform/context/KeyAndAttestationManagement/aggregate/NodeAttestationReport/slice/ExpireNodeAttestationReport" -->
#### 作废节点认证报告（Expire Node Attestation Report） · 业务操作

- **入口:** 系统流程/入口未明确
- **角色:** 系统/未明确
- **业务对象:** 节点认证报告（Node Attestation Report）
- **提交操作:** 作废节点认证报告（Expire Node Attestation Report）
- **成功结果:** 节点认证报告已过期（Node Attestation Report Expired）
- **结果状态:** 已过期（Expired）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| attestationReportId | UUID | Single | id, technical | - | - |
| nodeId | UUID | Single | - | - | - |
| expiredAt | DateTime | Single | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.撤销节点认证报告（RevokeNodeAttestationReport）" source="domain/FederationLearningPlatform/context/KeyAndAttestationManagement/aggregate/NodeAttestationReport/slice/RevokeNodeAttestationReport" -->
#### 撤销节点认证报告（Revoke Node Attestation Report） · 业务操作

- **入口:** 节点认证审查界面（Node Attestation Review Screen）
- **角色:** 安全审查员（Security Reviewer）
- **业务对象:** 节点认证报告（Node Attestation Report）
- **提交操作:** 撤销节点认证报告（Revoke Node Attestation Report）
- **成功结果:** 节点认证报告已撤销（Node Attestation Report Revoked）
- **结果状态:** 已撤销（Revoked）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| attestationReportId | UUID | Single | id, technical | - | - |
| nodeId | UUID | Single | - | - | - |
| revokeReason | String | Single | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.节点认证目录（NodeAttestationCatalog）" source="domain/FederationLearningPlatform/context/KeyAndAttestationManagement/aggregate/NodeAttestationReport/slice/NodeAttestationCatalog" -->
#### 节点认证目录（Node Attestation Catalog） · 查询

- **入口:** 节点认证目录（Node Attestation Catalog） 查询入口
- **角色:** 系统/未明确
- **业务对象:** 节点认证报告（Node Attestation Report）
- **查询结果:** 节点认证目录（Node Attestation Catalog）

### 安全聚合密钥（Secure Aggregation Key）

**生命周期:** 已生成（Generated） -> 已分发（Distributed） -> 已使用（Used） -> 已撤销（Revoked）

<!-- em:section id="prd.section.slice.生成安全聚合密钥（GenerateSecureAggregationKey）" source="domain/FederationLearningPlatform/context/KeyAndAttestationManagement/aggregate/SecureAggregationKey/slice/GenerateSecureAggregationKey" -->
#### 生成安全聚合密钥（Generate Secure Aggregation Key） · 新增

- **入口:** 安全聚合密钥界面（Secure Aggregation Key Screen）
- **角色:** MLOps 工程师（MLOps Engineer）
- **业务对象:** 安全聚合密钥（Secure Aggregation Key）
- **提交操作:** 生成安全聚合密钥（Generate Secure Aggregation Key）
- **成功结果:** 安全聚合密钥已生成（Secure Aggregation Key Generated）
- **结果状态:** 已生成（Generated）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| aggregationKeyId | UUID | Single | id, generated, technical | - | - |
| trainingJobId | UUID | Single | - | - | - |
| trainingRunConfigurationId | UUID | Single | - | - | - |
| aggregationAlgorithm | String | Single | - | - | - |
| keyAlgorithm | String | Single | - | - | - |
| shareCount | Int | Single | - | - | - |
| quorumThreshold | Int | Single | - | - | - |
| generatedAt | DateTime | Single | - | - | - |
| expiresAt | DateTime | Single | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.分发密钥份额（DistributeKeyShare）" source="domain/FederationLearningPlatform/context/KeyAndAttestationManagement/aggregate/SecureAggregationKey/slice/DistributeKeyShare" -->
#### 分发密钥份额（Distribute Key Share） · 业务操作

- **入口:** 安全聚合密钥界面（Secure Aggregation Key Screen）
- **角色:** MLOps 工程师（MLOps Engineer）
- **业务对象:** 安全聚合密钥（Secure Aggregation Key）
- **提交操作:** 分发密钥份额（Distribute Key Share）
- **成功结果:** 安全聚合密钥份额已分发（Secure Aggregation Key Share Distributed）
- **结果状态:** 已分发（Distributed）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| aggregationKeyId | UUID | Single | id, technical | - | - |
| trainingJobId | UUID | Single | - | - | - |
| nodeId | UUID | Single | - | - | - |
| shareIndex | Int | Single | - | - | - |
| shareMaterialRef | String | Single | - | - | - |
| distributedAt | DateTime | Single | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.标记安全聚合密钥已使用（MarkSecureAggregationKeyUsed）" source="domain/FederationLearningPlatform/context/KeyAndAttestationManagement/aggregate/SecureAggregationKey/slice/MarkSecureAggregationKeyUsed" -->
#### 标记安全聚合密钥已使用（Mark Secure Aggregation Key Used） · 业务操作

- **入口:** 系统流程/入口未明确
- **角色:** 系统/未明确
- **业务对象:** 安全聚合密钥（Secure Aggregation Key）
- **提交操作:** 标记安全聚合密钥已使用（Mark Secure Aggregation Key Used）
- **成功结果:** 安全聚合密钥已使用（Secure Aggregation Key Used）
- **结果状态:** 已使用（Used）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| aggregationKeyId | UUID | Single | id, technical | - | - |
| trainingJobId | UUID | Single | - | - | - |
| roundId | UUID | Single | - | - | - |
| usedAt | DateTime | Single | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.撤销安全聚合密钥（RevokeSecureAggregationKey）" source="domain/FederationLearningPlatform/context/KeyAndAttestationManagement/aggregate/SecureAggregationKey/slice/RevokeSecureAggregationKey" -->
#### 撤销安全聚合密钥（Revoke Secure Aggregation Key） · 业务操作

- **入口:** 安全聚合密钥界面（Secure Aggregation Key Screen）
- **角色:** 安全审查员（Security Reviewer）
- **业务对象:** 安全聚合密钥（Secure Aggregation Key）
- **提交操作:** 撤销安全聚合密钥（Revoke Secure Aggregation Key）
- **成功结果:** 安全聚合密钥已撤销（Secure Aggregation Key Revoked）
- **结果状态:** 已撤销（Revoked）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| aggregationKeyId | UUID | Single | id, technical | - | - |
| trainingJobId | UUID | Single | - | - | - |
| revokeReason | String | Single | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.安全聚合密钥目录（SecureAggregationKeyCatalog）" source="domain/FederationLearningPlatform/context/KeyAndAttestationManagement/aggregate/SecureAggregationKey/slice/SecureAggregationKeyCatalog" -->
#### 安全聚合密钥目录（Secure Aggregation Key Catalog） · 查询

- **入口:** 安全聚合密钥目录（Secure Aggregation Key Catalog） 查询入口
- **角色:** 系统/未明确
- **业务对象:** 安全聚合密钥（Secure Aggregation Key）
- **查询结果:** 安全聚合密钥目录（Secure Aggregation Key Catalog）

### 安全聚合轮次（Secure Aggregation Round）

**生命周期:** 已初始化（Initialized） -> 份额已分发（Shares Distributed） -> 份额已收集（Shares Collected） -> 已聚合（Aggregated） -> 已撤销（Revoked）

<!-- em:section id="prd.section.slice.初始化安全聚合轮次（InitializeSecureAggregationRound）" source="domain/FederationLearningPlatform/context/KeyAndAttestationManagement/aggregate/SecureAggregationRound/slice/InitializeSecureAggregationRound" -->
#### 初始化安全聚合轮次（Initialize Secure Aggregation Round） · 新增

- **入口:** 系统流程/入口未明确
- **角色:** 系统/未明确
- **业务对象:** 安全聚合轮次（Secure Aggregation Round）
- **提交操作:** 初始化安全聚合轮次（Initialize Secure Aggregation Round）
- **成功结果:** 安全聚合轮次已初始化（Secure Aggregation Round Initialized）
- **结果状态:** 已初始化（Initialized）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| aggregationRoundId | UUID | Single | id, generated, technical | - | - |
| trainingJobId | UUID | Single | - | - | - |
| trainingRunConfigurationId | UUID | Single | - | - | - |
| roundId | UUID | Single | - | - | - |
| aggregationProvider | String | Single | - | - | - |
| shareAlgorithm | String | Single | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.分发聚合掩码份额（DistributeAggregationMaskShares）" source="domain/FederationLearningPlatform/context/KeyAndAttestationManagement/aggregate/SecureAggregationRound/slice/DistributeAggregationMaskShares" -->
#### 分发聚合掩码份额（Distribute Aggregation Mask Shares） · 业务操作

- **入口:** 系统流程/入口未明确
- **角色:** 安全聚合服务（Secure Aggregation Service）
- **业务对象:** 安全聚合轮次（Secure Aggregation Round）
- **提交操作:** 分发聚合掩码份额（Distribute Aggregation Mask Shares）
- **成功结果:** 聚合掩码份额已分发（Aggregation Mask Share Distributed）
- **结果状态:** 份额已分发（Shares Distributed）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| aggregationRoundId | UUID | Single | id, technical | - | - |
| trainingJobId | UUID | Single | - | - | - |
| roundId | UUID | Single | - | - | - |
| nodeId | UUID | Single | - | - | - |
| maskShareArtifactId | UUID | Single | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.收集聚合掩码份额（CollectAggregationMaskShares）" source="domain/FederationLearningPlatform/context/KeyAndAttestationManagement/aggregate/SecureAggregationRound/slice/CollectAggregationMaskShares" -->
#### 收集聚合掩码份额（Collect Aggregation Mask Shares） · 业务操作

- **入口:** 系统流程/入口未明确
- **角色:** 安全聚合服务（Secure Aggregation Service）
- **业务对象:** 安全聚合轮次（Secure Aggregation Round）
- **提交操作:** 收集聚合掩码份额（Collect Aggregation Mask Shares）
- **成功结果:** 聚合掩码份额已收集（Aggregation Mask Shares Collected）
- **结果状态:** 份额已收集（Shares Collected）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| aggregationRoundId | UUID | Single | id, technical | - | - |
| trainingJobId | UUID | Single | - | - | - |
| roundId | UUID | Single | - | - | - |
| collectedNodeCount | Int | Single | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.完成安全聚合解密（CompleteSecureAggregationDecrypt）" source="domain/FederationLearningPlatform/context/KeyAndAttestationManagement/aggregate/SecureAggregationRound/slice/CompleteSecureAggregationDecrypt" -->
#### 完成安全聚合解密（Complete Secure Aggregation Decrypt） · 业务操作

- **入口:** 系统流程/入口未明确
- **角色:** 系统/未明确
- **业务对象:** 安全聚合轮次（Secure Aggregation Round）
- **提交操作:** 完成安全聚合解密（Complete Secure Aggregation Decrypt）
- **成功结果:** 安全聚合已解密（Secure Aggregation Decrypted）
- **结果状态:** 已聚合（Aggregated）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| aggregationRoundId | UUID | Single | id, technical | - | - |
| trainingJobId | UUID | Single | - | - | - |
| roundId | UUID | Single | - | - | - |
| aggregatedModelVersionId | UUID | Single | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.撤销安全聚合轮次（RevokeSecureAggregationRound）" source="domain/FederationLearningPlatform/context/KeyAndAttestationManagement/aggregate/SecureAggregationRound/slice/RevokeSecureAggregationRound" -->
#### 撤销安全聚合轮次（Revoke Secure Aggregation Round） · 业务操作

- **入口:** 安全聚合界面（Secure Aggregation Screen）
- **角色:** 安全审查员（Security Reviewer）
- **业务对象:** 安全聚合轮次（Secure Aggregation Round）
- **提交操作:** 撤销安全聚合轮次（Revoke Secure Aggregation Round）
- **成功结果:** 安全聚合轮次已撤销（Secure Aggregation Round Revoked）
- **结果状态:** 已撤销（Revoked）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| aggregationRoundId | UUID | Single | id, technical | - | - |
| trainingJobId | UUID | Single | - | - | - |
| roundId | UUID | Single | - | - | - |
| revocationReason | String | Single | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.安全聚合轮次目录（SecureAggregationRoundCatalog）" source="domain/FederationLearningPlatform/context/KeyAndAttestationManagement/aggregate/SecureAggregationRound/slice/SecureAggregationRoundCatalog" -->
#### 安全聚合轮次目录（Secure Aggregation Round Catalog） · 查询

- **入口:** 安全聚合轮次目录（Secure Aggregation Round Catalog） 查询入口
- **角色:** 系统/未明确
- **业务对象:** 安全聚合轮次（Secure Aggregation Round）
- **查询结果:** 安全聚合轮次目录（Secure Aggregation Round Catalog）

### 数据集访问凭证（Dataset Access Credential）

**生命周期:** 已签发（Issued） -> 已轮换（Rotated） -> 已撤销（Revoked）

<!-- em:section id="prd.section.slice.签发数据集访问凭证（IssueDatasetAccessCredential）" source="domain/FederationLearningPlatform/context/KeyAndAttestationManagement/aggregate/DatasetAccessCredential/slice/IssueDatasetAccessCredential" -->
#### 签发数据集访问凭证（Issue Dataset Access Credential） · 新增

- **入口:** 数据集访问凭证界面（Dataset Access Credential Screen）
- **角色:** 节点操作员（Node Operator）
- **业务对象:** 数据集访问凭证（Dataset Access Credential）
- **提交操作:** 签发数据集访问凭证（Issue Dataset Access Credential）
- **成功结果:** 数据集访问凭证已签发（Dataset Access Credential Issued）
- **结果状态:** 已签发（Issued）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| credentialId | UUID | Single | id, generated, technical | - | - |
| accessProfileId | UUID | Single | - | - | - |
| datasetId | UUID | Single | - | - | - |
| nodeId | UUID | Single | - | - | - |
| runtimeId | UUID | Single | - | - | - |
| credentialAlgorithm | String | Single | - | - | - |
| keyMaterialRef | String | Single | - | - | - |
| issuedAt | DateTime | Single | - | - | - |
| expiresAt | DateTime | Single | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.轮换数据集访问凭证（RotateDatasetAccessCredential）" source="domain/FederationLearningPlatform/context/KeyAndAttestationManagement/aggregate/DatasetAccessCredential/slice/RotateDatasetAccessCredential" -->
#### 轮换数据集访问凭证（Rotate Dataset Access Credential） · 业务操作

- **入口:** 数据集访问凭证界面（Dataset Access Credential Screen）
- **角色:** 节点操作员（Node Operator）
- **业务对象:** 数据集访问凭证（Dataset Access Credential）
- **提交操作:** 轮换数据集访问凭证（Rotate Dataset Access Credential）
- **成功结果:** 数据集访问凭证已轮换（Dataset Access Credential Rotated）
- **结果状态:** 已轮换（Rotated）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| credentialId | UUID | Single | id, technical | - | - |
| accessProfileId | UUID | Single | - | - | - |
| previousCredentialId | UUID | Single | - | - | - |
| credentialAlgorithm | String | Single | - | - | - |
| keyMaterialRef | String | Single | - | - | - |
| issuedAt | DateTime | Single | - | - | - |
| expiresAt | DateTime | Single | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.撤销数据集访问凭证（RevokeDatasetAccessCredential）" source="domain/FederationLearningPlatform/context/KeyAndAttestationManagement/aggregate/DatasetAccessCredential/slice/RevokeDatasetAccessCredential" -->
#### 撤销数据集访问凭证（Revoke Dataset Access Credential） · 业务操作

- **入口:** 数据集访问凭证界面（Dataset Access Credential Screen）
- **角色:** 合规官（Compliance Officer）
- **业务对象:** 数据集访问凭证（Dataset Access Credential）
- **提交操作:** 撤销数据集访问凭证（Revoke Dataset Access Credential）
- **成功结果:** 数据集访问凭证已撤销（Dataset Access Credential Revoked）
- **结果状态:** 已撤销（Revoked）

**输入字段**

| 字段 | 类型 | 数量 | 约束 | 示例 | 来源/规则 |
| --- | --- | --- | --- | --- | --- |
| credentialId | UUID | Single | id, technical | - | - |
| accessProfileId | UUID | Single | - | - | - |
| revokeReason | String | Single | - | - | - |

> 该操作尚未定义明确的验收 specification，以下验收矩阵仅依据 command、event 和 state 推导，需在评审时确认。

<!-- em:section id="prd.section.slice.数据集访问凭证目录（DatasetAccessCredentialCatalog）" source="domain/FederationLearningPlatform/context/KeyAndAttestationManagement/aggregate/DatasetAccessCredential/slice/DatasetAccessCredentialCatalog" -->
#### 数据集访问凭证目录（Dataset Access Credential Catalog） · 查询

- **入口:** 数据集访问凭证目录（Dataset Access Credential Catalog） 查询入口
- **角色:** 系统/未明确
- **业务对象:** 数据集访问凭证（Dataset Access Credential）
- **查询结果:** 数据集访问凭证目录（Dataset Access Credential Catalog）

<!-- em:section id="prd.section.acceptanceMatrix" -->
## 验收矩阵

| 编号 | 功能 | 前置条件 | 操作 | 预期结果 | 验收来源 |
| --- | --- | --- | --- | --- | --- |
| AC-001 | 创建联邦（Create Federation） | 联邦（Federation） 满足执行该操作的状态条件 | 平台管理员（Platform Admin） 提交 创建联邦（Create Federation） | 启动生命周期 联邦（Federation）; 产生事件 联邦已创建（Federation Created）; 状态变为 草稿（Draft） | command 创建联邦（Create Federation）; event 联邦已创建（Federation Created）; state 草稿（Draft） |
| AC-002 | 联邦概览（Federation Overview） | 满足业务前置条件，具体规则待确认 | 用户访问 联邦概览（Federation Overview） 查询入口 | 展示 联邦概览（Federation Overview） | readmodel 联邦概览（Federation Overview） |
| AC-003 | 邀请参与者（Invite Participant） | 满足业务前置条件，具体规则待确认 | 联邦所有者（Federation Owner） 提交 邀请参与者（Invite Participant） | 产生事件 参与者已邀请（Participant Invited） | command 邀请参与者（Invite Participant）; event 参与者已邀请（Participant Invited） |
| AC-004 | 批准参与者（Approve Participant） | 联邦（Federation） 满足执行该操作的状态条件 | 治理审查员（Governance Reviewer） 提交 批准参与者（Approve Participant） | 产生事件 参与者已加入（Participant Joined）; 状态变为 活跃（Active） | command 批准参与者（Approve Participant）; event 参与者已加入（Participant Joined）; state 活跃（Active） |
| AC-005 | 拒绝参与者（Reject Participant） | 满足业务前置条件，具体规则待确认 | 治理审查员（Governance Reviewer） 提交 拒绝参与者（Reject Participant） | 产生事件 参与者已拒绝（Participant Rejected） | command 拒绝参与者（Reject Participant）; event 参与者已拒绝（Participant Rejected） |
| AC-006 | 撤销参与者邀请（Revoke Participant Invitation） | 满足业务前置条件，具体规则待确认 | 联邦所有者（Federation Owner） 提交 撤销参与者邀请（Revoke Participant Invitation） | 产生事件 参与者邀请已撤销（Participant Invitation Revoked） | command 撤销参与者邀请（Revoke Participant Invitation）; event 参与者邀请已撤销（Participant Invitation Revoked） |
| AC-007 | 暂停参与者（Suspend Participant） | 满足业务前置条件，具体规则待确认 | 治理审查员（Governance Reviewer） 提交 暂停参与者（Suspend Participant） | 产生事件 参与者已暂停（Participant Suspended） | command 暂停参与者（Suspend Participant）; event 参与者已暂停（Participant Suspended） |
| AC-008 | 移除参与者（Remove Participant） | 满足业务前置条件，具体规则待确认 | 治理审查员（Governance Reviewer） 提交 移除参与者（Remove Participant） | 产生事件 参与者已移除（Participant Removed） | command 移除参与者（Remove Participant）; event 参与者已移除（Participant Removed） |
| AC-009 | 联邦成员目录（Federation Membership Directory） | 满足业务前置条件，具体规则待确认 | 用户访问 联邦成员目录（Federation Membership Directory） 查询入口 | 展示 联邦成员目录（Federation Membership Directory） | readmodel 联邦成员目录（Federation Membership Directory） |
| AC-010 | 注册计算节点（Register Compute Node） | 计算节点（Compute Node） 满足执行该操作的状态条件 | 节点操作员（Node Operator） 提交 注册计算节点（Register Compute Node） | 启动生命周期 计算节点（Compute Node）; 产生事件 计算节点已注册（Compute Node Registered）; 状态变为 已注册（Registered） | command 注册计算节点（Register Compute Node）; event 计算节点已注册（Compute Node Registered）; state 已注册（Registered） |
| AC-011 | 更新节点能力（Update Node Capability） | 计算节点（Compute Node） 满足执行该操作的状态条件 | 节点操作员（Node Operator） 提交 更新节点能力（Update Node Capability） | 产生事件 节点能力已更新（Node Capability Updated）; 状态变为 能力已声明（Capability Declared） | command 更新节点能力（Update Node Capability）; event 节点能力已更新（Node Capability Updated）; state 能力已声明（Capability Declared） |
| AC-012 | 信任计算节点（Trust Compute Node） | 计算节点（Compute Node） 满足执行该操作的状态条件 | 安全审查员（Security Reviewer） 提交 信任计算节点（Trust Compute Node） | 产生事件 计算节点已信任（Compute Node Trusted）; 状态变为 已信任（Trusted） | command 信任计算节点（Trust Compute Node）; event 计算节点已信任（Compute Node Trusted）; state 已信任（Trusted） |
| AC-013 | 暂停计算节点（Suspend Compute Node） | 计算节点（Compute Node） 满足执行该操作的状态条件 | 安全审查员（Security Reviewer） 提交 暂停计算节点（Suspend Compute Node） | 产生事件 计算节点已暂停（Compute Node Suspended）; 状态变为 已暂停（Suspended） | command 暂停计算节点（Suspend Compute Node）; event 计算节点已暂停（Compute Node Suspended）; state 已暂停（Suspended） |
| AC-014 | 计算节点目录（Compute Node Catalog） | 满足业务前置条件，具体规则待确认 | 用户访问 计算节点目录（Compute Node Catalog） 查询入口 | 展示 计算节点目录（Compute Node Catalog） | readmodel 计算节点目录（Compute Node Catalog） |
| AC-015 | 注册组织（Register Organization） | 组织已注册（Organization Registered） | 注册组织（Register Organization） | 拒绝: 组织已存在 | specification 拒绝重复组织（Reject Duplicate Organization）; 验证 unique Organization.organizationName |
| AC-016 | 验证组织身份（Verify Organization Identity） | Concept:组织（Organization） 满足执行该操作的状态条件 | 合规官（Compliance Officer） 提交 验证组织身份（Verify Organization Identity） | 产生事件 组织身份已验证（Organization Identity Verified）; 状态变为 身份已验证（Identity Verified） | command 验证组织身份（Verify Organization Identity）; event 组织身份已验证（Organization Identity Verified）; state 身份已验证（Identity Verified） |
| AC-017 | 激活组织（Activate Organization） | Concept:组织（Organization） 满足执行该操作的状态条件 | 平台管理员（Platform Admin） 提交 激活组织（Activate Organization） | 产生事件 组织已激活（Organization Activated）; 状态变为 活跃（Active） | command 激活组织（Activate Organization）; event 组织已激活（Organization Activated）; state 活跃（Active） |
| AC-018 | 停用组织（Deactivate Organization） | Concept:组织（Organization） 满足执行该操作的状态条件 | 平台管理员（Platform Admin） 提交 停用组织（Deactivate Organization） | 产生事件 组织已停用（Organization Deactivated）; 状态变为 已停用（Deactivated） | command 停用组织（Deactivate Organization）; event 组织已停用（Organization Deactivated）; state 已停用（Deactivated） |
| AC-019 | 组织目录（Organization Directory） | 满足业务前置条件，具体规则待确认 | 用户访问 组织目录（Organization Directory） | 展示 组织目录（Organization Directory） | readmodel 组织目录（Organization Directory） |
| AC-020 | 定义特征架构（Define Feature Schema） | 特征架构（Feature Schema） 满足执行该操作的状态条件 | 数据管理员（Data Steward） 提交 定义特征架构（Define Feature Schema） | 启动生命周期 特征架构（Feature Schema）; 产生事件 特征架构已发布（Feature Schema Published）; 状态变为 已发布（Published） | command 定义特征架构（Define Feature Schema）; event 特征架构已发布（Feature Schema Published）; state 已发布（Published） |
| AC-021 | 特征架构目录（Feature Schema Catalog） | 满足业务前置条件，具体规则待确认 | 用户访问 特征架构目录（Feature Schema Catalog） 查询入口 | 展示 特征架构目录（Feature Schema Catalog） | readmodel 特征架构目录（Feature Schema Catalog） |
| AC-022 | 注册数据集（Register Dataset） | 数据集（Dataset） 满足执行该操作的状态条件 | 数据所有者（Data Owner） 提交 注册数据集（Register Dataset） | 启动生命周期 数据集（Dataset）; 产生事件 数据集已注册（Dataset Registered）; 状态变为 已注册（Registered） | command 注册数据集（Register Dataset）; event 数据集已注册（Dataset Registered）; state 已注册（Registered） |
| AC-023 | 验证数据集合约（Validate Dataset Contract） | 数据集（Dataset） 满足执行该操作的状态条件 | 系统/用户 提交 验证数据集合约（Validate Dataset Contract） | 产生事件 数据集合约已验证（Dataset Contract Validated）; 状态变为 合约已验证（Contract Validated） | command 验证数据集合约（Validate Dataset Contract）; event 数据集合约已验证（Dataset Contract Validated）; state 合约已验证（Contract Validated） |
| AC-024 | 拒绝数据集用于训练（Reject Dataset For Training） | 数据集（Dataset） 满足执行该操作的状态条件 | 合规官（Compliance Officer） 提交 拒绝数据集用于训练（Reject Dataset For Training） | 产生事件 数据集已拒绝用于训练（Dataset Rejected For Training）; 状态变为 已拒绝（Rejected） | command 拒绝数据集用于训练（Reject Dataset For Training）; event 数据集已拒绝用于训练（Dataset Rejected For Training）; state 已拒绝（Rejected） |
| AC-025 | 批准数据集用于训练（Approve Dataset For Training） | 数据集（Dataset） 满足执行该操作的状态条件 | 合规官（Compliance Officer） 提交 批准数据集用于训练（Approve Dataset For Training） | 产生事件 数据集已批准用于训练（Dataset Approved For Training）; 状态变为 已批准（Approved） | command 批准数据集用于训练（Approve Dataset For Training）; event 数据集已批准用于训练（Dataset Approved For Training）; state 已批准（Approved） |
| AC-026 | 作废数据集训练审批（Expire Dataset Training Approval） | 数据集（Dataset） 满足执行该操作的状态条件 | 系统/用户 提交 作废数据集训练审批（Expire Dataset Training Approval） | 产生事件 数据集训练审批已过期（Dataset Training Approval Expired）; 状态变为 审批已过期（Approval Expired） | command 作废数据集训练审批（Expire Dataset Training Approval）; event 数据集训练审批已过期（Dataset Training Approval Expired）; state 审批已过期（Approval Expired） |
| AC-027 | 撤销数据集训练审批（Revoke Dataset Training Approval） | 数据集（Dataset） 满足执行该操作的状态条件 | 合规官（Compliance Officer） 提交 撤销数据集训练审批（Revoke Dataset Training Approval） | 产生事件 数据集训练审批已撤销（Dataset Training Approval Revoked）; 状态变为 审批已撤销（Approval Revoked） | command 撤销数据集训练审批（Revoke Dataset Training Approval）; event 数据集训练审批已撤销（Dataset Training Approval Revoked）; state 审批已撤销（Approval Revoked） |
| AC-028 | 数据集能力（Dataset Capability） | 满足业务前置条件，具体规则待确认 | 用户访问 数据集能力（Dataset Capability） 查询入口 | 展示 数据集能力（Dataset Capability） | readmodel 数据集能力（Dataset Capability） |
| AC-029 | 配置数据集访问配置（Configure Dataset Access Profile） | 数据集访问配置（Dataset Access Profile） 满足执行该操作的状态条件 | 节点操作员（Node Operator） 提交 配置数据集访问配置（Configure Dataset Access Profile） | 启动生命周期 数据集访问配置（Dataset Access Profile）; 产生事件 数据集访问配置已配置（Dataset Access Profile Configured）; 状态变为 已配置（Configured） | command 配置数据集访问配置（Configure Dataset Access Profile）; event 数据集访问配置已配置（Dataset Access Profile Configured）; state 已配置（Configured） |
| AC-030 | 请求运行时数据集访问验证（Request Runtime Dataset Access Validation） | 数据集访问配置（Dataset Access Profile） 满足执行该操作的状态条件 | 系统/用户 提交 请求运行时数据集访问验证（Request Runtime Dataset Access Validation） | 产生事件 数据集访问验证已请求（Dataset Access Validation Requested）; 状态变为 验证已请求（Validation Requested） | command 请求运行时数据集访问验证（Request Runtime Dataset Access Validation）; event 数据集访问验证已请求（Dataset Access Validation Requested）; state 验证已请求（Validation Requested） |
| AC-031 | 完成运行时数据集访问验证（Complete Runtime Dataset Access Validation） | 数据集访问配置（Dataset Access Profile） 满足执行该操作的状态条件 | 系统/用户 提交 完成运行时数据集访问验证（Complete Runtime Dataset Access Validation） | 产生事件 运行时数据集访问已验证（Runtime Dataset Access Validated）; 状态变为 已验证（Validated） | command 完成运行时数据集访问验证（Complete Runtime Dataset Access Validation）; event 运行时数据集访问已验证（Runtime Dataset Access Validated）; state 已验证（Validated） |
| AC-032 | 数据集运行时访问目录（Dataset Runtime Access Catalog） | 满足业务前置条件，具体规则待确认 | 用户访问 数据集运行时访问目录（Dataset Runtime Access Catalog） 查询入口 | 展示 数据集运行时访问目录（Dataset Runtime Access Catalog） | readmodel 数据集运行时访问目录（Dataset Runtime Access Catalog） |
| AC-033 | 声明训练评估数据集（Declare Training Evaluation Datasets） | 训练评估数据集包（Training Evaluation Dataset Bundle） 满足执行该操作的状态条件 | 数据所有者（Data Owner） 提交 声明训练评估数据集（Declare Training Evaluation Datasets） | 启动生命周期 训练评估数据集包（Training Evaluation Dataset Bundle）; 产生事件 训练评估数据集已声明（Training Evaluation Datasets Declared）; 状态变为 已声明（Declared） | command 声明训练评估数据集（Declare Training Evaluation Datasets）; event 训练评估数据集已声明（Training Evaluation Datasets Declared）; state 已声明（Declared） |
| AC-034 | 训练评估数据集目录（Training Evaluation Dataset Catalog） | 满足业务前置条件，具体规则待确认 | 用户访问 训练评估数据集目录（Training Evaluation Dataset Catalog） 查询入口 | 展示 训练评估数据集目录（Training Evaluation Dataset Catalog） | readmodel 训练评估数据集目录（Training Evaluation Dataset Catalog） |
| AC-035 | 定义训练运行配置（Define Training Run Configuration） | 训练运行配置（Training Run Configuration） 满足执行该操作的状态条件 | MLOps 工程师（MLOps Engineer） 提交 定义训练运行配置（Define Training Run Configuration） | 启动生命周期 训练运行配置（Training Run Configuration）; 产生事件 训练运行配置已定义（Training Run Configuration Defined）; 状态变为 草稿（Draft） | command 定义训练运行配置（Define Training Run Configuration）; event 训练运行配置已定义（Training Run Configuration Defined）; state 草稿（Draft） |
| AC-036 | 验证训练运行配置（Validate Training Run Configuration） | 训练运行配置（Training Run Configuration） 满足执行该操作的状态条件 | 系统/用户 提交 验证训练运行配置（Validate Training Run Configuration） | 产生事件 训练运行配置已验证（Training Run Configuration Validated）; 状态变为 已验证（Validated） | command 验证训练运行配置（Validate Training Run Configuration）; event 训练运行配置已验证（Training Run Configuration Validated）; state 已验证（Validated） |
| AC-037 | 锁定训练运行配置（Lock Training Run Configuration） | 训练运行配置（Training Run Configuration） 满足执行该操作的状态条件 | 系统/用户 提交 锁定训练运行配置（Lock Training Run Configuration） | 产生事件 训练运行配置已锁定（Training Run Configuration Locked）; 状态变为 已锁定（Locked） | command 锁定训练运行配置（Lock Training Run Configuration）; event 训练运行配置已锁定（Training Run Configuration Locked）; state 已锁定（Locked） |
| AC-038 | 训练运行配置目录（Training Run Configuration Catalog） | 满足业务前置条件，具体规则待确认 | 用户访问 训练运行配置目录（Training Run Configuration Catalog） 查询入口 | 展示 训练运行配置目录（Training Run Configuration Catalog） | readmodel 训练运行配置目录（Training Run Configuration Catalog） |
| AC-039 | 创建训练任务（Create Training Job） | 训练任务（Training Job） 满足执行该操作的状态条件 | 研究负责人（Research Lead） 提交 创建训练任务（Create Training Job） | 启动生命周期 训练任务（Training Job）; 产生事件 训练任务已创建（Training Job Created）; 状态变为 草稿（Draft） | command 创建训练任务（Create Training Job）; event 训练任务已创建（Training Job Created）; state 草稿（Draft） |
| AC-040 | 配置训练策略（Configure Training Strategy） | 训练任务（Training Job） 满足执行该操作的状态条件 | MLOps 工程师（MLOps Engineer） 提交 配置训练策略（Configure Training Strategy） | 产生事件 训练策略已配置（Training Strategy Configured）; 状态变为 策略已配置（Strategy Configured） | command 配置训练策略（Configure Training Strategy）; event 训练策略已配置（Training Strategy Configured）; state 策略已配置（Strategy Configured） |
| AC-041 | 提交训练任务（Submit Training Job） | 训练任务（Training Job） 满足执行该操作的状态条件 | 研究负责人（Research Lead） 提交 提交训练任务（Submit Training Job） | 产生事件 训练任务已提交（Training Job Submitted）; 状态变为 已提交（Submitted） | command 提交训练任务（Submit Training Job）; event 训练任务已提交（Training Job Submitted）; state 已提交（Submitted） |
| AC-042 | 请求节点参与（Request Node Participation） | 训练任务（Training Job） 满足执行该操作的状态条件 | 系统/用户 提交 请求节点参与（Request Node Participation） | 产生事件 节点参与已请求（Node Participation Requested）; 状态变为 正在招募节点（Recruiting Nodes） | command 请求节点参与（Request Node Participation）; event 节点参与已请求（Node Participation Requested）; state 正在招募节点（Recruiting Nodes） |
| AC-043 | 接受节点参与（Accept Node Participation） | 满足业务前置条件，具体规则待确认 | 节点操作员（Node Operator） 提交 接受节点参与（Accept Node Participation） | 产生事件 节点已就绪可用于训练（Node Ready For Training） | command 接受节点参与（Accept Node Participation）; event 节点已就绪可用于训练（Node Ready For Training） |
| AC-044 | 训练参与者资格（Training Participant Eligibility） | 满足业务前置条件，具体规则待确认 | 用户访问 训练参与者资格（Training Participant Eligibility） 查询入口 | 展示 训练参与者资格（Training Participant Eligibility） | readmodel 训练参与者资格（Training Participant Eligibility） |
| AC-045 | 跟踪训练任务运行中（Track Training Job Running） | 训练任务（Training Job） 满足执行该操作的状态条件 | 系统/用户 提交 标记训练任务运行中（Mark Training Job Running） | 产生事件 训练任务运行中（Training Job Running）; 状态变为 运行中（Running） | command 标记训练任务运行中（Mark Training Job Running）; event 训练任务运行中（Training Job Running）; state 运行中（Running） |
| AC-046 | 暂停训练任务（Pause Training Job） | 训练任务（Training Job） 满足执行该操作的状态条件 | MLOps 工程师（MLOps Engineer） 提交 暂停训练任务（Pause Training Job） | 产生事件 训练任务已暂停（Training Job Paused）; 状态变为 已暂停（Paused） | command 暂停训练任务（Pause Training Job）; event 训练任务已暂停（Training Job Paused）; state 已暂停（Paused） |
| AC-047 | 恢复训练任务（Resume Training Job） | 训练任务（Training Job） 满足执行该操作的状态条件 | MLOps 工程师（MLOps Engineer） 提交 恢复训练任务（Resume Training Job） | 产生事件 训练任务已恢复（Training Job Resumed）; 状态变为 运行中（Running） | command 恢复训练任务（Resume Training Job）; event 训练任务已恢复（Training Job Resumed）; state 运行中（Running） |
| AC-048 | 取消训练任务（Cancel Training Job） | 训练任务（Training Job） 满足执行该操作的状态条件 | MLOps 工程师（MLOps Engineer） 提交 取消训练任务（Cancel Training Job） | 产生事件 训练任务已取消（Training Job Canceled）; 状态变为 已取消（Canceled） | command 取消训练任务（Cancel Training Job）; event 训练任务已取消（Training Job Canceled）; state 已取消（Canceled） |
| AC-049 | 安排下一训练轮次（Schedule Next Training Round） | 满足业务前置条件，具体规则待确认 | 用户访问 系统流程/入口未明确 | 结果待业务确认 | slice 语义 |
| AC-050 | 完成训练任务（Complete Training Job） | 训练任务（Training Job） 满足执行该操作的状态条件 | 系统/用户 提交 完成训练任务（Complete Training Job） | 产生事件 训练任务已完成（Training Job Completed）; 状态变为 已完成（Completed） | command 完成训练任务（Complete Training Job）; event 训练任务已完成（Training Job Completed）; state 已完成（Completed） |
| AC-051 | 训练任务仪表板（Training Job Dashboard） | 满足业务前置条件，具体规则待确认 | 用户访问 训练任务仪表板（Training Job Dashboard） 查询入口 | 展示 训练任务仪表板（Training Job Dashboard） | readmodel 训练任务仪表板（Training Job Dashboard） |
| AC-052 | 启动训练轮次（Start Training Round） | 训练轮次（Training Round） 满足执行该操作的状态条件 | 系统/用户 提交 启动训练轮次（Start Training Round） | 启动生命周期 训练轮次（Training Round）; 产生事件 训练轮次已开始（Training Round Started）; 状态变为 运行中（Running） | command 启动训练轮次（Start Training Round）; event 训练轮次已开始（Training Round Started）; state 运行中（Running） |
| AC-053 | 分发全局模型（Distribute Global Model） | 训练轮次（Training Round） 满足执行该操作的状态条件 | 系统/用户 提交 分发全局模型（Distribute Global Model） | 产生事件 全局模型已分发（Global Model Distributed）; 状态变为 正在收集更新（Collecting Updates） | command 分发全局模型（Distribute Global Model）; event 全局模型已分发（Global Model Distributed）; state 正在收集更新（Collecting Updates） |
| AC-054 | 提交本地模型更新（Submit Local Model Update） | 满足业务前置条件，具体规则待确认 | 边缘运行时（Edge Runtime） 提交 提交本地模型更新（Submit Local Model Update） | 产生事件 本地模型更新已提交（Local Model Update Submitted） | command 提交本地模型更新（Submit Local Model Update）; event 本地模型更新已提交（Local Model Update Submitted） |
| AC-055 | 提交本地模型评估（Submit Local Model Evaluation） | 满足业务前置条件，具体规则待确认 | 系统/用户 提交 提交本地模型评估（Submit Local Model Evaluation） | 产生事件 本地模型评估已提交（Local Model Evaluation Submitted） | command 提交本地模型评估（Submit Local Model Evaluation）; event 本地模型评估已提交（Local Model Evaluation Submitted） |
| AC-056 | 请求安全聚合（Request Secure Aggregation） | 训练轮次（Training Round） 满足执行该操作的状态条件 | 系统/用户 提交 请求安全聚合（Request Secure Aggregation） | 产生事件 安全聚合已请求（Secure Aggregation Requested）; 状态变为 正在聚合（Aggregating） | command 请求安全聚合（Request Secure Aggregation）; event 安全聚合已请求（Secure Aggregation Requested）; state 正在聚合（Aggregating） |
| AC-057 | 完成安全聚合（Complete Secure Aggregation） | 训练轮次（Training Round） 满足执行该操作的状态条件 | 系统/用户 提交 完成安全聚合（Complete Secure Aggregation） | 产生事件 全局模型已更新（Global Model Updated）; 状态变为 正在评估全局模型（Evaluating Global Model） | command 完成安全聚合（Complete Secure Aggregation）; event 全局模型已更新（Global Model Updated）; state 正在评估全局模型（Evaluating Global Model） |
| AC-058 | 提交全局模型评估（Submit Global Model Evaluation） | 满足业务前置条件，具体规则待确认 | 系统/用户 提交 提交全局模型评估（Submit Global Model Evaluation） | 产生事件 全局模型评估已提交（Global Model Evaluation Submitted） | command 提交全局模型评估（Submit Global Model Evaluation）; event 全局模型评估已提交（Global Model Evaluation Submitted） |
| AC-059 | 完成训练轮次（Complete Training Round） | 训练轮次（Training Round） 满足执行该操作的状态条件 | 系统/用户 提交 完成训练轮次（Complete Training Round） | 产生事件 训练轮次已完成（Training Round Completed）; 状态变为 已完成（Completed） | command 完成训练轮次（Complete Training Round）; event 训练轮次已完成（Training Round Completed）; state 已完成（Completed） |
| AC-060 | 训练轮次进度（Training Round Progress） | 满足业务前置条件，具体规则待确认 | 用户访问 训练轮次进度（Training Round Progress） 查询入口 | 展示 训练轮次进度（Training Round Progress） | readmodel 训练轮次进度（Training Round Progress） |
| AC-061 | 注册候选模型（Register Candidate Model） | 模型版本（Model Version） 满足执行该操作的状态条件 | 系统/用户 提交 注册候选模型（Register Candidate Model） | 启动生命周期 模型版本（Model Version）; 产生事件 模型候选已注册（Model Candidate Registered）; 状态变为 候选（Candidate） | command 注册候选模型（Register Candidate Model）; event 模型候选已注册（Model Candidate Registered）; state 候选（Candidate） |
| AC-062 | 批准模型（Approve Model） | 模型版本（Model Version） 满足执行该操作的状态条件 | 治理审查员（Governance Reviewer） 提交 批准模型（Approve Model） | 产生事件 模型已批准（Model Approved）; 状态变为 已批准（Approved） | command 批准模型（Approve Model）; event 模型已批准（Model Approved）; state 已批准（Approved） |
| AC-063 | 提升模型至生产（Promote Model To Production） | 模型版本（Model Version） 满足执行该操作的状态条件 | 发布管理员（Release Manager） 提交 提升模型至生产（Promote Model To Production） | 产生事件 模型已提升至生产（Model Promoted To Production）; 状态变为 生产（Production） | command 提升模型至生产（Promote Model To Production）; event 模型已提升至生产（Model Promoted To Production）; state 生产（Production） |
| AC-064 | 回滚模型版本（Rollback Model Version） | 模型版本（Model Version） 满足执行该操作的状态条件 | 发布管理员（Release Manager） 提交 回滚模型版本（Rollback Model Version） | 产生事件 模型版本已回滚（Model Version Rolled Back）; 状态变为 已回滚（Rolled Back） | command 回滚模型版本（Rollback Model Version）; event 模型版本已回滚（Model Version Rolled Back）; state 已回滚（Rolled Back） |
| AC-065 | 停用模型版本（Retire Model Version） | 模型版本（Model Version） 满足执行该操作的状态条件 | 发布管理员（Release Manager） 提交 停用模型版本（Retire Model Version） | 产生事件 模型版本已停用（Model Version Retired）; 状态变为 已停用（Retired） | command 停用模型版本（Retire Model Version）; event 模型版本已停用（Model Version Retired）; state 已停用（Retired） |
| AC-066 | 模型版本目录（Model Version Catalog） | 满足业务前置条件，具体规则待确认 | 用户访问 模型版本目录（Model Version Catalog） 查询入口 | 展示 模型版本目录（Model Version Catalog） | readmodel 模型版本目录（Model Version Catalog） |
| AC-067 | 记录运行时心跳（Record Runtime Heartbeat） | 节点运行时健康（Node Runtime Health） 满足执行该操作的状态条件 | 边缘运行时（Edge Runtime） 提交 记录运行时心跳（Record Runtime Heartbeat） | 启动生命周期 节点运行时健康（Node Runtime Health）; 产生事件 运行时心跳已记录（Runtime Heartbeat Recorded）; 状态变为 健康（Healthy） | command 记录运行时心跳（Record Runtime Heartbeat）; event 运行时心跳已记录（Runtime Heartbeat Recorded）; state 健康（Healthy） |
| AC-068 | 运行时健康仪表板（Runtime Health Dashboard） | 满足业务前置条件，具体规则待确认 | 用户访问 运行时健康仪表板（Runtime Health Dashboard） 查询入口 | 展示 运行时健康仪表板（Runtime Health Dashboard） | readmodel 运行时健康仪表板（Runtime Health Dashboard） |
| AC-069 | 触发训练告警（Raise Training Alert） | 训练告警（Training Alert） 满足执行该操作的状态条件 | 系统/用户 提交 触发训练告警（Raise Training Alert） | 启动生命周期 训练告警（Training Alert）; 产生事件 训练告警已触发（Training Alert Raised）; 状态变为 已触发（Raised） | command 触发训练告警（Raise Training Alert）; event 训练告警已触发（Training Alert Raised）; state 已触发（Raised） |
| AC-070 | 训练告警目录（Training Alert Catalog） | 满足业务前置条件，具体规则待确认 | 用户访问 训练告警目录（Training Alert Catalog） 查询入口 | 展示 训练告警目录（Training Alert Catalog） | readmodel 训练告警目录（Training Alert Catalog） |
| AC-071 | 追加审计跟踪（Append Audit Trail） | 审计记录（Audit Record） 满足执行该操作的状态条件 | 系统/用户 提交 追加审计跟踪（Append Audit Trail） | 启动生命周期 审计记录（Audit Record）; 产生事件 审计跟踪已追加（Audit Trail Appended）; 状态变为 已追加（Appended） | command 追加审计跟踪（Append Audit Trail）; event 审计跟踪已追加（Audit Trail Appended）; state 已追加（Appended） |
| AC-072 | 审计记录日志（Audit Record Log） | 满足业务前置条件，具体规则待确认 | 用户访问 审计记录日志（Audit Record Log） 查询入口 | 展示 审计记录日志（Audit Record Log） | readmodel 审计记录日志（Audit Record Log） |
| AC-073 | 生成节点密钥（Generate Node Key） | 节点加密密钥（Node Encryption Key） 满足执行该操作的状态条件 | 安全审查员（Security Reviewer） 提交 生成节点密钥（Generate Node Key） | 启动生命周期 节点加密密钥（Node Encryption Key）; 产生事件 节点密钥已生成（Node Key Generated）; 状态变为 已生成（Generated） | command 生成节点密钥（Generate Node Key）; event 节点密钥已生成（Node Key Generated）; state 已生成（Generated） |
| AC-074 | 分发节点密钥（Distribute Node Key） | 节点加密密钥（Node Encryption Key） 满足执行该操作的状态条件 | 系统/用户 提交 分发节点密钥（Distribute Node Key） | 产生事件 节点密钥已分发（Node Key Distributed）; 状态变为 已分发（Distributed） | command 分发节点密钥（Distribute Node Key）; event 节点密钥已分发（Node Key Distributed）; state 已分发（Distributed） |
| AC-075 | 激活节点密钥（Activate Node Key） | 节点加密密钥（Node Encryption Key） 满足执行该操作的状态条件 | 节点操作员（Node Operator） 提交 激活节点密钥（Activate Node Key） | 产生事件 节点密钥已激活（Node Key Activated）; 状态变为 活跃（Active） | command 激活节点密钥（Activate Node Key）; event 节点密钥已激活（Node Key Activated）; state 活跃（Active） |
| AC-076 | 撤销节点密钥（Revoke Node Key） | 节点加密密钥（Node Encryption Key） 满足执行该操作的状态条件 | 安全审查员（Security Reviewer） 提交 撤销节点密钥（Revoke Node Key） | 产生事件 节点密钥已撤销（Node Key Revoked）; 状态变为 已撤销（Revoked） | command 撤销节点密钥（Revoke Node Key）; event 节点密钥已撤销（Node Key Revoked）; state 已撤销（Revoked） |
| AC-077 | 作废节点密钥（Expire Node Key） | 节点加密密钥（Node Encryption Key） 满足执行该操作的状态条件 | 系统/用户 提交 作废节点密钥（Expire Node Key） | 产生事件 节点密钥已过期（Node Key Expired）; 状态变为 已过期（Expired） | command 作废节点密钥（Expire Node Key）; event 节点密钥已过期（Node Key Expired）; state 已过期（Expired） |
| AC-078 | 节点密钥目录（Node Key Catalog） | 满足业务前置条件，具体规则待确认 | 用户访问 节点密钥目录（Node Key Catalog） 查询入口 | 展示 节点密钥目录（Node Key Catalog） | readmodel 节点密钥目录（Node Key Catalog） |
| AC-079 | 提交节点认证报告（Submit Node Attestation Report） | 节点认证报告（Node Attestation Report） 满足执行该操作的状态条件 | 节点操作员（Node Operator） 提交 提交节点认证报告（Submit Node Attestation Report） | 启动生命周期 节点认证报告（Node Attestation Report）; 产生事件 节点认证报告已提交（Node Attestation Report Submitted）; 状态变为 已提交（Submitted） | command 提交节点认证报告（Submit Node Attestation Report）; event 节点认证报告已提交（Node Attestation Report Submitted）; state 已提交（Submitted） |
| AC-080 | 验证节点认证报告（Verify Node Attestation Report） | 节点认证报告（Node Attestation Report） 满足执行该操作的状态条件 | 安全审查员（Security Reviewer） 提交 验证节点认证报告（Verify Node Attestation Report） | 产生事件 节点认证报告已验证（Node Attestation Report Verified）; 状态变为 已验证（Verified） | command 验证节点认证报告（Verify Node Attestation Report）; event 节点认证报告已验证（Node Attestation Report Verified）; state 已验证（Verified） |
| AC-081 | 作废节点认证报告（Expire Node Attestation Report） | 节点认证报告（Node Attestation Report） 满足执行该操作的状态条件 | 系统/用户 提交 作废节点认证报告（Expire Node Attestation Report） | 产生事件 节点认证报告已过期（Node Attestation Report Expired）; 状态变为 已过期（Expired） | command 作废节点认证报告（Expire Node Attestation Report）; event 节点认证报告已过期（Node Attestation Report Expired）; state 已过期（Expired） |
| AC-082 | 撤销节点认证报告（Revoke Node Attestation Report） | 节点认证报告（Node Attestation Report） 满足执行该操作的状态条件 | 安全审查员（Security Reviewer） 提交 撤销节点认证报告（Revoke Node Attestation Report） | 产生事件 节点认证报告已撤销（Node Attestation Report Revoked）; 状态变为 已撤销（Revoked） | command 撤销节点认证报告（Revoke Node Attestation Report）; event 节点认证报告已撤销（Node Attestation Report Revoked）; state 已撤销（Revoked） |
| AC-083 | 节点认证目录（Node Attestation Catalog） | 满足业务前置条件，具体规则待确认 | 用户访问 节点认证目录（Node Attestation Catalog） 查询入口 | 展示 节点认证目录（Node Attestation Catalog） | readmodel 节点认证目录（Node Attestation Catalog） |
| AC-084 | 生成安全聚合密钥（Generate Secure Aggregation Key） | 安全聚合密钥（Secure Aggregation Key） 满足执行该操作的状态条件 | MLOps 工程师（MLOps Engineer） 提交 生成安全聚合密钥（Generate Secure Aggregation Key） | 启动生命周期 安全聚合密钥（Secure Aggregation Key）; 产生事件 安全聚合密钥已生成（Secure Aggregation Key Generated）; 状态变为 已生成（Generated） | command 生成安全聚合密钥（Generate Secure Aggregation Key）; event 安全聚合密钥已生成（Secure Aggregation Key Generated）; state 已生成（Generated） |
| AC-085 | 分发密钥份额（Distribute Key Share） | 安全聚合密钥（Secure Aggregation Key） 满足执行该操作的状态条件 | MLOps 工程师（MLOps Engineer） 提交 分发密钥份额（Distribute Key Share） | 产生事件 安全聚合密钥份额已分发（Secure Aggregation Key Share Distributed）; 状态变为 已分发（Distributed） | command 分发密钥份额（Distribute Key Share）; event 安全聚合密钥份额已分发（Secure Aggregation Key Share Distributed）; state 已分发（Distributed） |
| AC-086 | 标记安全聚合密钥已使用（Mark Secure Aggregation Key Used） | 安全聚合密钥（Secure Aggregation Key） 满足执行该操作的状态条件 | 系统/用户 提交 标记安全聚合密钥已使用（Mark Secure Aggregation Key Used） | 产生事件 安全聚合密钥已使用（Secure Aggregation Key Used）; 状态变为 已使用（Used） | command 标记安全聚合密钥已使用（Mark Secure Aggregation Key Used）; event 安全聚合密钥已使用（Secure Aggregation Key Used）; state 已使用（Used） |
| AC-087 | 撤销安全聚合密钥（Revoke Secure Aggregation Key） | 安全聚合密钥（Secure Aggregation Key） 满足执行该操作的状态条件 | 安全审查员（Security Reviewer） 提交 撤销安全聚合密钥（Revoke Secure Aggregation Key） | 产生事件 安全聚合密钥已撤销（Secure Aggregation Key Revoked）; 状态变为 已撤销（Revoked） | command 撤销安全聚合密钥（Revoke Secure Aggregation Key）; event 安全聚合密钥已撤销（Secure Aggregation Key Revoked）; state 已撤销（Revoked） |
| AC-088 | 安全聚合密钥目录（Secure Aggregation Key Catalog） | 满足业务前置条件，具体规则待确认 | 用户访问 安全聚合密钥目录（Secure Aggregation Key Catalog） 查询入口 | 展示 安全聚合密钥目录（Secure Aggregation Key Catalog） | readmodel 安全聚合密钥目录（Secure Aggregation Key Catalog） |
| AC-089 | 初始化安全聚合轮次（Initialize Secure Aggregation Round） | 安全聚合轮次（Secure Aggregation Round） 满足执行该操作的状态条件 | 系统/用户 提交 初始化安全聚合轮次（Initialize Secure Aggregation Round） | 启动生命周期 安全聚合轮次（Secure Aggregation Round）; 产生事件 安全聚合轮次已初始化（Secure Aggregation Round Initialized）; 状态变为 已初始化（Initialized） | command 初始化安全聚合轮次（Initialize Secure Aggregation Round）; event 安全聚合轮次已初始化（Secure Aggregation Round Initialized）; state 已初始化（Initialized） |
| AC-090 | 分发聚合掩码份额（Distribute Aggregation Mask Shares） | 安全聚合轮次（Secure Aggregation Round） 满足执行该操作的状态条件 | 安全聚合服务（Secure Aggregation Service） 提交 分发聚合掩码份额（Distribute Aggregation Mask Shares） | 产生事件 聚合掩码份额已分发（Aggregation Mask Share Distributed）; 状态变为 份额已分发（Shares Distributed） | command 分发聚合掩码份额（Distribute Aggregation Mask Shares）; event 聚合掩码份额已分发（Aggregation Mask Share Distributed）; state 份额已分发（Shares Distributed） |
| AC-091 | 收集聚合掩码份额（Collect Aggregation Mask Shares） | 安全聚合轮次（Secure Aggregation Round） 满足执行该操作的状态条件 | 安全聚合服务（Secure Aggregation Service） 提交 收集聚合掩码份额（Collect Aggregation Mask Shares） | 产生事件 聚合掩码份额已收集（Aggregation Mask Shares Collected）; 状态变为 份额已收集（Shares Collected） | command 收集聚合掩码份额（Collect Aggregation Mask Shares）; event 聚合掩码份额已收集（Aggregation Mask Shares Collected）; state 份额已收集（Shares Collected） |
| AC-092 | 完成安全聚合解密（Complete Secure Aggregation Decrypt） | 安全聚合轮次（Secure Aggregation Round） 满足执行该操作的状态条件 | 系统/用户 提交 完成安全聚合解密（Complete Secure Aggregation Decrypt） | 产生事件 安全聚合已解密（Secure Aggregation Decrypted）; 状态变为 已聚合（Aggregated） | command 完成安全聚合解密（Complete Secure Aggregation Decrypt）; event 安全聚合已解密（Secure Aggregation Decrypted）; state 已聚合（Aggregated） |
| AC-093 | 撤销安全聚合轮次（Revoke Secure Aggregation Round） | 安全聚合轮次（Secure Aggregation Round） 满足执行该操作的状态条件 | 安全审查员（Security Reviewer） 提交 撤销安全聚合轮次（Revoke Secure Aggregation Round） | 产生事件 安全聚合轮次已撤销（Secure Aggregation Round Revoked）; 状态变为 已撤销（Revoked） | command 撤销安全聚合轮次（Revoke Secure Aggregation Round）; event 安全聚合轮次已撤销（Secure Aggregation Round Revoked）; state 已撤销（Revoked） |
| AC-094 | 安全聚合轮次目录（Secure Aggregation Round Catalog） | 满足业务前置条件，具体规则待确认 | 用户访问 安全聚合轮次目录（Secure Aggregation Round Catalog） 查询入口 | 展示 安全聚合轮次目录（Secure Aggregation Round Catalog） | readmodel 安全聚合轮次目录（Secure Aggregation Round Catalog） |
| AC-095 | 签发数据集访问凭证（Issue Dataset Access Credential） | 数据集访问凭证（Dataset Access Credential） 满足执行该操作的状态条件 | 节点操作员（Node Operator） 提交 签发数据集访问凭证（Issue Dataset Access Credential） | 启动生命周期 数据集访问凭证（Dataset Access Credential）; 产生事件 数据集访问凭证已签发（Dataset Access Credential Issued）; 状态变为 已签发（Issued） | command 签发数据集访问凭证（Issue Dataset Access Credential）; event 数据集访问凭证已签发（Dataset Access Credential Issued）; state 已签发（Issued） |
| AC-096 | 轮换数据集访问凭证（Rotate Dataset Access Credential） | 数据集访问凭证（Dataset Access Credential） 满足执行该操作的状态条件 | 节点操作员（Node Operator） 提交 轮换数据集访问凭证（Rotate Dataset Access Credential） | 产生事件 数据集访问凭证已轮换（Dataset Access Credential Rotated）; 状态变为 已轮换（Rotated） | command 轮换数据集访问凭证（Rotate Dataset Access Credential）; event 数据集访问凭证已轮换（Dataset Access Credential Rotated）; state 已轮换（Rotated） |
| AC-097 | 撤销数据集访问凭证（Revoke Dataset Access Credential） | 数据集访问凭证（Dataset Access Credential） 满足执行该操作的状态条件 | 合规官（Compliance Officer） 提交 撤销数据集访问凭证（Revoke Dataset Access Credential） | 产生事件 数据集访问凭证已撤销（Dataset Access Credential Revoked）; 状态变为 已撤销（Revoked） | command 撤销数据集访问凭证（Revoke Dataset Access Credential）; event 数据集访问凭证已撤销（Dataset Access Credential Revoked）; state 已撤销（Revoked） |
| AC-098 | 数据集访问凭证目录（Dataset Access Credential Catalog） | 满足业务前置条件，具体规则待确认 | 用户访问 数据集访问凭证目录（Dataset Access Credential Catalog） 查询入口 | 展示 数据集访问凭证目录（Dataset Access Credential Catalog） | readmodel 数据集访问凭证目录（Dataset Access Credential Catalog） |

<!-- em:section id="prd.section.dataDictionary" -->
## 关键数据规则

| 所属元素 | 字段 | 类型 | 数量 | 属性 | 示例 | 来源/计算规则 |
| --- | --- | --- | --- | --- | --- | --- |
| 注册组织（Register Organization） | organizationId | UUID | Single | id, generated, technical | - | - |
| 组织已注册（Organization Registered） | organizationId | UUID | Single | id, technical | - | - |
| 验证组织身份（Verify Organization Identity） | organizationId | UUID | Single | id, technical | - | - |
| 组织身份已验证（Organization Identity Verified） | organizationId | UUID | Single | id, technical | - | - |
| 激活组织（Activate Organization） | organizationId | UUID | Single | id, technical | - | - |
| 组织已激活（Organization Activated） | organizationId | UUID | Single | id, technical | - | - |
| 停用组织（Deactivate Organization） | organizationId | UUID | Single | id, technical | - | - |
| 组织已停用（Organization Deactivated） | organizationId | UUID | Single | id, technical | - | - |
| 组织目录（Organization Directory） | organizationId | UUID | Single | id | - | - |
| 创建联邦（Create Federation） | federationId | UUID | Single | id, generated, technical | - | - |
| 联邦已创建（Federation Created） | federationId | UUID | Single | id, technical | - | - |
| 联邦概览（Federation Overview） | federationId | UUID | Single | id | - | - |
| 邀请参与者（Invite Participant） | federationId | UUID | Single | id, technical | - | - |
| 参与者已邀请（Participant Invited） | federationId | UUID | Single | id, technical | - | - |
| 批准参与者（Approve Participant） | federationId | UUID | Single | id, technical | - | - |
| 参与者已加入（Participant Joined） | federationId | UUID | Single | id, technical | - | - |
| 拒绝参与者（Reject Participant） | federationId | UUID | Single | id, technical | - | - |
| 参与者已拒绝（Participant Rejected） | federationId | UUID | Single | id, technical | - | - |
| 撤销参与者邀请（Revoke Participant Invitation） | federationId | UUID | Single | id, technical | - | - |
| 参与者邀请已撤销（Participant Invitation Revoked） | federationId | UUID | Single | id, technical | - | - |
| 暂停参与者（Suspend Participant） | federationId | UUID | Single | id, technical | - | - |
| 参与者已暂停（Participant Suspended） | federationId | UUID | Single | id, technical | - | - |
| 移除参与者（Remove Participant） | federationId | UUID | Single | id, technical | - | - |
| 参与者已移除（Participant Removed） | federationId | UUID | Single | id, technical | - | - |
| 联邦成员目录（Federation Membership Directory） | federationId | UUID | Single | id | - | - |
| 联邦成员目录（Federation Membership Directory） | organizationId | UUID | Single | id | - | - |
| 注册计算节点（Register Compute Node） | nodeId | UUID | Single | id, generated, technical | - | - |
| 计算节点已注册（Compute Node Registered） | nodeId | UUID | Single | id, technical | - | - |
| 更新节点能力（Update Node Capability） | nodeId | UUID | Single | id, technical | - | - |
| 节点能力已更新（Node Capability Updated） | nodeId | UUID | Single | id, technical | - | - |
| 信任计算节点（Trust Compute Node） | nodeId | UUID | Single | id, technical | - | - |
| 计算节点已信任（Compute Node Trusted） | nodeId | UUID | Single | id, technical | - | - |
| 暂停计算节点（Suspend Compute Node） | nodeId | UUID | Single | id, technical | - | - |
| 计算节点已暂停（Compute Node Suspended） | nodeId | UUID | Single | id, technical | - | - |
| 计算节点目录（Compute Node Catalog） | nodeId | UUID | Single | id | - | - |
| 定义特征架构（Define Feature Schema） | featureSchemaId | UUID | Single | id, generated, technical | - | - |
| 特征架构已发布（Feature Schema Published） | featureSchemaId | UUID | Single | id, technical | - | - |
| 特征架构目录（Feature Schema Catalog） | featureSchemaId | UUID | Single | id | - | - |
| 注册数据集（Register Dataset） | datasetId | UUID | Single | id, generated, technical | - | - |
| 数据集已注册（Dataset Registered） | datasetId | UUID | Single | id, technical | - | - |
| 验证数据集合约（Validate Dataset Contract） | datasetId | UUID | Single | id, technical | - | - |
| 数据集合约已验证（Dataset Contract Validated） | datasetId | UUID | Single | id, technical | - | - |
| 数据集合约已验证（Dataset Contract Validated） | schemaCompatible | Boolean | Single | - | - | derived from Dataset.featureSchemaId, ValidateDatasetContract.featureSchemaId rule: 验证数据集特征架构兼容性。 |
| 数据集合约已验证（Dataset Contract Validated） | labelCompatible | Boolean | Single | - | - | derived from Dataset.labelSchema, FeatureSchema rule: 验证数据集标签兼容性。 |
| 数据集合约已验证（Dataset Contract Validated） | qualityScore | Decimal | Single | - | 0.86 | derived from Dataset.statistics, ValidationProfile rule: 根据验证配置对数据集质量进行评分。 |
| 数据集合约已验证（Dataset Contract Validated） | nonIidScore | Decimal | Single | - | - | derived from Dataset.statistics, ValidationProfile rule: 对数据集分布偏度进行评分以供训练选择。 |
| 拒绝数据集用于训练（Reject Dataset For Training） | datasetId | UUID | Single | id, technical | - | - |
| 数据集已拒绝用于训练（Dataset Rejected For Training） | datasetId | UUID | Single | id, technical | - | - |
| 批准数据集用于训练（Approve Dataset For Training） | datasetId | UUID | Single | id, technical | - | - |
| 数据集已批准用于训练（Dataset Approved For Training） | datasetId | UUID | Single | id, technical | - | - |
| 作废数据集训练审批（Expire Dataset Training Approval） | datasetId | UUID | Single | id, technical | - | - |
| 数据集训练审批已过期（Dataset Training Approval Expired） | datasetId | UUID | Single | id, technical | - | - |
| 撤销数据集训练审批（Revoke Dataset Training Approval） | datasetId | UUID | Single | id, technical | - | - |
| 数据集训练审批已撤销（Dataset Training Approval Revoked） | datasetId | UUID | Single | id, technical | - | - |
| 数据集能力（Dataset Capability） | datasetId | UUID | Single | id | - | - |
| 配置数据集访问配置（Configure Dataset Access Profile） | accessProfileId | UUID | Single | id, generated, technical | - | - |
| 数据集访问配置已配置（Dataset Access Profile Configured） | accessProfileId | UUID | Single | id, technical | - | - |
| 请求运行时数据集访问验证（Request Runtime Dataset Access Validation） | accessProfileId | UUID | Single | id, technical | - | - |
| 数据集访问验证已请求（Dataset Access Validation Requested） | accessProfileId | UUID | Single | id, technical | - | - |
| 完成运行时数据集访问验证（Complete Runtime Dataset Access Validation） | accessProfileId | UUID | Single | id, technical | - | - |
| 运行时数据集访问已验证（Runtime Dataset Access Validated） | accessProfileId | UUID | Single | id, technical | - | - |
| 数据集运行时访问目录（Dataset Runtime Access Catalog） | accessProfileId | UUID | Single | id | - | - |
| 声明训练评估数据集（Declare Training Evaluation Datasets） | datasetBundleId | UUID | Single | id, generated, technical | - | - |
| 训练评估数据集已声明（Training Evaluation Datasets Declared） | datasetBundleId | UUID | Single | id, technical | - | - |
| 训练评估数据集目录（Training Evaluation Dataset Catalog） | datasetBundleId | UUID | Single | id | - | - |
| 定义训练运行配置（Define Training Run Configuration） | trainingRunConfigurationId | UUID | Single | id, generated, technical | - | - |
| 训练运行配置已定义（Training Run Configuration Defined） | trainingRunConfigurationId | UUID | Single | id, technical | - | - |
| 验证训练运行配置（Validate Training Run Configuration） | trainingRunConfigurationId | UUID | Single | id, technical | - | - |
| 训练运行配置已验证（Training Run Configuration Validated） | trainingRunConfigurationId | UUID | Single | id, technical | - | - |
| 训练运行配置已验证（Training Run Configuration Validated） | effectiveMinimumNodesPerRound | Int | Single | - | - | derived from TrainingRunConfiguration.minimumNodesPerRound, TrainingRunConfiguration.failureToleranceRatio rule: 根据所选策略和容错能力推导有效节点法定人数。 |
| 锁定训练运行配置（Lock Training Run Configuration） | trainingRunConfigurationId | UUID | Single | id, technical | - | - |
| 训练运行配置已锁定（Training Run Configuration Locked） | trainingRunConfigurationId | UUID | Single | id, technical | - | - |
| 训练运行配置目录（Training Run Configuration Catalog） | trainingRunConfigurationId | UUID | Single | id | - | - |
| 创建训练任务（Create Training Job） | trainingJobId | UUID | Single | id, generated, technical | - | - |
| 训练任务已创建（Training Job Created） | trainingJobId | UUID | Single | id, technical | - | - |
| 配置训练策略（Configure Training Strategy） | trainingJobId | UUID | Single | id, technical | - | - |
| 配置训练策略（Configure Training Strategy） | maxRounds | Int | Single | - | - | derived from TrainingRunConfiguration.maxRounds rule: 将已锁定的训练运行配置轮次预算复制到训练任务策略。 |
| 配置训练策略（Configure Training Strategy） | minimumNodesPerRound | Int | Single | - | - | derived from TrainingRunConfiguration.minimumNodesPerRound rule: 将已配置的最小节点法定人数复制到训练任务策略。 |
| 配置训练策略（Configure Training Strategy） | secureAggregationRequired | Boolean | Single | - | - | derived from TrainingRunConfiguration.secureAggregationRequired rule: 将安全聚合需求复制到训练任务策略。 |
| 训练策略已配置（Training Strategy Configured） | trainingJobId | UUID | Single | id, technical | - | - |
| 提交训练任务（Submit Training Job） | trainingJobId | UUID | Single | id, technical | - | - |
| 训练任务已提交（Training Job Submitted） | trainingJobId | UUID | Single | id, technical | - | - |
| 训练任务已提交（Training Job Submitted） | minimumNodesPerRound | Int | Single | - | - | derived from TrainingJob.trainingStrategy rule: 根据已配置的训练策略推导最小选定节点数。 |
| 训练任务已提交（Training Job Submitted） | maxRounds | Int | Single | - | - | derived from TrainingRunConfiguration.maxRounds rule: 在训练任务提交时快照已配置的轮次预算。 |
| 训练任务已提交（Training Job Submitted） | minimumAccuracy | Decimal | Single | - | - | derived from TrainingRunConfiguration.minimumAccuracy rule: 在训练任务提交时快照已配置的目标准确率。 |
| 请求节点参与（Request Node Participation） | trainingJobId | UUID | Single | id, technical | - | - |
| 节点参与已请求（Node Participation Requested） | trainingJobId | UUID | Single | id, technical | - | - |
| 接受节点参与（Accept Node Participation） | trainingJobId | UUID | Single | id, technical | - | - |
| 节点已就绪可用于训练（Node Ready For Training） | trainingJobId | UUID | Single | id, technical | - | - |
| 训练参与者资格（Training Participant Eligibility） | trainingJobId | UUID | Single | id | - | - |
| 标记训练任务运行中（Mark Training Job Running） | trainingJobId | UUID | Single | id, technical | - | - |
| 训练任务运行中（Training Job Running） | trainingJobId | UUID | Single | id, technical | - | - |
| 暂停训练任务（Pause Training Job） | trainingJobId | UUID | Single | id, technical | - | - |
| 训练任务已暂停（Training Job Paused） | trainingJobId | UUID | Single | id, technical | - | - |
| 恢复训练任务（Resume Training Job） | trainingJobId | UUID | Single | id, technical | - | - |
| 训练任务已恢复（Training Job Resumed） | trainingJobId | UUID | Single | id, technical | - | - |
| 取消训练任务（Cancel Training Job） | trainingJobId | UUID | Single | id, technical | - | - |
| 训练任务已取消（Training Job Canceled） | trainingJobId | UUID | Single | id, technical | - | - |
| 完成训练任务（Complete Training Job） | trainingJobId | UUID | Single | id, technical | - | - |
| 训练任务已完成（Training Job Completed） | trainingJobId | UUID | Single | id, technical | - | - |
| 训练任务仪表板（Training Job Dashboard） | trainingJobId | UUID | Single | id | - | - |
| 启动训练轮次（Start Training Round） | trainingJobId | UUID | Single | id, technical | - | - |
| 训练轮次已开始（Training Round Started） | trainingJobId | UUID | Single | id, technical | - | - |
| 分发全局模型（Distribute Global Model） | trainingJobId | UUID | Single | id, technical | - | - |
| 全局模型已分发（Global Model Distributed） | trainingJobId | UUID | Single | id, technical | - | - |
| 提交本地模型更新（Submit Local Model Update） | trainingJobId | UUID | Single | id, technical | - | - |
| 本地模型更新已提交（Local Model Update Submitted） | trainingJobId | UUID | Single | id, technical | - | - |
| 提交本地模型评估（Submit Local Model Evaluation） | trainingJobId | UUID | Single | id, technical | - | - |
| 本地模型评估已提交（Local Model Evaluation Submitted） | trainingJobId | UUID | Single | id, technical | - | - |
| 请求安全聚合（Request Secure Aggregation） | trainingJobId | UUID | Single | id, technical | - | - |
| 安全聚合已请求（Secure Aggregation Requested） | trainingJobId | UUID | Single | id, technical | - | - |
| 完成安全聚合（Complete Secure Aggregation） | trainingJobId | UUID | Single | id, technical | - | - |
| 全局模型已更新（Global Model Updated） | trainingJobId | UUID | Single | id, technical | - | - |
| 提交全局模型评估（Submit Global Model Evaluation） | trainingJobId | UUID | Single | id, technical | - | - |
| 全局模型评估已提交（Global Model Evaluation Submitted） | trainingJobId | UUID | Single | id, technical | - | - |
| 完成训练轮次（Complete Training Round） | trainingJobId | UUID | Single | id, technical | - | - |
| 训练轮次已完成（Training Round Completed） | trainingJobId | UUID | Single | id, technical | - | - |
| 训练轮次进度（Training Round Progress） | trainingJobId | UUID | Single | id | - | - |
| 训练轮次进度（Training Round Progress） | roundId | UUID | Single | id | - | - |
| 注册候选模型（Register Candidate Model） | modelVersionId | UUID | Single | id, technical | - | - |
| 模型候选已注册（Model Candidate Registered） | modelVersionId | UUID | Single | id, technical | - | - |
| 批准模型（Approve Model） | modelVersionId | UUID | Single | id, technical | - | - |
| 模型已批准（Model Approved） | modelVersionId | UUID | Single | id, technical | - | - |
| 提升模型至生产（Promote Model To Production） | modelVersionId | UUID | Single | id, technical | - | - |
| 模型已提升至生产（Model Promoted To Production） | modelVersionId | UUID | Single | id, technical | - | - |
| 回滚模型版本（Rollback Model Version） | modelVersionId | UUID | Single | id, technical | - | - |
| 模型版本已回滚（Model Version Rolled Back） | modelVersionId | UUID | Single | id, technical | - | - |
| 停用模型版本（Retire Model Version） | modelVersionId | UUID | Single | id, technical | - | - |
| 模型版本已停用（Model Version Retired） | modelVersionId | UUID | Single | id, technical | - | - |
| 模型版本目录（Model Version Catalog） | modelVersionId | UUID | Single | id | - | - |
| 记录运行时心跳（Record Runtime Heartbeat） | nodeId | UUID | Single | id, technical | - | - |
| 运行时心跳已记录（Runtime Heartbeat Recorded） | nodeId | UUID | Single | id, technical | - | - |
| 运行时健康仪表板（Runtime Health Dashboard） | nodeId | UUID | Single | id | - | - |
| 触发训练告警（Raise Training Alert） | alertId | UUID | Single | id, generated, technical | - | - |
| 训练告警已触发（Training Alert Raised） | alertId | UUID | Single | id, technical | - | - |
| 训练告警目录（Training Alert Catalog） | alertId | UUID | Single | id | - | - |
| 追加审计跟踪（Append Audit Trail） | auditRecordId | UUID | Single | id, generated, technical | - | - |
| 审计跟踪已追加（Audit Trail Appended） | auditRecordId | UUID | Single | id, technical | - | - |
| 审计记录日志（Audit Record Log） | auditRecordId | UUID | Single | id | - | - |
| 生成节点密钥（Generate Node Key） | nodeKeyId | UUID | Single | id, generated, technical | - | - |
| 节点密钥已生成（Node Key Generated） | nodeKeyId | UUID | Single | id, technical | - | - |
| 分发节点密钥（Distribute Node Key） | nodeKeyId | UUID | Single | id, technical | - | - |
| 节点密钥已分发（Node Key Distributed） | nodeKeyId | UUID | Single | id, technical | - | - |
| 激活节点密钥（Activate Node Key） | nodeKeyId | UUID | Single | id, technical | - | - |
| 节点密钥已激活（Node Key Activated） | nodeKeyId | UUID | Single | id, technical | - | - |
| 撤销节点密钥（Revoke Node Key） | nodeKeyId | UUID | Single | id, technical | - | - |
| 节点密钥已撤销（Node Key Revoked） | nodeKeyId | UUID | Single | id, technical | - | - |
| 作废节点密钥（Expire Node Key） | nodeKeyId | UUID | Single | id, technical | - | - |
| 节点密钥已过期（Node Key Expired） | nodeKeyId | UUID | Single | id, technical | - | - |
| 节点密钥目录（Node Key Catalog） | nodeKeyId | UUID | Single | id | - | - |
| 提交节点认证报告（Submit Node Attestation Report） | attestationReportId | UUID | Single | id, generated, technical | - | - |
| 节点认证报告已提交（Node Attestation Report Submitted） | attestationReportId | UUID | Single | id, technical | - | - |
| 验证节点认证报告（Verify Node Attestation Report） | attestationReportId | UUID | Single | id, technical | - | - |
| 节点认证报告已验证（Node Attestation Report Verified） | attestationReportId | UUID | Single | id, technical | - | - |
| 作废节点认证报告（Expire Node Attestation Report） | attestationReportId | UUID | Single | id, technical | - | - |
| 节点认证报告已过期（Node Attestation Report Expired） | attestationReportId | UUID | Single | id, technical | - | - |
| 撤销节点认证报告（Revoke Node Attestation Report） | attestationReportId | UUID | Single | id, technical | - | - |
| 节点认证报告已撤销（Node Attestation Report Revoked） | attestationReportId | UUID | Single | id, technical | - | - |
| 节点认证目录（Node Attestation Catalog） | attestationReportId | UUID | Single | id | - | - |
| 生成安全聚合密钥（Generate Secure Aggregation Key） | aggregationKeyId | UUID | Single | id, generated, technical | - | - |
| 安全聚合密钥已生成（Secure Aggregation Key Generated） | aggregationKeyId | UUID | Single | id, technical | - | - |
| 分发密钥份额（Distribute Key Share） | aggregationKeyId | UUID | Single | id, technical | - | - |
| 安全聚合密钥份额已分发（Secure Aggregation Key Share Distributed） | aggregationKeyId | UUID | Single | id, technical | - | - |
| 标记安全聚合密钥已使用（Mark Secure Aggregation Key Used） | aggregationKeyId | UUID | Single | id, technical | - | - |
| 安全聚合密钥已使用（Secure Aggregation Key Used） | aggregationKeyId | UUID | Single | id, technical | - | - |
| 撤销安全聚合密钥（Revoke Secure Aggregation Key） | aggregationKeyId | UUID | Single | id, technical | - | - |
| 安全聚合密钥已撤销（Secure Aggregation Key Revoked） | aggregationKeyId | UUID | Single | id, technical | - | - |
| 安全聚合密钥目录（Secure Aggregation Key Catalog） | aggregationKeyId | UUID | Single | id | - | - |
| 初始化安全聚合轮次（Initialize Secure Aggregation Round） | aggregationRoundId | UUID | Single | id, generated, technical | - | - |
| 安全聚合轮次已初始化（Secure Aggregation Round Initialized） | aggregationRoundId | UUID | Single | id, technical | - | - |
| 分发聚合掩码份额（Distribute Aggregation Mask Shares） | aggregationRoundId | UUID | Single | id, technical | - | - |
| 聚合掩码份额已分发（Aggregation Mask Share Distributed） | aggregationRoundId | UUID | Single | id, technical | - | - |
| 收集聚合掩码份额（Collect Aggregation Mask Shares） | aggregationRoundId | UUID | Single | id, technical | - | - |
| 聚合掩码份额已收集（Aggregation Mask Shares Collected） | aggregationRoundId | UUID | Single | id, technical | - | - |
| 完成安全聚合解密（Complete Secure Aggregation Decrypt） | aggregationRoundId | UUID | Single | id, technical | - | - |
| 安全聚合已解密（Secure Aggregation Decrypted） | aggregationRoundId | UUID | Single | id, technical | - | - |
| 撤销安全聚合轮次（Revoke Secure Aggregation Round） | aggregationRoundId | UUID | Single | id, technical | - | - |
| 安全聚合轮次已撤销（Secure Aggregation Round Revoked） | aggregationRoundId | UUID | Single | id, technical | - | - |
| 安全聚合轮次目录（Secure Aggregation Round Catalog） | aggregationRoundId | UUID | Single | id | - | - |
| 签发数据集访问凭证（Issue Dataset Access Credential） | credentialId | UUID | Single | id, generated, technical | - | - |
| 数据集访问凭证已签发（Dataset Access Credential Issued） | credentialId | UUID | Single | id, technical | - | - |
| 轮换数据集访问凭证（Rotate Dataset Access Credential） | credentialId | UUID | Single | id, technical | - | - |
| 数据集访问凭证已轮换（Dataset Access Credential Rotated） | credentialId | UUID | Single | id, technical | - | - |
| 撤销数据集访问凭证（Revoke Dataset Access Credential） | credentialId | UUID | Single | id, technical | - | - |
| 数据集访问凭证已撤销（Dataset Access Credential Revoked） | credentialId | UUID | Single | id, technical | - | - |
| 数据集访问凭证目录（Dataset Access Credential Catalog） | credentialId | UUID | Single | id | - | - |

<!-- em:section id="prd.section.automations" -->
## 自动化、策略与集成

| 名称 | 类型 | 触发与规则 |
| --- | --- | --- |
| 数据集访问运行时（Dataset Access Runtime） | integration | - |
| 自动验证数据集合约（Validate Dataset Contract Automatically） | automation | - |
| 过期后作废数据集审批（Expire Dataset Approval When Past Expiry） | automation | - |
| 配置完成后验证数据集访问（Validate Dataset Access After Profile Configured） | policy | on: 数据集访问配置已配置（DatasetAccessProfileConfigured）; issue: 请求运行时数据集访问验证（RequestRuntimeDatasetAccessValidation） |
| 安全聚合提供者（Secure Aggregation Provider） | integration | - |
| 边缘训练运行时（Edge Training Runtime） | integration | - |
| 聚合节点运行时（Aggregation Node Runtime） | integration | - |
| 自动验证训练运行配置（Validate Training Run Configuration Automatically） | automation | - |
| 训练提交时锁定配置（Lock Configuration When Training Submitted） | policy | on: 训练任务已提交（TrainingJobSubmitted）; issue: 锁定训练运行配置（LockTrainingRunConfiguration） |
| 请求合格节点（Request Eligible Nodes） | policy | on: 训练任务已提交（TrainingJobSubmitted）; issue: 请求节点参与（RequestNodeParticipation） |
| 轮次开始时标记训练任务运行中（Mark Training Job Running When Round Starts） | policy | on: 训练轮次已开始（TrainingRoundStarted）; issue: 标记训练任务运行中（MarkTrainingJobRunning） |
| 全局指标未达成时启动下一轮次（Start Next Round When Global Metric Not Reached） | automation | - |
| 轮次预算耗尽时完成任务（Complete Job When Round Budget Exhausted） | automation | - |
| 全局指标达成时完成任务（Complete Job When Global Metric Reached） | automation | - |
| 足够节点就绪时启动轮次（Start Round When Enough Nodes Ready） | automation | - |
| 请求分发全局模型（Request Distribute Global Model） | policy | on: 训练轮次已开始（TrainingRoundStarted）; issue: 分发全局模型（DistributeGlobalModel） |
| 评估更新完成时请求聚合（Request Aggregation When Evaluated Updates Complete） | automation | - |
| 全局模型评估后结束轮次（Finish Round After Global Model Evaluated） | policy | on: 全局模型评估已提交（GlobalModelEvaluationSubmitted）; issue: 完成训练轮次（CompleteTrainingRound） |
| 训练任务完成时注册最终模型（Register Final Model When Training Job Completed） | policy | on: 训练任务已完成（TrainingJobCompleted）; issue: 注册候选模型（RegisterCandidateModel） |
| 节点资源压力时触发告警（Raise Alert On Node Resource Pressure） | automation | - |
| 审计关键训练事件（Audit Critical Training Events） | policy | on: 训练告警已触发（TrainingAlertRaised）; issue: 追加审计跟踪（AppendAuditTrail） |
| 审计参与者加入（Audit Participant Joined） | policy | on: 参与者已加入（ParticipantJoined）; issue: 追加审计跟踪（AppendAuditTrail） |
| 审计参与者暂停（Audit Participant Suspended） | policy | on: 参与者已暂停（ParticipantSuspended）; issue: 追加审计跟踪（AppendAuditTrail） |
| 审计数据集审批（Audit Dataset Approval） | policy | on: 数据集已批准用于训练（DatasetApprovedForTraining）; issue: 追加审计跟踪（AppendAuditTrail） |
| 审计数据集审批撤销（Audit Dataset Approval Revoked） | policy | on: 数据集训练审批已撤销（DatasetTrainingApprovalRevoked）; issue: 追加审计跟踪（AppendAuditTrail） |
| 审计训练任务已提交（Audit Training Job Submitted） | policy | on: 训练任务已提交（TrainingJobSubmitted）; issue: 追加审计跟踪（AppendAuditTrail） |
| 审计模型提升至生产（Audit Model Promoted To Production） | policy | on: 模型已提升至生产（ModelPromotedToProduction）; issue: 追加审计跟踪（AppendAuditTrail） |
| 审计节点信任变更（Audit Node Trust Changed） | policy | on: 计算节点已信任（ComputeNodeTrusted）; issue: 追加审计跟踪（AppendAuditTrail） |
| 生成时分发密钥（Distribute Key When Generated） | policy | on: 节点密钥已生成（NodeKeyGenerated）; issue: 分发节点密钥（DistributeNodeKey） |
| 过期后作废节点密钥（Expire Node Key When Past Expiry） | automation | - |
| 过期后作废认证（Expire Attestation When Past Expiry） | automation | - |
| 聚合完成时标记密钥已使用（Mark Key Used When Aggregation Completes） | automation | - |
| 请求时初始化聚合轮次（Initialize Aggregation Round When Requested） | policy | on: 安全聚合已请求（SecureAggregationRequested）; issue: 初始化安全聚合轮次（InitializeSecureAggregationRound） |
| 份额就绪时完成解密（Complete Decryption When Shares Ready） | automation | - |

<!-- em:section id="prd.section.deliveryAcceptance" -->
## 交付验收检查表

- 功能清单中的页面、查询和操作均可访问，实际权限范围需由业务方确认。
- 命令输入字段的必填、可选、标识和示例约束与领域模型一致。
- 操作成功后产生约定事件，并进入领域模型指定的业务状态。
- Read Model 能根据订阅事件更新，并满足列表或详情查询需要。
- derived 字段按 rule 计算，from 字段能追踪到来源字段。
- 错误提示、重复提交、并发冲突、权限拒绝和操作幂等策略需在开发前确认。
- 性能、容量、安全、审计、数据保留和可用性指标需由项目另行定义。

<!-- em:section id="prd.section.openQuestions" -->
## 待确认事项

- 明确以下功能的产品行为： 安排下一训练轮次（Schedule Next Training Round）.
- 联邦管理（Federation Management） 有 14 个操作尚未定义明确的 specification：创建联邦（Create Federation）, 邀请参与者（Invite Participant）, 批准参与者（Approve Participant）, 拒绝参与者（Reject Participant），另有 10 个。
- 数据集治理（Dataset Governance） 有 11 个操作尚未定义明确的 specification：定义特征架构（Define Feature Schema）, 注册数据集（Register Dataset）, 验证数据集合约（Validate Dataset Contract）, 拒绝数据集用于训练（Reject Dataset For Training），另有 7 个。
- 训练编排（Training Orchestration） 有 21 个操作尚未定义明确的 specification：定义训练运行配置（Define Training Run Configuration）, 验证训练运行配置（Validate Training Run Configuration）, 锁定训练运行配置（Lock Training Run Configuration）, 创建训练任务（Create Training Job），另有 17 个。
- 模型生命周期（Model Lifecycle） 有 5 个操作尚未定义明确的 specification：注册候选模型（Register Candidate Model）, 批准模型（Approve Model）, 提升模型至生产（Promote Model To Production）, 回滚模型版本（Rollback Model Version），另有 1 个。
- 运行时运维（Runtime Operations） 有 3 个操作尚未定义明确的 specification：记录运行时心跳（Record Runtime Heartbeat）, 触发训练告警（Raise Training Alert）, 追加审计跟踪（Append Audit Trail）。
- 密钥与认证管理（Key And Attestation Management） 有 21 个操作尚未定义明确的 specification：生成节点密钥（Generate Node Key）, 分发节点密钥（Distribute Node Key）, 激活节点密钥（Activate Node Key）, 撤销节点密钥（Revoke Node Key），另有 17 个。
