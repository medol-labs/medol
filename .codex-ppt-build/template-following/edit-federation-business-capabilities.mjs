import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";

const workspaceRoot = "/Users/bryce/codes/medo/event-modeling/medol";
const inputPptx = path.join(workspaceRoot, ".codex-ppt-build/template-following/starter-federation-business-capabilities.pptx");
const outputPptx = path.join(workspaceRoot, "tmp/federation-learning-business-capabilities-overview.pptx");
const previewPng = path.join(workspaceRoot, ".codex-ppt-build/template-following/federation-business-capabilities-preview.png");
const inspectOut = path.join(workspaceRoot, ".codex-ppt-build/template-following/federation-business-capabilities.inspect.ndjson");

const presentation = await PresentationFile.importPptx(await FileBlob.load(inputPptx));
const snapshot = await presentation.inspect({
  kind: "slide,textbox,shape",
  maxChars: 30000,
});

const records = snapshot.ndjson
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => JSON.parse(line));

function idByName(name) {
  const record = records.find((item) => item.name === name);
  if (!record) throw new Error(`Missing template element: ${name}`);
  return record.id;
}

function shape(name) {
  return presentation.resolve(idByName(name));
}

function rewrite(name, text, style = {}) {
  const item = shape(name);
  item.text = text;
  if (item.text?.style) item.text.style = style;
  return item;
}

