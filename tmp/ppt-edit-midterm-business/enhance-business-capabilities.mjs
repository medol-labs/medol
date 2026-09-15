import fs from "node:fs/promises";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";

const sourcePptx =
  "/Users/bryce/codes/medo/event-modeling/medol/tmp/课题4中期汇报修改20260831.pptx";
const outputPptx =
  "/Users/bryce/codes/medo/event-modeling/medol/tmp/课题4中期汇报修改20260831-业务能力版.pptx";
const previewDir =
  "/Users/bryce/codes/medo/event-modeling/medol/tmp/ppt-edit-midterm-business/final-preview";

async function writeBlob(path, blob) {
  await fs.writeFile(path, new Uint8Array(await blob.arrayBuffer()));
}

function setText(presentation, id, text, style = undefined) {
  const shape = presentation.resolve(id);
  shape.text = text;
  if (style) {
    shape.text.style = { ...shape.text.style, ...style };
  }
}

async function main() {
  await fs.mkdir(previewDir, { recursive: true });

  await fs.writeFile(
    "/Users/bryce/codes/medo/event-modeling/medol/tmp/ppt-edit-midterm-business/template-audit.txt",
    [
      "Source deck: one-slide architecture overview.",
      "Reuse contract: keep the original slide, shapes, colors, arrows, and hierarchy.",
      "Edit scope: replace text with updated Federation Learning business capabilities and lightly tighten labels.",
      "No external assets or external claims were introduced.",
    ].join("\n"),
  );
  await fs.writeFile(
    "/Users/bryce/codes/medo/event-modeling/medol/tmp/ppt-edit-midterm-business/template-frame-map.json",
    JSON.stringify(
      {
        outputSlides: [
          {
            outputSlide: 1,
            sourceSlide: 1,
            narrativeRole: "business capability architecture overview",
            reuseMode: "duplicate-slide",
            editTargets: [
              { shapeId: "sh/432dwn6l", action: "rewrite" },
              { shapeId: "sh/7qp4be9c", action: "rewrite" },
            ],
          },
        ],
        omittedSourceSlides: [],
      },
      null,
      2,
    ),
  );
  await fs.writeFile(
    "/Users/bryce/codes/medo/event-modeling/medol/tmp/ppt-edit-midterm-business/deviation-log.txt",
    "Text-only enhancement. Original one-slide structure and visual system preserved.\n",
  );

  const presentation = await PresentationFile.importPptx(
    await FileBlob.load(sourcePptx),
  );

  const replacements = {
    "sh/432dwn6l": "1.2.3 事件驱动的联邦学习平台业务能力架构",
    "sh/7qp4be9c":
      "面向多组织协同训练：数据治理、节点接入、任务编排、模型聚合与审计闭环",
    "sh/sryl4zqx": "业务入口",
    "sh/fu94fe98": "统一 Console、开放 API、服务间 Token、运营看板",
    "sh/wn6dc7eh": "组织入驻",
    "sh/hofulsf2": "节点接入",
    "sh/ul4vaxgb": "数据治理",
    "sh/vmdcj2xw": "训练任务",
    "sh/4r6dg7et": "模型资产",
    "sh/ipovexwn": "业务协同层",
    "sh/dgzetcfa": "参与角色",
    "sh/1cvuxc7e": "平台管理员",
    "sh/0bmd476t": "组织参与方",
    "sh/zadcv2p8": "联盟管理",
    "sh/e94v2hon": "数据负责人",
    "sh/90ve1w7q": "训练运营",
    "sh/ozmd8r65": "平台运维",
    "sh/p4bu5s76": "Federation Learning Platform",
    "sh/uxgjq907":
      "平台业务：组织/运行时治理、特征 Schema、训练配置、任务提交",
    "sh/vyp0je1s": "参与方筛选\n按联盟/Schema/节点匹配",
    "sh/wzy1szid": "训练编排\n轮次、计划、状态推进",
    "sh/h072l4jy": "安全聚合\n密钥上下文与更新收集",
    "sh/i1gje90j": "全局模型：聚合产物登记、版本留痕、可追溯",
    "sh/j2pkne14": "查询视图：业务列表、仪表盘、动态筛选",
    "sh/y5wjip0z": "Runtime Agent",
    "sh/z650ba1k": "本地节点注册",
    "sh/z2xgf6to": "执行计划接收",
    "sh/e1oz61c3": "数据集校验/画像",
    "sh/14fyhgbe": "训练引擎调度",
    "sh/036h8but": "训练结果回传",
    "sh/mpozalcz": "支撑服务",
    "sh/9sfylgbq": "账号权限",
    "sh/or6hcvu5": "文件暂存",
    "sh/buh0nqtg": "模型仓库",
    "sh/at8zelcb": "字典配置",
    "sh/8zqx4vq9": "审计日志",
    "sh/kvqx0vqd": "计划\n下发",
    "sh/lwzy90ry": "指标\n更新",
    "sh/xsfy5grm": "业务能力统一输出",
    "sh/cby5k3yt": "部署与运行能力",
    "sh/ra54bix8": "Compose",
    "sh/q9wnidgn": "K3s/K8s",
    "sh/5onm98f2": "PostgreSQL",
    "sh/4ne5g3yh": "UmaDB",
    "sh/3m547yxw": "Runtime Engine",
    "sh/9kr6lsfm": "对象存储",
    "sh/oji5sne1": "镜像脚本",
    "sh/6psjmpwj": "日志遥测",
  };

  for (const [id, text] of Object.entries(replacements)) {
    setText(presentation, id, text);
  }

  const subtleText = {
    fontSize: 11,
    color: "#475569",
  };
  for (const id of [
    "sh/fu94fe98",
    "sh/uxgjq907",
    "sh/i1gje90j",
    "sh/j2pkne14",
    "sh/036h8but",
  ]) {
    setText(presentation, id, replacements[id], subtleText);
  }

  const slide = presentation.slides.getItem(0);
  await writeBlob(
    `${previewDir}/slide-01.png`,
    await presentation.export({ slide, format: "png", scale: 1 }),
  );
  await fs.writeFile(
    `${previewDir}/slide-01.layout.json`,
    await (await slide.export({ format: "layout" })).text(),
  );
  await writeBlob(
    `${previewDir}/montage.webp`,
    await presentation.export({ format: "webp", montage: true, scale: 1 }),
  );

  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(outputPptx);
  console.log(outputPptx);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
