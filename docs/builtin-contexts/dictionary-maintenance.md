# 字典维护（DictionaryMaintenance）

[总体说明](README.md) · [内置建模原文](../../src/builtin-models/dictionary-maintenance.medol)

## 建模接入

默认使用内置字典能力时，只需要 import：

```medol
import dictionary-maintenance as PlatformDictionary deploy FederationLearningSupport
```

内置 `DictionaryMaintenance` 自身已经包含字典目录、字典值、字典值翻译等管理模型，并声明了自己的默认 provider：

```medol
extend DictionaryMaintenance {
  provider dictionaryValues from DictionaryValueCatalog {
    code dictionaryCode
    value valueCode
    label defaultDisplayName
    active active
    state state
    order displayOrder
  }

  provider dictionaryTranslations from DictionaryValueTranslationCatalog {
    code dictionaryCode
    value valueCode
    locale locale
    label displayName
    description description
  }
}
```

业务模型不需要再内联 `context DictionaryMaintenance`。

## 跨部署字典同步

如果某个 deployable 不能直接使用平台端字典 readmodel，而是需要同步一份本地投影，则可以用 `extend` 把本地同步投影接入字典能力。

示例：

```medol
context RuntimeAgentOperations {
  slice AgentDictionaryValueCatalog {
    sync readmodel AgentDictionaryValueCatalog[] from DictionaryMaintenance.DictionaryValueCatalog {
      dictionaryValueId: UUID id
      dictionaryId: UUID
      dictionaryCode: String query
      valueCode: String
      defaultDisplayName: String display
      displayOrder: Int?
      active: Boolean query
      state: String
      syncedAt: DateTime
    }
  }

  slice AgentDictionaryValueTranslationCatalog {
    sync readmodel AgentDictionaryValueTranslationCatalog[] from DictionaryMaintenance.DictionaryValueTranslationCatalog {
      dictionaryValueTranslationId: UUID id
      dictionaryValueId: UUID
      dictionaryCode: String query
      valueCode: String query
      locale: String query
      displayName: String display
      description: Text?
      syncedAt: DateTime
    }
  }

  extend DictionaryMaintenance {
    provider dictionaryValues from AgentDictionaryValueCatalog {
      code dictionaryCode
      value valueCode
      label defaultDisplayName
      active active
      state state
      order displayOrder
    }

    provider dictionaryTranslations from AgentDictionaryValueTranslationCatalog {
      code dictionaryCode
      value valueCode
      locale locale
      label displayName
      description description
    }
  }
}
```

这里的 `extend` 表示 runtime agent 侧使用自己的同步 readmodel 作为字典能力的数据来源。

## 生命周期与当前边界

新增值必须选择 Registered 字典；同一字典的 valueCode 唯一；新增值的 active 必须为 true，停用通过独立命令完成；字典值目录只选择 Active 值。

归档字典后，对已有字典值的跨投影联动禁用：当前限制新增值，已有值的父目录联动仍需通用关联校验/投影更新能力。不能加一个不会被正确维护的派生字段来模拟。

## 配置与使用顺序

默认目录与翻译 provider 已由内置模型声明，没有额外的“启用字典”运行开关。

1. 注册字典，再添加字典值及需要的语言翻译。
2. 业务字段按稳定字典编码引用；标签与翻译来自目录，不把显示文本作为业务值。
3. 独立部署需要本地副本时，声明同步 readmodel，并在该 context 内覆盖 provider；同步连接与凭证沿用生成项目的跨服务配置。
4. 前端需要管理字典时，在对应 frontend 中包含 `DictionaryMaintenance`。仅绑定目录不会自动添加管理页面。

多部署的字典副本与平台目录不是共享数据库配置。同步延迟、父字典归档与既有值的联动限制应按本页“生命周期与当前边界”处理。