async function saveBlobToFile(blob, filePath) {
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

function soften(name, text) {
  return rewrite(name, text, { fontSize: 14, color: "#5f6f86", bold: false });
}

const slideRecord = records.find((item) => item.kind === "slide");
const slide = presentation.resolve(slideRecord.id);

rewrite("TextBox 6", "1.2.3 联邦学习系统业务能力概述", {
  fontSize: 30,
  bold: true,
  color: "#13213a",
});
rewrite("page-7", "07", { fontSize: 21, bold: true, color: "#2d5bbf" });
rewrite("exec-summary", "围绕多机构协同建模，覆盖组织接入、数据准入、训练编排、模型治理与运行审计，支撑常规聚合与后续个性化联邦扩展。", {
  fontSize: 18,
  color: "#334155",
});

rewrite("exec-top-title", "业务入口", { fontSize: 21, bold: true, color: "#13213a" });
soften("exec-top-sub", "统一 Console / 开放 API / 服务间 Token / 运营看板");
rewrite("exec-external-1", "组织与联盟", { fontSize: 18, bold: true, color: "#13213a" });
rewrite("exec-external-2", "节点接入", { fontSize: 18, bold: true, color: "#13213a" });
rewrite("exec-external-3", "数据准入", { fontSize: 18, bold: true, color: "#13213a" });
rewrite("exec-external-4", "训练任务", { fontSize: 18, bold: true, color: "#13213a" });
rewrite("exec-external-5", "模型资产", { fontSize: 18, bold: true, color: "#13213a" });

rewrite("exec-middle-title", "核心业务能力", { fontSize: 22, bold: true, color: "#13213a" });
rewrite("exec-actor-title", "业务角色", { fontSize: 15, bold: true, color: "#13213a" });
rewrite("exec-actor-admin", "平台管理员", { fontSize: 13, color: "#22314d" });
rewrite("exec-actor-participant", "机构参与方", { fontSize: 13, color: "#22314d" });
rewrite("exec-actor-biz-0", "联盟负责人", { fontSize: 13, color: "#22314d" });
rewrite("exec-actor-biz-1", "数据负责人", { fontSize: 13, color: "#22314d" });
rewrite("exec-actor-biz-2", "训练运营", { fontSize: 13, color: "#22314d" });
rewrite("exec-actor-biz-3", "平台运维", { fontSize: 13, color: "#22314d" });

rewrite("exec-platform-title", "Federation Learning Platform", {
  fontSize: 18,
  bold: true,
  color: "#12306b",
});
rewrite("exec-platform-api", "统一管理联盟、参与方、特征 Schema、训练配置、任务状态与模型版本", {
  fontSize: 15,
  color: "#334155",
});
rewrite("exec-platform-command", "参与方匹配\n按联盟 / Schema / 节点能力筛选", {
  fontSize: 13,
  bold: true,
  color: "#12306b",
});
rewrite("exec-platform-event", "训练编排\n任务计划、轮次推进、状态闭环", {
  fontSize: 13,
  bold: true,
  color: "#12306b",
});
rewrite("exec-platform-automation", "聚合治理\n常规聚合、评估指标、个性化扩展", {
  fontSize: 13,
  bold: true,
  color: "#12306b",
});
rewrite("exec-platform-readmodel", "模型治理：版本登记、指标对比、发布留痕", {
  fontSize: 13,
  color: "#334155",
});
rewrite("exec-platform-cqrs", "运营视图：任务看板、节点状态、审计追踪", {
  fontSize: 13,
  color: "#334155",
});

rewrite("exec-agent-title", "Runtime Agent", { fontSize: 16, bold: true, color: "#12306b" });
rewrite("exec-agent-0", "本地节点注册", { fontSize: 13, color: "#22314d" });
rewrite("exec-agent-1", "训练计划接收", { fontSize: 13, color: "#22314d" });
rewrite("exec-agent-2", "数据集校验", { fontSize: 13, color: "#22314d" });
rewrite("exec-agent-3", "本地训练执行", { fontSize: 13, color: "#22314d" });
rewrite("exec-agent-loop", "指标与结果回传", { fontSize: 13, color: "#22314d" });

rewrite("exec-dep-title", "支撑服务", { fontSize: 14, bold: true, color: "#13213a" });
rewrite("exec-dep-0", "权限", { fontSize: 12, color: "#22314d" });
rewrite("exec-dep-1", "文件", { fontSize: 12, color: "#22314d" });
rewrite("exec-dep-2", "模型", { fontSize: 12, color: "#22314d" });
rewrite("exec-dep-3", "配置", { fontSize: 12, color: "#22314d" });
rewrite("exec-dep-4", "审计", { fontSize: 12, color: "#22314d" });
rewrite("exec-task-label", "计划\n下发", { fontSize: 10, bold: true, color: "#64748b" });
rewrite("exec-feedback-label", "结果\n回传", { fontSize: 10, bold: true, color: "#64748b" });
rewrite("exec-output-label", "业务能力统一输出", { fontSize: 14, bold: true, color: "#12306b" });

const screenshotBand = shape("exec-infra-band");
screenshotBand.position = { left: 57.99, top: 574.03, width: 1163.82, height: 81.99 };
screenshotBand.fill = "#eef4ff";
screenshotBand.line = { style: "solid", fill: "#b8c7e6", width: 1.2 };

rewrite("exec-infra-title", "系统截图区域", { fontSize: 18, bold: true, color: "#13213a" });
rewrite("exec-infra-0", "任务看板", { fontSize: 13, bold: true, color: "#12306b" });
rewrite("exec-infra-1", "轮次进度", { fontSize: 13, bold: true, color: "#12306b" });
rewrite("exec-infra-2", "节点状态", { fontSize: 13, bold: true, color: "#12306b" });
rewrite("exec-infra-3", "数据准入", { fontSize: 13, bold: true, color: "#12306b" });
rewrite("exec-infra-4", "模型发布", { fontSize: 13, bold: true, color: "#12306b" });
rewrite("exec-infra-6", "审计追踪", { fontSize: 13, bold: true, color: "#12306b" });
shape("exec-infra-7").delete();
shape("exec-infra-8").delete();

const screenshotFrame = slide.shapes.add({
  geometry: "rect",
  name: "user-screenshot-placeholder",
  position: { left: 275, top: 586, width: 850, height: 52 },
  fill: "#ffffff",
  line: { style: "dash", fill: "#7a98cf", width: 1.5 },
});
screenshotFrame.text = "预留：粘贴系统运行截图 / Federation Learning 系统图";
screenshotFrame.text.style = { fontSize: 16, bold: false, color: "#64748b" };

await fs.mkdir(path.dirname(outputPptx), { recursive: true });
await fs.mkdir(path.dirname(previewPng), { recursive: true });

const preview = await presentation.export({ slide, format: "png", scale: 2 });
await saveBlobToFile(preview, previewPng);
const after = await presentation.inspect({ kind: "slide,textbox,shape", maxChars: 30000 });
await fs.writeFile(inspectOut, after.ndjson, "utf8");

const pptx = await PresentationFile.exportPptx(presentation);
await pptx.save(outputPptx);

console.log(JSON.stringify({ outputPptx, previewPng, inspectOut }, null, 2));
