# 文件上传（FileUpload）

[总体说明](README.md) · [内置建模原文](../../src/builtin-models/file-upload.medol)

## 建模接入

默认使用内置文件上传能力时，只需要 import：

```medol
import file-upload as PlatformFileUpload deploy FederationLearningSupport
```

内置 `FileUpload` 自身已经包含：

- `UploadFile`：上传文件并记录文件元数据。
- `DownloadFile`：按 `fileId` 授权下载。
- `MarkFileReferenced`：业务记录接收文件引用后标记引用关系。
- `DiscardFile`：丢弃未被业务引用的文件。
- `ExpireFile`：按保留策略过期文件。
- `UploadedFileCatalog`：文件上传记录目录。

业务模型不需要再内联 `context FileUpload`。业务命令中需要上传文件时，使用字段属性 `uploadFile` 标记浏览器文件字段：

```medol
command RegisterModelArtifact {
  modelArtifactId: UUID id generated technical
  uploadedFile: String uploadFile
  fileId: UUID?
}
```

生成的前端会先把 `uploadFile` 字段提交到内置 FileUpload 部署，再把返回的文件引用交给业务命令。业务上下文仍然只负责自己的业务语义，例如模型制品、数据集附件或证明材料；物理存储、下载授权、保留期和文件目录由内置 `FileUpload` 负责。

如果业务前端需要展示上传文件管理页，可以在 frontend 中引用内置上传目录：

```medol
frontend FederationLearningConsole {
  includes FileUpload from FederationLearningSupport
}
```

`FileUpload` 适合做通用内置能力，因为它和 IAM、Dictionary 一样属于平台级支撑能力。业务模型可以直接引用；只有后续需要接入自定义存储目录、外部对象存储元数据或跨部署同步投影时，才需要再通过 `extend` 增加明确扩展点。

## 生命周期与当前边界

新引用仅选择 Available 文件；下载允许 Available、Referenced；Discard/Expire 仅允许 Available，避免误删已引用文件。当前仍为单次引用模型。

多处文件引用、解除引用及引用中的过期策略，需要独立的引用关系模型。

## 存储与部署配置

`import file-upload` 引入文件业务流程，不会创建对象存储服务。文件实际落点、访问地址、下载授权和保留策略由生成项目的存储/下载适配实现负责；按项目的具体适配器配置，不假设存在统一的 S3 或 MinIO 环境变量。

接入时确认：前端能访问 FileUpload 所在后端；该后端具备存储权限；业务命令保存返回的文件引用；下载走授权入口。数据库中的文件元数据与物理文件需要分别考虑持久化和恢复。

`uploadFile` 表示浏览器上传二进制后提交引用，`file` 表示命令已持有文件引用。不要把本机路径当作跨部署可用的下载地址。文件状态与引用关系仍按本页列出的模型限制执行。
