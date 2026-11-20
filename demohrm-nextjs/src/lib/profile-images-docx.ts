import JSZip from "jszip";

export interface ProfileImageDocument {
  workerCode: string;
  workerName: string;
  dataUrl: string;
}

function xml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&apos;");
}

function imageParts(dataUrl: string): { ext: "png" | "jpg"; bytes: Uint8Array } | null {
  const match = /^data:image\/(png|jpeg);base64,([\s\S]+)$/.exec(dataUrl);
  if (!match?.[1] || !match[2]) return null;
  const binary = atob(match[2]);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return { ext: match[1] === "png" ? "png" : "jpg", bytes };
}

async function fittedExtent(dataUrl: string): Promise<{ cx: number; cy: number }> {
  const size = await new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error("Không đọc được ảnh hồ sơ."));
    image.src = dataUrl;
  });
  const maxWidth = 6858000; // 7.5 in
  const maxHeight = 9144000; // 10 in
  const scale = Math.min(maxWidth / size.width, maxHeight / size.height);
  return { cx: Math.round(size.width * scale), cy: Math.round(size.height * scale) };
}

/** Mỗi ảnh được đặt riêng một trang, giữ nguyên tỷ lệ và byte ảnh trong DOCX. */
export async function buildProfileImagesDocx(images: ProfileImageDocument[]): Promise<Blob> {
  if (!images.length) throw new Error("Không tìm thấy ảnh hồ sơ trên thiết bị này.");
  const zip = new JSZip();
  const valid = images.map((image) => ({ ...image, part: imageParts(image.dataUrl) })).filter((image) => image.part);
  if (!valid.length) throw new Error("Không có ảnh PNG hoặc JPEG để xuất.");

  const defaults = [...new Set(valid.map((image) => image.part!.ext))]
    .map((ext) => `<Default Extension="${ext}" ContentType="image/${ext === "jpg" ? "jpeg" : ext}"/>`).join("");
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${defaults}<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);

  const relationships: string[] = [];
  const paragraphs: string[] = [];
  for (const [index, image] of valid.entries()) {
    const id = index + 1;
    const rid = `rId${id}`;
    const filename = `image${id}.${image.part!.ext}`;
    const name = xml(`${image.workerCode} - ${image.workerName}`);
    const extent = await fittedExtent(image.dataUrl);
    relationships.push(`<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${filename}"/>`);
    zip.file(`word/media/${filename}`, image.part!.bytes);
    if (index > 0) paragraphs.push(`<w:p><w:r><w:br w:type="page"/></w:r></w:p>`);
    paragraphs.push(`<w:p><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${extent.cx}" cy="${extent.cy}"/><wp:docPr id="${id}" name="${name}"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${extent.cx}" cy="${extent.cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`);
  }
  zip.file("word/_rels/document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships.join("")}</Relationships>`);
  zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${paragraphs.join("")}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="360" w:right="360" w:bottom="360" w:left="360" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr></w:body></w:document>`);
  return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", compression: "STORE" });
}
