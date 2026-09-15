import fs from "node:fs/promises";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";

const sourcePptx = "/Users/bryce/codes/medo/event-modeling/medol/tmp/副本课题4中期汇报修改20260810.pptx";
const outputPptx = "/Users/bryce/codes/medo/event-modeling/medol/tmp/课题4中期汇报修改20260831.pptx";
const previewDir = "/Users/bryce/codes/medo/event-modeling/medol/tmp/ppt-edit-midterm-current/final-preview";

async function writeBlob(path, blob) {
  await fs.writeFile(path, new Uint8Array(await blob.arrayBuffer()));
}

async function main() {
  await fs.mkdir(previewDir, { recursive: true });

  const presentation = await PresentationFile.importPptx(await FileBlob.load(sourcePptx));

  const replacements = {
    "sh/7qp4be9c": "MEDOL 建模驱动 / 3 个后端部署 / 1 套前端 / 生成代码与手写扩展分层",
    "sh/fu94fe98": "统一 Console、开放 API、认证授权、治理看板",
    "sh/wn6dc7eh": "开放 API",
    "sh/hofulsf2": "训练运营",
    "sh/ul4vaxgb": "组织协作",
    "sh/vmdcj2xw": "运行监控",
    "sh/4r6dg7et": "审计治理",
    "sh/ipovexwn": "核心协同层",
    "sh/dgzetcfa": "用户与节点",
    "sh/1cvuxc7e": "平台管理员",
    "sh/0bmd476t": "组织参与方",
    "sh/zadcv2p8": "组织/联盟",
    "sh/e94v2hon": "数据/模型",
    "sh/90ve1w7q": "训练/聚合",
    "sh/ozmd8r65": "运行/监控",
    "sh/p4bu5s76": "Federation Learning Platform",
    "sh/uxgjq907": "API / 应用服务层：接收命令、鉴权校验、编排用例",
    "sh/vyp0je1s": "命令与领域模型\nMEDOL 表达业务规则",
    "sh/wzy1szid": "事件流\n驱动投影与自动化",
    "sh/h072l4jy": "自动化处理器\n跨上下文异步协同",
    "sh/i1gje90j": "读模型 / 查询视图：看板、监控、治理查询",
    "sh/j2pkne14": "查询能力：JHipster Criteria / Supabase-ready",
    "sh/y5wjip0z": "Runtime Agent",
    "sh/z650ba1k": "Agent API",
    "sh/z2xgf6to": "Execution Planner",
    "sh/e1oz61c3": "Dataset Adapter",
    "sh/14fyhgbe": "Model Update Reporter",
    "sh/036h8but": "执行计划 → 本地训练\n模型更新 → 平台闭环",
    "sh/mpozalcz": "支撑能力",
    "sh/9sfylgbq": "IAM",
    "sh/or6hcvu5": "文件上传",
    "sh/buh0nqtg": "模型仓库",
    "sh/at8zelcb": "告警通知",
    "sh/8zqx4vq9": "审计治理",
    "sh/cby5k3yt": "基础设施与部署",
    "sh/ra54bix8": "Docker Compose",
    "sh/q9wnidgn": "K3s / K8s",
    "sh/5onm98f2": "PostgreSQL",
    "sh/4ne5g3yh": "UmaDB 0.7.8",
    "sh/3m547yxw": "Supabase",
    "sh/9kr6lsfm": "对象存储",
    "sh/oji5sne1": "CI/CD",
    "sh/6psjmpwj": "日志 / 遥测",
  };

  for (const [id, text] of Object.entries(replacements)) {
    const shape = presentation.resolve(id);
    shape.text = text;
  }

  const slide = presentation.slides.getItem(0);
  await writeBlob(`${previewDir}/slide-01.png`, await presentation.export({ slide, format: "png", scale: 1 }));
  await fs.writeFile(`${previewDir}/slide-01.layout.json`, await (await slide.export({ format: "layout" })).text());
  await writeBlob(`${previewDir}/montage.webp`, await presentation.export({ format: "webp", montage: true, scale: 1 }));

  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(outputPptx);
  console.log(outputPptx);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
