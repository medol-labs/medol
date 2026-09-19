import fs from "node:fs/promises";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const FINAL_PPTX = "/Users/bryce/codes/medo/event-modeling/medol/federation-learning-business-capabilities.pptx";
const RENDER_DIR = "/Users/bryce/codes/medo/event-modeling/medol/.codex-ppt-build/rendered";

async function writeBlob(path, blob) {
  await fs.writeFile(path, new Uint8Array(await blob.arrayBuffer()));
}

const deck = Presentation.create({
  slideSize: { width: 1280, height: 720 },
});

const slide = deck.slides.add();
slide.background.fill = "#F7F9FC";

const page = { left: 58, top: 42, width: 1164, height: 636 };
const ink = "#14213D";
const muted = "#5F6B7A";
const blue = "#2563EB";
const green = "#0F766E";
const amber = "#B45309";
const violet = "#6D28D9";
const border = "#CBD5E1";

function textbox(name, text, position, style = {}) {
  const shape = slide.shapes.add({
    geometry: "textbox",
    name,
    position,
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  shape.text = text;
  shape.text.style = {
    fontFace: "Microsoft YaHei",
    fontSize: 18,
    color: ink,
    ...style,
  };
  return shape;
}

function rect(name, position, fill, lineFill = "none", width = 0) {
  return slide.shapes.add({
    geometry: "rect",
    name,
    position,
    fill,
    line: { style: "solid", fill: lineFill, width },
  });
}

textbox(
  "eyebrow",
  "FEDERATION LEARNING PLATFORM",
  { left: page.left, top: page.top, width: 380, height: 28 },
  { fontSize: 13, bold: true, color: "#64748B" },
);

textbox(
  "title",
  "联邦学习平台业务能力概述",
  { left: page.left, top: page.top + 38, width: 760, height: 58 },
  { fontSize: 38, bold: true, color: ink },
);

textbox(
  "subtitle",
  "围绕多机构协作训练，将成员治理、数据准入、运行时接入、训练编排、安全聚合、模型发布和审计运维串成可追踪闭环。",
  { left: page.left, top: page.top + 102, width: 970, height: 52 },
  { fontSize: 20, color: "#334155" },
);

rect("top-rule", { left: page.left, top: 190, width: page.width, height: 2 }, "#D7DEE8");

const columns = [
  {
    title: "协作治理",
    color: blue,
    items: ["组织注册与启停", "联邦创建、邀请与成员状态", "用户与机构绑定"],
  },
  {
    title: "数据与运行时",
    color: green,
    items: ["特征 Schema 版本治理", "Runtime 安装、验证与连接", "数据集声明、画像与准入"],
  },
  {
    title: "训练与聚合",
    color: amber,
    items: ["训练配置、任务提交与轮次调度", "参与方选择与本地执行计划", "安全聚合、更新评估与全局模型"],
  },
  {
    title: "模型与运维",
    color: violet,
    items: ["模型仓库与候选模型登记", "评估包、审批、发布与回滚", "监控告警、审计追踪与文档导出"],
  },
];

const colTop = 214;
const colHeight = 190;
const colGap = 28;
const colWidth = (page.width - colGap * 3) / 4;

columns.forEach((column, index) => {
  const left = page.left + index * (colWidth + colGap);
  rect(`cap-accent-${index + 1}`, { left, top: colTop, width: 44, height: 5 }, column.color);
  textbox(
    `cap-title-${index + 1}`,
    column.title,
    { left, top: colTop + 16, width: colWidth, height: 34 },
    { fontSize: 24, bold: true, color: ink },
  );
  column.items.forEach((item, itemIndex) => {
    const y = colTop + 62 + itemIndex * 39;
    rect(`cap-dot-${index + 1}-${itemIndex + 1}`, { left, top: y + 9, width: 8, height: 8 }, column.color);
    textbox(
      `cap-item-${index + 1}-${itemIndex + 1}`,
      item,
      { left: left + 18, top: y, width: colWidth - 18, height: 30 },
      { fontSize: 16.5, color: "#334155" },
    );
  });
  if (index < columns.length - 1) {
    rect(`separator-${index + 1}`, { left: left + colWidth + colGap / 2, top: colTop + 4, width: 1.2, height: colHeight - 10 }, "#D7DEE8");
  }
});

const screenshotTop = 438;
rect(
  "screenshot-frame",
  { left: page.left, top: screenshotTop, width: page.width, height: 224 },
  "#FFFFFF",
  border,
  1.2,
);
rect(
  "screenshot-inner",
  { left: page.left + 18, top: screenshotTop + 18, width: page.width - 36, height: 188 },
  "#EEF2F7",
  "#D7DEE8",
  1,
);
textbox(
  "screenshot-placeholder",
  "系统截图占位区",
  { left: page.left + 28, top: screenshotTop + 88, width: page.width - 56, height: 34 },
  { fontSize: 24, bold: true, color: "#475569", alignment: "center" },
);
textbox(
  "screenshot-hint",
  "建议粘贴：训练任务看板 / 训练轮次进度 / Runtime 节点状态 / 文档导出页面",
  { left: page.left + 28, top: screenshotTop + 126, width: page.width - 56, height: 30 },
  { fontSize: 16, color: "#64748B", alignment: "center" },
);

textbox(
  "footer",
  "基于 federation-learning.medol 领域模型整理",
  { left: page.left, top: 682, width: page.width, height: 22 },
  { fontSize: 12, color: "#64748B", alignment: "right" },
);

slide.speakerNotes.textFrame.setText([
  "[Sources]",
  "Local MEDOL model: /Users/bryce/codes/medo/event-modeling/medol/examples/fl/federation-learning.medol",
  "Capability grouping derived from modeled contexts, slices, concepts, integrations, read models, and deployment declarations.",
]);

await fs.mkdir(RENDER_DIR, { recursive: true });
await writeBlob(`${RENDER_DIR}/federation-learning-business-capabilities.png`, await deck.export({ slide, format: "png", scale: 1 }));
await writeBlob(`${RENDER_DIR}/federation-learning-business-capabilities.webp`, await deck.export({ format: "webp", montage: true, scale: 1 }));

const pptx = await PresentationFile.exportPptx(deck);
await pptx.save(FINAL_PPTX);
