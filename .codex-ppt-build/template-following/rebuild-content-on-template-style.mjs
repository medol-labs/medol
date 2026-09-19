import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";

const workspaceRoot = "/Users/bryce/codes/medo/event-modeling/medol";
const templatePptx = path.join(workspaceRoot, "tmp/课题4中期汇报修改20260831-业务能力版.pptx");
const outputPptx = path.join(workspaceRoot, "tmp/federation-learning-business-capabilities-overview.pptx");
const previewPng = path.join(workspaceRoot, ".codex-ppt-build/template-following/federation-business-capabilities-template-style-preview.png");
const inspectOut = path.join(workspaceRoot, ".codex-ppt-build/template-following/federation-business-capabilities-template-style.inspect.ndjson");

async function saveBlobToFile(blob, filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  if (blob && typeof blob.arrayBuffer === "function") {
    await fs.writeFile(filePath, Buffer.from(await blob.arrayBuffer()));
    return;
  }
  if (blob instanceof Uint8Array || Buffer.isBuffer(blob)) {
    await fs.writeFile(filePath, Buffer.from(blob));
    return;
  }
  if (blob && typeof blob.save === "function") {
    await blob.save(filePath);
    return;
  }
  throw new Error(`Cannot save exported artifact: ${filePath}`);
}

const presentation = await PresentationFile.importPptx(await FileBlob.load(templatePptx));
const snapshot = await presentation.inspect({ kind: "slide,textbox,shape", maxChars: 30000 });
const records = snapshot.ndjson
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => JSON.parse(line));

const slide = presentation.resolve(records.find((item) => item.kind === "slide").id);

for (const record of records) {
  if ((record.kind === "shape" || record.kind === "textbox") && record.id?.startsWith("sh/")) {
    presentation.resolve(record.id).delete();
  }
}

function addText(name, text, position, style = {}) {
  const shape = slide.shapes.add({
    geometry: "textbox",
    name,
    position,
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  shape.text = text;
  shape.text.style = style;
  return shape;
}

function addRect(name, position, fill, line = { style: "solid", fill: "#dbe3f0", width: 1 }) {
  return slide.shapes.add({
    geometry: "rect",
    name,
    position,
    fill,
    line,
  });
}

const navy = "#13213a";
const muted = "#48566d";
const blue = "#2f66f2";
const teal = "#117c73";
const orange = "#c45a00";
const purple = "#6d32d9";

addText("page-7", "07", { left: 1179.82, top: 44.12, width: 51.99, height: 28 }, {
  fontSize: 21,
  color: "#64748b",
});
addText("eyebrow", "FEDERATION LEARNING PLATFORM", { left: 58, top: 42, width: 380, height: 28 }, {
  fontSize: 13,
  bold: true,
  color: "#5a6b86",
});
addText("title", "联邦学习平台业务能力概述", { left: 58, top: 80, width: 760, height: 58 }, {
  fontSize: 34,
  bold: true,
  color: navy,
});
addText(
  "subtitle",
  "围绕多机构协作训练，将成员治理、数据准入、运行时接入、训练编排、安全聚合、模型发布和审计运维串成可追踪闭环。",
  { left: 58, top: 144, width: 970, height: 52 },
  { fontSize: 17, color: "#25344f" },
);
addRect("top-rule", { left: 58, top: 190, width: 1164, height: 2 }, "#d3dbe8", {
  style: "solid",
  fill: "#d3dbe8",
  width: 0,
});

const columns = [
  {
    x: 58,
    color: blue,
    title: "协作治理",
    items: ["组织注册与启停", "联邦创建、邀请与成员状态", "用户与机构绑定"],
  },
  {
    x: 356,
    color: teal,
    title: "数据与运行时",
    items: ["特征 Schema 版本治理", "Runtime 安装、验证与连接", "数据集声明、画像与准入"],
  },
  {
    x: 654,
    color: orange,
    title: "训练与聚合",
    items: ["训练配置、任务提交与轮次调度", "参与方选择与本地执行计划", "安全聚合、更新评估与全局模型"],
  },
  {
    x: 952,
    color: purple,
    title: "模型与运维",
    items: ["模型仓库与候选模型登记", "评估包、审批、发布与回滚", "监控告警、审计追踪与文档导出"],
  },
];

for (const [index, col] of columns.entries()) {
  addRect(`cap-accent-${index + 1}`, { left: col.x, top: 214, width: 44, height: 5 }, col.color, {
    style: "solid",
    fill: col.color,
    width: 0,
  });
  addText(`cap-title-${index + 1}`, col.title, { left: col.x, top: 230, width: 270, height: 34 }, {
    fontSize: 23,
    bold: true,
    color: navy,
  });
  for (const [itemIndex, item] of col.items.entries()) {
    addRect(
      `cap-dot-${index + 1}-${itemIndex + 1}`,
      { left: col.x, top: 285 + itemIndex * 39, width: 8, height: 8 },
      col.color,
      { style: "solid", fill: col.color, width: 0 },
    );
    addText(
      `cap-item-${index + 1}-${itemIndex + 1}`,
      item,
      { left: col.x + 18, top: 276 + itemIndex * 39, width: 252, height: 30 },
      { fontSize: 15.5, color: "#2f3c53" },
    );
  }
  if (index < columns.length - 1) {
    addRect(`separator-${index + 1}`, { left: col.x + 284, top: 218, width: 1.2, height: 180 }, "#d9e1ec", {
      style: "solid",
      fill: "#d9e1ec",
      width: 0,
    });
  }
}

addRect("screenshot-frame", { left: 58, top: 438, width: 1164, height: 224 }, "#ffffff", {
  style: "solid",
  fill: "#ccd6e6",
  width: 1,
});
addRect("screenshot-inner", { left: 76, top: 456, width: 1128, height: 188 }, "#eef3f9", {
  style: "solid",
  fill: "#dce5ef",
  width: 1,
});
addText("screenshot-placeholder", "系统截图占位区", { left: 86, top: 526, width: 1108, height: 34 }, {
  fontSize: 24,
  bold: true,
  color: "#3e4d66",
  alignment: "center",
});
addText(
  "screenshot-hint",
  "建议粘贴：训练任务看板 / 训练轮次进度 / Runtime 节点状态 / 文档导出页面",
  { left: 86, top: 564, width: 1108, height: 30 },
  { fontSize: 14,
    color: "#61708a",
    alignment: "center" },
);
addText("footer", "基于 federation-learning.medol 领域模型整理", { left: 58, top: 682, width: 1164, height: 22 }, {
  fontSize: 11,
  color: "#5f6f86",
  alignment: "right",
});

const preview = await presentation.export({ slide, format: "png", scale: 2 });
await saveBlobToFile(preview, previewPng);
const after = await presentation.inspect({ kind: "slide,textbox,shape", maxChars: 30000 });
await fs.writeFile(inspectOut, after.ndjson, "utf8");

const pptx = await PresentationFile.exportPptx(presentation);
await pptx.save(outputPptx);

console.log(JSON.stringify({ outputPptx, previewPng, inspectOut }, null, 2));
