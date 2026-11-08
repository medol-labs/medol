# 身份与权限（IdentityAccessManagement）

[总体说明](README.md) · [内置建模原文](../../src/builtin-models/identity-access-management.medol)

## 建模接入

默认使用内置 IAM 时，只需要 import：

```medol
import identity-access-management as PlatformIam deploy FederationLearningSupport
import identity-access-management as ParticipantIam deploy FederationLearningRuntimeAgent
```

不需要额外写：

```medol
extend PlatformIam {
  actors PlatformAdmin
}
```

业务 slice 中已有的 `actor` 会继续作为业务权限生成的输入。当前 IAM 的默认接入不依赖 `extend`。

只有当 IAM 后续明确提供扩展点，例如外部账号目录、外部角色目录、自定义授权目录等，业务模型才应使用 `extend` 接入。

## 生命周期与当前边界

用户名（含停用账号）、角色编码、权限编码唯一；账号可停用和恢复；分配角色仅允许 Active，且不激活账号；账号目录只允许选择 Active 账号。

IAM 撤销分配事件对关联目录的删除/失效投影、Token 撤销及账号停用对已有 Token 的处理，需要连同认证和投影实现补齐。

## 认证与运行配置

IAM 模型负责账号、角色、权限与分配；登录、管理员初始化、Supabase 验证、Portal SSO 属于生成的认证基础设施，不需要另写业务 slice。配置入口是生成后端的 `application.yml` / `.env`，主要参数如下：

| 配置 | 用途 |
| --- | --- |
| `MEDOL_SECURITY_PROVIDER` | 认证 provider，默认 `local`；外部身份接入按实际 provider 配置 |
| `MEDOL_SECURITY_JWT_SECRET` | 本地签发 token 的密钥 |
| `MEDOL_SECURITY_LOCAL_TOKEN_TTL_SECONDS` | 本地 token 有效期，默认 28800 秒 |
| `MEDOL_SECURITY_ALLOWED_ORIGINS` | 前端允许来源 |
| `MEDOL_SECURITY_INTERNAL_TOKEN` | 内部服务调用凭证；调用方与接收方需匹配 |
| `MEDOL_SECURITY_ADMIN_BOOTSTRAP_ENABLED` / `MEDOL_SECURITY_ADMIN_BOOTSTRAP_SETUP_TOKEN` | 管理员初始化入口开关与初始化凭证 |
| `SUPABASE_JWT_ISSUER_URI` / `SUPABASE_JWT_JWK_SET_URI` | Supabase 身份令牌校验 |
| `MEDOL_SECURITY_PORTAL_SSO_ENABLED` / `MEDOL_SECURITY_PORTAL_SSO_JWT_SECRET` | Portal SSO 开关与校验密钥 |
| `MEDOL_SECURITY_PORTAL_SSO_ISSUER` / `MEDOL_SECURITY_PORTAL_SSO_AUDIENCE` | Portal SSO 签发者与接收者校验 |

Portal 前端入口为 `/sso/portal?token=<portal-jwt>&redirect=/target-page&systemSource=PORTAL`，后端为 `POST /api/auth/exchange-portal-jwt`。首次登录通过 `RegisterUserAccount` 注册账号；`systemSource` 写入技术字段 `userSource`，缺省时使用 `MEDOL_SECURITY_PORTAL_SSO_USER_SOURCE`，默认 `PORTAL_SSO`。

`userSource` 不授予权限。新注册账号仍需分配角色与权限，获得会话不等于可以访问所有菜单和命令。前端也不应要求操作人员填写 `userSource`。
