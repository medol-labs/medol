# GB/T 8567—2006 软件项目文档

编制独立软件需求规格说明时，使用 `documentKind: "srs"` 的项目资料。该入口按第 7.11 节输出第 1 至 7 章以及 3.1 至 3.24 各条。项目资料以 `sectionNotes` 编写逐条说明，以国标条号归置可独立验收的编号需求，并以 `interfaceMap` 提供外部接口的端点及信息流。每个能力条目应写明输入、处理要求、输出和合格判据。性能、容量或交付指标尚待审批时，在第 6 章登记。

```sh
npm run docs:generate -- /path/to/source.medol \
  --profile=gbt-8567-2006 --kind=srs \
  --materials=/path/to/srs.materials.json \
  --out=/path/to/srs.md
```

在同一命令加 `--json` 可保存 Markdown、需求追溯、来源哈希和文档哈希。独立资料的主模型文件应与 CLI 输入一致。模型外的需求可通过 `references` 标明参考文件编号及定位，例如运行引擎的接口章节。引用批准用例时写明具体覆盖范围，用例 ID 和状态由项目用例登记文件核对。

MEDOL 的 `gbt-8567-2006` 编制配置按当前模型和项目资料生成四份中文 Markdown。SRS 对照 §7.11，SDD 对照 §7.13，DBDD 对照 §7.14，STD 对照 §7.15。第一版面向已选定的业务范围，章条按项目编制需要裁剪。

```sh
npm run docs:generate -- /path/to/source.medol \
  --profile=gbt-8567-2006 \
  --materials=/path/to/document-materials.json \
  --out-dir=/path/to/generated/gbt-8567
```

`--out-dir` 生成 `srs.md`、`sdd.md`、`dbdd.md`、`std.md` 和 `traceability.json`。使用四册资料单独输出一册时，仍校验四册的追溯。未指定配置时使用既有通用文档生成方式。

项目资料采用 JSON，字段由 `gbt8567MaterialsSchema` 校验。

| 字段 | 内容 |
| --- | --- |
| `schemaVersion`、`project`、`scope`、`revision` | 资料版本固定为 1，并记录同一软件项目的名称、当前覆盖范围和文档修订。 |
| `sources` | 依据的标识、标题、文件路径。路径相对资料 JSON。CLI 检查文件存在，并为引用记录 SHA-256。 |
| `requirements` | 稳定需求编号、需求正文、验收条件、验证方法和来源。 |
| `architecture`、`designs` | 项目级协作顺序，以及设计决策、组件、权衡、关联需求和模型切片。 |
| `components` | 可选。组件职责、边界、对应设计和来源。指定 `modelUnit` 时，从当前模型查找部署或前端，展开上下文与后端分配。手写服务和运行工具可独立列出。 |
| `interfaces` | 可选。调用双方、接口要求、载荷、关联标识和失败处理，每项对应设计及验证用例。在 SRS、SDD 与 STD 分别呈现相应内容。 |
| `storage` | 数据归属、物理存储、生命周期、访问方式、关联需求和逻辑投影。可补充实际约束及恢复核验方法。 |
| `environment`、`tests` | 测试准备及约束，以及用例编号、前置条件、步骤、预期结果和关联需求。可指定留存证据、清理步骤和已有模型规格场景。 |
| `indicators` | 设计评价指标的比较基准、测量方法、判据及其依据、对应验证用例。第一版使用模型判据、计划工况和目标待定三类。 |

切片引用用原始 `Context.Slice` 名称，歧义时可用 `Context.Aggregate.Slice`。投影引用用 `Context.ReadModel`，歧义时可用 `Context.Slice.ReadModel`。运行引擎、适配器、基础设施等模型外事实可通过设计或数据条目及其文件来源表达。中文业务标题与说明写在项目资料中，模型和代码引用保留原始标识。

用例的 `modelScenarios` 通过 `workflow` 和 `scenario` 引用模型已有场景。STD 展开场景的前序事件、触发命令和预期结果，同时保留系统测试的输入、步骤和证据。场景引用失效时停止生成。

设计条目的 `details` 可按实际执行边界分组说明实现细节。DBDD 正文组织数据归属、访问和恢复说明，逻辑投影数据字典集中收录被引用的字段、事件来源及可用条件。同一投影被多个数据设计引用时统一维护一处定义。

需求编号由项目维护。设计、数据、用例共同引用需求编号，生成器据此构造四册共享的追溯表。配置内重复编号、未知引用、歧义模型引用、缺少对应项及没有相应用例的指标会阻止生成。`traceability.json` 同时记录
模型绑定、各文档哈希、输入模型文件哈希、资料哈希和引用文件哈希。文件哈希可用于核对输入和产物版本，资料中的工程陈述仍需审校。指标实测值与结论由同一交付版本的软件测试报告记录。

参见[国家标准信息](https://openstd.samr.gov.cn/bzgk/std/newGbInfo?hcno=84C42B6277D2714B7176B10C6E6B1A44)。
