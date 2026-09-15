import fs from "node:fs/promises";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const outDir = "/Users/bryce/codes/medo/event-modeling/medol/tmp/ppt-build/fl-deployment-modules";
const finalPptx = "/Users/bryce/codes/medo/event-modeling/medol/tmp/联邦学习子系统部署模块展示.pptx";

async function writeBlob(path, blob) {
  await fs.writeFile(path, new Uint8Array(await blob.arrayBuffer()));
}

function addTextbox(slide, name, text, position, style = {}) {
  const shape = slide.shapes.add({
    geometry: "textbox",
    name,
    position,
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  shape.text = text;
  shape.text.style = {
    fontFace: "Arial Unicode MS",
    fontSize: 18,
    color: "#1F2937",
    ...style,
  };
  return shape;
}

function addPanel(slide, name, position, fill = "#F7F9FC", stroke = "#CBD5E1") {
  return slide.shapes.add({
    geometry: "rect",
    name,
    position,
    fill,
    line: { style: "solid", fill: stroke, width: 1 },
  });
}

function addModule(slide, module, left) {
  const top = 160;
  const width = 346;
  const panelHeight = 286;
  const shotTop = 476;
  const shotHeight = 158;

  addPanel(slide, `${module.key}-summary-panel`, {
    left,
    top,
    width,
    height: panelHeight,
  });

  addTextbox(
    slide,
    `${module.key}-title`,
    module.title,
    { left: left + 22, top: top + 22, width: width - 44, height: 34 },
    { fontSize: 24, bold: true, color: module.color }
  );

  addTextbox(
    slide,
    `${module.key}-subtitle`,
    module.subtitle,
    { left: left + 22, top: top + 60, width: width - 44, height: 34 },
    { fontSize: 16, color: "#64748B" }
  );

  module.points.forEach((point, index) => {
    addTextbox(
      slide,
      `${module.key}-point-${index + 1}`,
      point,
      { left: left + 28, top: top + 108 + index * 50, width: width - 58, height: 44 },
      { fontSize: 16, color: "#111827", bold: index === 0 }
    );
  });

  addPanel(
    slide,
    `${module.key}-screenshot-frame`,
    { left, top: shotTop, width, height: shotHeight },
    "#FFFFFF",
    "#94A3B8"
  );

  addTextbox(
    slide,
    `${module.key}-screenshot-label`,
    "系统截图空间",
    { left: left + 34, top: shotTop + 50, width: width - 68, height: 34 },
    { fontSize: 24, bold: true, color: "#64748B", alignment: "center" }
  );

  addTextbox(
    slide,
    `${module.key}-screenshot-hint`,
    module.screenshotHint,
    { left: left + 34, top: shotTop + 88, width: width - 68, height: 42 },
    { fontSize: 14, color: "#94A3B8", alignment: "center" }
  );
}

async function main() {
  await fs.mkdir(outDir, { recursive: true });

  const presentation = Presentation.create({
    slideSize: { width: 1280, height: 720 },
  });

  const slide = presentation.slides.add();
  slide.background.fill = "#FFFFFF";

  addTextbox(
    slide,
    "eyebrow",
    "联邦学习子系统 | 部署模块能力总览",
    { left: 72, top: 48, width: 520, height: 28 },
    { fontSize: 16, bold: true, color: "#3D8DFF" }
  );

  addTextbox(
    slide,
    "title",
    "三个部署模块承接平台管理、业务编排与运行侧执行",
    { left: 72, top: 82, width: 980, height: 52 },
    { fontSize: 38, bold: true, color: "#0F172A" }
  );

  addTextbox(
    slide,
    "subtitle",
    "基于 federation learning 建模与安装部署文档梳理；下方保留截图位置，便于后续替换为真实系统界面。",
    { left: 72, top: 132, width: 940, height: 28 },
    { fontSize: 18, color: "#475569" }
  );

  const modules = [
    {
      key: "web",
      title: "Web 管理端",
      subtitle: "统一业务入口与可视化操作台",
      color: "#2563EB",
      points: [
        "组织、联邦、数据集、模型与训练任务管理",
        "运行时状态、审批结果与业务视图展示",
        "支持平台管理员、组织管理员和业务用户操作",
      ],
      screenshotHint: "建议放置首页、训练编排或运行时监控截图",
    },
    {
      key: "backend",
      title: "平台后端服务",
      subtitle: "领域规则、事件状态与集成编排中心",
      color: "#0F766E",
      points: [
        "命令校验、业务规则、事件记录和状态流转",
        "模型仓库、训练编排、安全聚合与运行时治理",
        "对接数据库、对象存储、消息调度和外部服务",
      ],
      screenshotHint: "建议放置接口、任务流或运维监控截图",
    },
    {
      key: "agent",
      title: "运行时代理",
      subtitle: "连接组织侧算力与平台控制面",
      color: "#7C3AED",
      points: [
        "代理启动、自检、认证连接和健康上报",
        "数据集画像、契约校验、训练轮次执行",
        "隔离本地数据访问，回传训练结果和资源状态",
      ],
      screenshotHint: "建议放置代理状态、任务执行或节点资源截图",
    },
  ];

  [72, 467, 862].forEach((left, index) => addModule(slide, modules[index], left));

  slide.notes = `Sources:
examples/fl/federation-learning.medol
tmp/联邦学习子系统文档/3.5-“感-通-算”一体化的跨域健康管理联邦孪生平台-安装部署手册-联邦学习子系统.md
tmp/联邦学习子系统文档/3.2-“感-通-算”一体化的跨域健康管理联邦孪生平台-软件设计说明-联邦学习子系统.md`;

  const png = await presentation.export({ slide, format: "png", scale: 1 });
  await writeBlob(`${outDir}/slide-1.png`, png);

  const layout = await slide.export({ format: "layout" });
  await fs.writeFile(`${outDir}/slide-1.layout.json`, await layout.text());

  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(finalPptx);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
