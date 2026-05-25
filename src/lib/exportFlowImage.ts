interface ExportFlowImageOptions {
  filename: string;
  width: number;
  height: number;
  transform: string;
  backgroundColor: string;
  pixelRatio?: number;
}

export const exportFlowViewportToSvg = (options: ExportFlowImageOptions): void => {
  const svg = createFlowSvg(options);
  downloadBlob(svg, options.filename, 'image/svg+xml;charset=utf-8');
};

export const exportFlowViewportToPng = async (options: ExportFlowImageOptions): Promise<void> => {
  const { filename, width, height, backgroundColor, pixelRatio = 2 } = options;
  const svg = createFlowSvg(options);
  const image = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
  const scale = Math.max(1, pixelRatio);
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width * scale);
  canvas.height = Math.ceil(height * scale);

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas rendering context was not available.');
  }

  context.fillStyle = backgroundColor;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  const url = canvas.toDataURL('image/png');
  downloadUrl(url, filename);
};

const createFlowSvg = ({
  width,
  height,
  transform,
  backgroundColor
}: ExportFlowImageOptions): string => {
  const viewport = document.querySelector<HTMLElement>('.react-flow__viewport');
  if (!viewport) {
    throw new Error('React Flow viewport was not found.');
  }

  const clone = viewport.cloneNode(true) as HTMLElement;
  clone.style.width = `${width}px`;
  clone.style.height = `${height}px`;
  clone.style.transform = transform;
  clone.style.transformOrigin = '0 0';

  const wrapper = document.createElement('div');
  wrapper.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
  wrapper.style.position = 'relative';
  wrapper.style.width = `${width}px`;
  wrapper.style.height = `${height}px`;
  wrapper.style.overflow = 'hidden';
  wrapper.style.background = backgroundColor;

  const style = document.createElement('style');
  style.textContent = collectStyleText();
  wrapper.append(style, clone);

  const serialized = new XMLSerializer().serializeToString(wrapper);
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <foreignObject width="100%" height="100%">${serialized}</foreignObject>
    </svg>
  `;
};

const downloadUrl = (url: string, filename: string): void => {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
};

const downloadBlob = (content: string, filename: string, type: string): void => {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  downloadUrl(url, filename);
  URL.revokeObjectURL(url);
};

const collectStyleText = (): string => {
  const chunks: string[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      chunks.push(...Array.from(sheet.cssRules).map((rule) => rule.cssText));
    } catch {
      // Ignore stylesheets the browser refuses to expose.
    }
  }
  return chunks.join('\n');
};

const loadImage = (source: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to render React Flow image.'));
    image.src = source;
  });
