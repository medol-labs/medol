import fs from "node:fs/promises";
import path from "node:path";
import { PresentationFile, FileBlob } from "@oai/artifact-tool";

const workspaceRoot = "/Users/bryce/codes/medo/event-modeling/medol";
const tmpDir = path.join(workspaceRoot, "tmp");
const inputPptx = path.join(tmpDir, "federation-learning-business-capabilities-overview.pptx");
const outputPptx = inputPptx;
const previewPng = path.join(workspaceRoot, ".codex-ppt-build/template-following/federation-business-capabilities-with-screenshots-preview.png");
const inspectOut = path.join(workspaceRoot, ".codex-ppt-build/template-following/federation-business-capabilities-with-screenshots.inspect.ndjson");

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

const imageExtensions = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const entries = await fs.readdir(tmpDir, { withFileTypes: true });
const images = [];
for (const entry of entries) {
  if (!entry.isFile()) continue;
  const fullPath = path.join(tmpDir, entry.name);
  if (!imageExtensions.has(path.extname(entry.name).toLowerCase())) continue;
  const stat = await fs.stat(fullPath);
  images.push({ path: fullPath, name: entry.name, birthtimeMs: stat.birthtimeMs });
}
images.sort((a, b) => a.birthtimeMs - b.birthtimeMs || a.name.localeCompare(b.name));
const selected = images.slice(0, 5);
if (selected.length !== 5) {
  throw new Error(`Expected 5 images in tmp/, found ${selected.length}`);
}

const presentation = await PresentationFile.importPptx(await FileBlob.load(inputPptx));
const snapshot = await presentation.inspect({ kind: "slide,textbox,shape,image", maxChars: 30000 });
const records = snapshot.ndjson
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => JSON.parse(line));

const slide = presentation.resolve(records.find((item) => item.kind === "slide").id);

for (const record of records) {
  if (record.kind === "image" && record.id?.startsWith("im/")) {
    presentation.resolve(record.id).delete();
  }
  if (
    record.id?.startsWith("sh/") &&
    typeof record.name === "string" &&
    (record.name === "screenshot-placeholder" ||
      record.name === "screenshot-hint" ||
      record.name === "screenshot-inner" ||
      record.name.startsWith("screenshot-border-") ||
      record.name.startsWith("screenshot-label-") ||
      record.name === "screenshot-caption")
  ) {
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

const frameRecord = records.find((item) => item.name === "screenshot-frame");
if (frameRecord) {
  const frame = presentation.resolve(frameRecord.id);
  frame.fill = "#ffffff";
  frame.line = { style: "solid", fill: "#ccd6e6", width: 1 };
}

const left = 82;
const top = 466;
const gap = 12;
const width = 216;
const height = 106;
const labelTop = top + height + 10;

for (const [index, image] of selected.entries()) {
  const x = left + index * (width + gap);
  const blob = await fs.readFile(image.path);
  slide.images.add({
    blob,
    contentType: "image/png",
    alt: `系统截图 ${index + 1}: ${image.name}`,
    fit: "cover",
    position: { left: x, top, width, height },
    geometry: "rect",
  });
  addText(
    `screenshot-label-${index + 1}`,
    `${index + 1}`,
    { left: x, top: labelTop, width, height: 24 },
    { fontSize: 13, bold: true, color: "#5f6f86", alignment: "center" },
  );
}

addText(
  "screenshot-caption",
  "系统截图按创建时间从左到右排列",
  { left: 82, top: 616, width: 1128, height: 24 },
  { fontSize: 12, color: "#61708a", alignment: "center" },
);

const preview = await presentation.export({ slide, format: "png", scale: 2 });
await saveBlobToFile(preview, previewPng);
const after = await presentation.inspect({ kind: "slide,textbox,shape,image", maxChars: 30000 });
await fs.writeFile(inspectOut, after.ndjson, "utf8");
const pptx = await PresentationFile.exportPptx(presentation);
await pptx.save(outputPptx);

console.log(JSON.stringify({
  outputPptx,
  previewPng,
  images: selected.map((item) => item.path),
}, null, 2));
