# 数据交换（DataExchange）

[总体说明](README.md) · [内置建模原文](../../src/builtin-models/data-exchange.medol)

## 建模接入

默认使用内置数据交换能力时，只需要 import：

```medol
import data-exchange as PlatformDataExchange deploy FederationLearningSupport
```

内置 `DataExchange` 自身包含导出任务、导出文件下载与导入任务：

- `DataExportJob`：记录导出请求、处理状态、文件位置、下载地址、行数和失败信息。
- `DownloadDataExportFile`：导出 job 完成后，`DataExportJobCatalog` 通过 `eligible for DownloadDataExportFile when { DataExportJob.state == Completed }` 暴露下载动作。
- `DataImportJob`：记录导入请求、上传文件、请求哈希、处理状态、成功/失败行数和失败索引位置。

业务模型通过简单标记接入通用导出或导入：

```medol
readmodel RuntimeNodeInventoryCatalog[] {
  exportable by PlatformDataExchange
  runtimeNodeInventoryId: UUID id
  runtimeName: String display
}

command RegisterRuntimeNodeInventory {
  importable by PlatformDataExchange
  runtimeNodeInventoryId: UUID id
  runtimeName: String display
  nodeReady: Boolean?
}
```

`exportable` 是 readmodel 能力，表示当前查询页面可以按页面可见字段、筛选条件、排序条件导出。

`importable` 是 command 能力，表示上传文件后由通用导入 job 逐行转换为该业务命令并提交。导入不是“把 readmodel 反写回业务表”，也不是绕过业务规则直接写事件；每一行都会进入对应业务 command handler，因此唯一性、状态、引用、eligibility、specification 等业务校验仍由正常业务流程执行。

如果导入语义和页面新增/修改完全一致，可以直接把正常业务命令标记为 `importable`。如果导入语义不同，例如允许 upsert、允许跳过重复行、允许覆盖某些字段，应建模一个专门的导入业务命令；这个导入业务命令仍然要复用或调用同一套业务 policy/decision，而不是在导入框架里另写一套校验。

一个页面可以出现多个导入入口。只要该页面关联的业务 command 标记了 `importable`，生成前端会为每个导入命令生成独立上传按钮，并提交到对应命令的导入 endpoint。

第一版导入默认支持 CSV。文件先落盘并创建 `DataImportJob`，真正执行由 `DataImportRequested` 事件触发；处理过程按行流式读取，行级失败只写入轻量失败索引，索引包含行号、行哈希和错误信息，不复制完整业务数据。后续下载失败数据或失败行重试时，应基于原始文件和失败索引按需生成失败数据文件。跨服务投递仍然属于 outbox 的适用场景，但导入 job 本身的状态不是 outbox 状态。

## 生命周期与当前边界

Requested → Processing → Completed；Requested/Processing 可进入 Failed；状态转换逐 slice 建模，目录显式订阅全部阶段事件。

导入失败行重试、取消、执行幂等及行数一致性需要完整执行协议；本次只补齐既有阶段的合法转换。

Completed 表示任务处理结束，不表示每一行成功，仍需查看 successRows/failedRows。处理器先提交 Processing，再执行导入/导出，成功后提交 Completed，异常提交 Failed；导入开始时 totalRows 为 0，完成事件记录最终行数。

## 运行配置

配置入口是生成后端的 Spring 配置。默认值如下：

```yaml
medol:
  data-exchange:
    export:
      page-size: 1000
      async-threshold: 10000
      max-rows: 800000
      storage-path: build/data-exports
    import:
      batch-size: 1000
      max-rows: 800000
      max-file-size-bytes: 104857600
      error-preview-limit: 200
      storage-path: build/data-imports
```

生成的 `application.yml` 已提供 `MEDOL_DATA_EXCHANGE_EXPORT_PAGE_SIZE`、`MEDOL_DATA_EXCHANGE_EXPORT_ASYNC_THRESHOLD`、`MEDOL_DATA_EXCHANGE_EXPORT_MAX_ROWS` 的环境变量入口；其余属性可通过标准 Spring 外部配置覆盖。

导入原文件、导出结果以及失败索引需要持久化存储。容器部署应挂载对应目录，并配置上传大小限制；HTTP 层的限制也要与导入配置一致。先生成任务入口，再用小文件核对字段转换、权限和业务拒绝结果，不能只看任务最终是否 Completed。
