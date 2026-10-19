# MEDOL 业务系统项目结构

本文约定通过 MEDOL 建模落地业务系统时的工作区组织方式。以 `federation-learning/` 为既有参考，`lims/` 遵循同一规则；业务名称、部署数量和模块边界由各自模型决定，不复制另一个系统的业务结构。

## 标准目录

```text
<system>/
  .medol/
    source.medol
    codegen-model.json
    medol.yml
    medol.local.example.yml
    medol.local.yml                可选，不提交
    translations.json             可选，实际启用时维护
  <system>-backend/                后端工程，可按业务命名为 platform 等
  <system>-console/                前端工程
  operations/
    dev/
    test/                          按需生成其他环境
  dictionary-init/                 可选，系统级初始化定义/脚本
  scripts/                        系统级生成、校验、部署协调脚本
  tests/                          可选，跨模型及工程的回归
  docs/                           需求、设计、实施和交付文档
  README.md
  AGENTS.md
  .gitignore
```

前后端应用、operations、业务初始化、文档和系统级脚本是同级资源。实际交付的工程不统一藏在 `generated/axon5`、`generated/refine` 下，也不出现 `generated/operations/operations` 的重复包装。

临时生成检查可以写入 `/tmp` 或明确指定的测试目录；这不代表正式业务系统采用同样的目录布局。纯模型交付可以暂时没有应用目录，但输入位置仍保持一致。

## 三类生成输入

| 文件 | 职责 | 维护方式 |
| --- | --- | --- |
| `.medol/source.medol` | 业务概念、事件、状态、流程、约束、内置能力、deployment 和 frontend 声明 | 业务改动首先修改此文件 |
| `.medol/codegen-model.json` | 供生成器消费的规范化快照 | 从 MEDOL 导出，不手工编辑修补业务 |
| `.medol/medol.yml` | 工程输出位置、operations、项目公共选项 | 使用已有工作区配置机制 |

不要同时在根目录、`.medol/`、后端子工程维护多份可编辑模型或 CodegenModel。已有编辑器工作区或上游示例作为模型权威来源时，明确同步方向；系统目录中的快照由导出流程更新，不能与上游各自演化。

生成器保留根目录 `codegen-model.json` 等兼容读取入口，不能因此把旧入口作为新系统的默认结构。常规工作区不需要再通过 `CODEGEN_MODEL_PATH` 指向另一份根目录文件。

## 输出配置

LIMS 使用的配置示例：

```yaml
name: LIMS

generators:
  axon5:
    output: lims-backend
  refine:
    output: lims-console
  operations:
    output: .

operations:
  applications:
    lims-backend:
      servicePort: 8080

workspaceFiles:
  overwrite: false
```

这些是现有 `.medol/medol.yml` 配置，不是新增 MEDOL 语法。

- 输出路径相对系统根目录解析，通常从根目录运行生成器。
- operations 渲染器自身输出 `operations/<environment>/...`，因此其 output 应为 `.`，不要再设置为 `operations` 导致重复一层。
- refine 可按 frontend 名称选择输出目录，选择多个 frontend 时还可能生成各自目录。需要固定工程位置的系统脚本，应从统一配置读取 output 并显式传给生成器，不在脚本中重复写路径常量。
- 多前端系统按 frontend 声明分别生成，明确每个前端的输出位置，不能把不同前端写进同一个目录。
- `workspaceFiles.overwrite: false` 用于保留已有根级 README/AGENTS 等工作区文件，不代表全部生成源码都不会被覆盖。

本机覆盖使用已有 `.medol/medol.local.yml` 合并机制，例如覆盖私有镜像仓库地址；配置样例可以提交，真实本机覆盖和密钥不能提交。不要另写一套 output.json、私有目录解析器或模块名判断。

## 工程与部署的区别

目录名称、MEDOL context、deployment、frontend 和 Maven module 不是同一个概念。

- context 表示业务边界，不要求每个 context 都拆成独立进程。
- deployment 描述后端部署边界；frontend 描述前端应用及其包含的业务入口。
- 后端输出目录承载生成工程；多个 deployment 可以在该目录形成 Maven reactor、共享内核和各部署模块。
- 单 deployment 可以生成一个普通 Maven 工程，不为了模仿多部署系统而机械增加 shared-kernel、support 或 runtime-agent 模块。

`federation-learning` 的后端工程、两个管理端和 runtime engine 来自实际联邦学习职责。LIMS 当前只有一个 `LimsBackend` 和一个 `LimsConsole`，因此采用 `lims-backend/` 与 `lims-console/`，不复制联邦学习的 runtime-agent 或训练引擎。

## 生成和手写代码边界

业务系统仓库需要同时保存可再生成的工程源码与不应被覆盖的业务扩展。

| 范围 | 处理方式 |
| --- | --- |
| Axon5 `context/...`、生成命令/事件/投影/API | 通过模型和生成器维护，不直接修改补丁 |
| 后端稳定 `domain/...`、`infrastructure/...` 扩展点 | 按生成工程约定编写业务实现，纳入版本管理 |
| 前端生成资源/表单与稳定扩展 | 遵守该工程 AGENTS/EXTENSIONS 说明 |
| 框架级重复缺陷 | 修复 `code-generator`，再重新生成 |
| 系统编排、字典初始化、文档 | 放系统根目录的相应目录，不藏进某一个后端模块 |

具体扩展路径以生成工程为准；`context` 也可能是物理目录，而包名与稳定扩展目录由生成器确定。不能凭某一示例的包名硬编码业务目录。

默认纳入版本管理：模型源、CodegenModel、公共生成配置、应用源码、构建配置/锁文件、部署模板、初始化定义、文档和手写扩展。不能因为源码是生成的就忽略整个正式后端/前端工程。

默认忽略：`node_modules/`、`target/`、`dist/`、日志、构建/运行缓存、数据库与持久卷、真实 `.env`、本机配置、真实 Kubernetes Secret 和私有镜像覆盖。不要一概忽略整个 `.medol/` 或 `operations/`。

## 调整旧结构

1. 确定唯一模型源，迁移至 `.medol/source.medol`，保留原始需求文档。
2. 把 CodegenModel 移至 `.medol/codegen-model.json`，建立 `.medol/medol.yml`。
3. 移动已有应用工程和稳定扩展，不通过清空重建丢掉手写代码、依赖或配置。
4. 将部署目录归并为根级 `operations/`；operations 生成的文档支撑工具归到根级 `docs/`。
5. 修改导出脚本、生成脚本、测试、README 和 AGENTS，去除旧目录硬编码。
6. 从新结构重新导出、生成、测试和编译，确认没有再生成旧包装目录。
7. 重启仍引用旧路径的开发服务，检查输出配置、本机覆盖以及版本管理忽略规则。

项目结构调整本身不应修改业务状态机、租户启用方式或权限规则。是否需要拆出支撑服务，必须由业务/部署设计决定，不能为凑目录结构改变模型。
