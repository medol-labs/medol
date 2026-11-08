# 模板与文档生成

`document-generation` 提供模板版本管理、业务数据快照、异步 PDF 生成、重试与受控下载。它生成业务单据，不负责审批、签章或对外送达。MEDOL 自身的设计文档导出是另一项功能。

## 接入与职责

```medol
import document-generation as Documents deploy Support
```

将 `DocumentGeneration` 加入所需前端的 `includes`，即可生成模板和生成任务管理页面，包括模板源文件下载和完成任务的 PDF 下载。不增加 DSL 关键字；生命周期与选择条件沿用 `startsLifecycle`、`reactsTo`、`eligible for`。

在同一后端部署的手写 infrastructure 包注册 `DocumentDataProvider` Spring Bean。接口位于生成应用的 `documentgeneration.infrastructure`，职责如下：

| 接口 | 实现要求 |
| --- | --- |
| `key` | 稳定的业务数据提供者标识，供模板选择 |
| `contract` | 版本化 `DocumentContract`；显式声明对象、数组、字符串、数字、布尔字段及必填性 |
| `authorize(identity, objectRef, action)` | 分别校验 GENERATE 与 READ 的对象权限；拒绝时抛出异常 |
| `snapshot(identity, input)` | 校验业务可用性，读取一致数据，返回 `DocumentSnapshot(sourceVersion, data)` |

快照收集处于主数据库事务中。提供者负责通过锁或合适的读取策略保证跨表一致性，并返回明确的来源版本。不得在取数时改变业务状态；不能接受客户端提供的正式快照。当前没有通过 `extend` 自动绑定任意读模型的功能，必须实现该接口。

## 模板生命周期

1. `CreateDocumentTemplateVersion`：指定模板编码、版本标签、providerKey、contractVersion、rendererKey 和 JSON 内容，创建 Draft。
2. `ReviseDocumentTemplateVersion`：仅允许修改 Draft 内容，携带 expectedRevision 防止并发覆盖。
3. `PublishDocumentTemplateVersion`：校验数据契约和布局，进入 Published。发布后的内容不可修改。
4. `RetireDocumentTemplateVersion`：停止接受新的生成请求；已经受理的任务继续使用原版本。

相同模板编码与版本标签唯一。修改提供者、数据契约或已发布模板时创建新版本。前端选择条件与后端命令校验都限制只有 Published 模板可以创建任务。

## 默认模板格式

rendererKey 使用 `pdfbox-layout`。示例：

```json
{
  "title": "出库单 {{number}}",
  "header": "{{companyName}}",
  "footer": "内部业务单据",
  "blocks": [
    {"type": "text", "text": "客户：{{customerName}}"},
    {"type": "table", "items": "lines", "columns": [
      {"label": "商品", "field": "productName"},
      {"label": "数量", "field": "quantity"}
    ]}
  ]
}
```

提供者契约需要声明上述字段；`lines` 是对象数组。支持标量 `{{字段路径}}`、文本、表格、`{"type":"pageBreak"}`、A4 自动分页、跨页表头、页眉页脚与页码。必填值缺失、类型错误、未知字段或非法表达式会被拒绝；可选字段缺失显示为空。

计算、金额与日期格式由提供者处理；请求中的 locale/timeZone 传给提供者，不会自动格式化任意值。表头过高、无法为数据行留出空间时明确拒绝；预览与正式生成使用相同的输出大小上限。模板不执行 SQL、脚本，不加载外部 URL。首版不支持 DOCX、图片、任意 HTML/CSS 或可视化排版编辑器。

## 生成与恢复

`RequestDocumentGeneration` 接受 documentId、templateVersionId、objectRef、locale、timeZone。受理时固定模板、契约、来源版本、业务快照、渲染器指纹与身份；相同 ID 和输入幂等，冲突输入拒绝。

任务经历 Requested → Processing → Completed / Failed。后台自动重试最多五次，间隔 30 秒，执行租约五分钟。`RetryDocumentGeneration` 需要 expectedRevision，只允许 Failed 或租约已过期的 Processing，并重新检查 GENERATE 权限。重试保留原始快照；要生成新的业务版本，应使用新的 documentId。

生成文件先完整落盘，再提交完成状态；若完成回执丢失，重试复用既有文件。文件和输入具有摘要校验，过期 worker 不能覆盖新执行结果。渲染器版本、字体或分页配置变化会阻止尚未产出的旧任务静默改变结果；可恢复原配置继续执行，或明确发起新请求。

运行状态保存在 JDBC 表，状态更新与 outbox 同一事务提交。outbox 发布建模事件，驱动目录投影及已导入的 `operation-audit`；投影按 revision 忽略旧事件。这里不是以 Axon 事件溯源作为任务主存储。手动重试事件使用实际重试操作者作为审计身份，原申请人保持不变。事件至少投递一次，订阅方必须处理重复；快照不会进入公共事件或审计 payload。

## 配置与存储

加载生成目录中的 `document-generation/application-documents.yml`，例如设置 `SPRING_CONFIG_ADDITIONAL_LOCATION=file:./document-generation/application-documents.yml`。

| 配置 | 默认值 / 用途 |
| --- | --- |
| `MEDOL_DOCUMENTS_ENABLED` | false，显式开启处理 |
| `MEDOL_DOCUMENTS_STORAGE_PATH` | build/documents，正式部署必须使用持久卷 |
| `MEDOL_DOCUMENTS_FONT_PATH` | 空，使用 Helvetica；中文必须配置包含所需字形的 TTF |
| `medol.documents.max-pages` | 200，可配置范围 1–1000 |

默认本地存储先同步文件和 staging 目录，再通过完整目录的原子重命名发布 PDF 与校验回执，最后同步存储根目录；多实例必须共享同一持久目录。文件系统必须支持原子目录移动与目录同步。自定义对象存储实现 `DocumentArtifactStore`，必须保证完整发布、幂等与摘要校验。文件归生成任务所有，未套用 FileUpload 的单引用生命周期。

限制：模板 256 KiB、快照 4 MiB、输出 32 MiB、字体 32 MiB。数据库迁移由生成的 Flyway SQL 提供。业务快照、执行记录、outbox 与文件都必须纳入备份，不能当成可任意删除的读投影。崩溃遗留 staging 目录只能在确认无执行者使用后清理。

## API 与权限

| API | 用途 |
| --- | --- |
| `POST /api/documents/templates/import` | multipart 上传 JSON 模板，另附模板 ID、编码、版本、提供者、契约版本和渲染器参数 |
| `GET /api/documents/templates/{id}/source` | 下载模板原文 |
| `POST /api/documents/templates/{id}/preview` | 使用符合契约的样例 JSON 预览，不建立正式任务 |
| `GET /api/documents/{id}` | 获取任务元数据，不暴露快照 |
| `GET /api/documents/{id}/file` | 校验 READ 对象权限与摘要后下载 PDF |

上述接口同时使用生成的命令/目录权限。身份来自登录用户，不能由请求正文伪造。普通 `GeneratedDocumentCatalog` 是操作管理员的元数据目录，其通用查询接口未按提供者做逐对象过滤，不能作为普通用户的历史单据列表；应谨慎授予目录读权限。模板预览只使用样例，不应上传敏感正式快照。

首版不支持 tenant-management，组合导入会明确拒绝。提供者必须位于同部署、同主数据库事务边界。调度或通知等业务联动可围绕已建模命令与事件另行接入，本能力不会默认安排生成或自动发送文件。
