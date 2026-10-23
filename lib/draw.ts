export type Slot = {
  id: string;
  img: HTMLImageElement | null;
  name?: string;
  zoom: number; // 1 = a imagem cobre o círculo inteiro
  ox: number; // deslocamento horizontal (fração do diâmetro)
  oy: number; // deslocamento vertical (fração do diâmetro)
  rot: number; // 0, 90, 180, 270
};

/** Desenha a imagem recortada em círculo num canvas quadrado de `size` px. */
export function drawCircle(ctx: CanvasRenderingContext2D, slot: Slot, size: number) {
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);

  const img = slot.img;
  if (img && img.naturalWidth) {
    const rotated = slot.rot % 180 !== 0;
    const iw = rotated ? img.naturalHeight : img.naturalWidth;
    const ih = rotated ? img.naturalWidth : img.naturalHeight;
    const scale = Math.max(size / iw, size / ih) * slot.zoom;
    ctx.translate(size / 2 + slot.ox * size, size / 2 + slot.oy * size);
    ctx.rotate((slot.rot * Math.PI) / 180);
    const w = img.naturalWidth * scale;
    const h = img.naturalHeight * scale;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
  }
  ctx.restore();
}

export function loadImage(file: File): Promise<HTMLImageElement> {
  return loadImageUrl(URL.createObjectURL(file), file.name);
}

/** Carrega uma imagem a partir de uma URL (blob:, data: ou http). */
export function loadImageUrl(url: string, name: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Couldn't open "${name}". Try JPG, PNG or WEBP.`));
    img.src = url;
  });
}
