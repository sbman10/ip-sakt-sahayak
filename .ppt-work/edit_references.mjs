import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";

const sourcePath = "C:/Users/thaku/Downloads/SIH2026-IDEA-Presentation-Format.pptx";
const outputDir = "C:/Users/thaku/Desktop/26045/ppt-output";
const draftDir = "C:/Users/thaku/Desktop/26045/.ppt-work";
const draftPath = path.join(draftDir, "sih2026-references-draft.pptx");

const presentation = await PresentationFile.importPptx(await FileBlob.load(sourcePath));
const slide = presentation.resolve("sl/x8f69ofe");
// The template's seventh slide contains submission instructions and is explicitly
// marked for deletion. Keep the references slide as the final submission slide.
presentation.resolve("sl/gnmp4jqx").delete();

// Remove the template's one-line body placeholder while preserving the template shell.
const oldBody = presentation.resolve("sh/vq5cve1s");
oldBody.text = "";

const font = "Arial";
const ink = "#17365D";
const linkBlue = "#1F4E79";
const bodySize = 21.3;
const headerSize = 25.3;

function addTextBox(name, position, text, style = {}) {
  const box = slide.shapes.add({
    geometry: "textbox",
    name,
    position,
    fill: "none",
    line: { fill: "none", width: 0 },
  });
  if (Array.isArray(text)) box.text.set(text);
  else box.text = text;
  box.text.style = {
    typeface: font,
    fontSize: style.fontSize ?? bodySize,
    color: style.color ?? ink,
    bold: style.bold ?? false,
    lineSpacing: style.lineSpacing ?? 1.08,
    verticalAlignment: "top",
    autoFit: "shrinkText",
    insets: { top: 0, right: 0, bottom: 0, left: 0 },
  };
  return box;
}

const references = [
  ["The Patents Act, 1970 — India Code", "https://www.indiacode.nic.in/handle/123456789/1392"],
  ["The Patents Rules, 2003 — IP India", "https://www.ipindia.gov.in/pages/patents/rules-patents-2003"],
  ["The Biological Diversity Act, 2002 — India Code", "https://www.indiacode.nic.in/indiacode/handle/123456789/2046?view_type=browse"],
  ["Ayurveda Aahara Regulations, 2022 — FSSAI", "https://fssai.gov.in/upload/notifications/2022/05/62789a20b54bdGazette_Notification_Ayurveda_Aahara_09_05_2022.pdf"],
  ["The Trade Marks Act, 1999 — India Code", "https://www.indiacode.nic.in/handle/123456789/1993?view_type=browse"],
  ["The Geographical Indications Act, 1999 — India Code", "https://www.indiacode.nic.in/handle/123456789/1981?view_type=browse"],
];

const research = [
  ["WHO Global Traditional Medicine Strategy 2025–2034", "https://www.who.int/publications/i/item/9789240113176"],
  ["TRIPS Agreement — Official WTO Text", "https://www.wto.org/english/docs_e/legal_e/27-trips_01_e.htm"],
  ["Convention on Biological Diversity — Official Text", "https://www.cbd.int/doc/legal/cbd-en.pdf"],
  ["Nagoya Protocol on Access and Benefit-Sharing", "https://www.cbd.int/abs/doc/protocol/nagoya-protocol-en.pdf"],
  ["Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks", "https://arxiv.org/abs/2005.11401"],
  ["ChromaDB Documentation — Vector Search Reference", "https://docs.trychroma.com/"],
];

function addLinkList(name, items, left, top, width) {
  const lineHeight = 67;
  items.forEach(([label, uri], index) => {
    const box = addTextBox(`${name} ${index + 1}`, {
      left, top: top + index * lineHeight, width, height: 58,
    }, `› ${label}`);
    box.text.style = {
      typeface: font,
      fontSize: bodySize,
      color: ink,
      bold: false,
      lineSpacing: 1.03,
      verticalAlignment: "top",
      autoFit: "shrinkText",
      insets: { top: 0, right: 4, bottom: 0, left: 0 },
    };
    const linked = box.text.get(label);
    linked.bold = true;
    linked.underline = "sng";
    linked.color = linkBlue;
    linked.link = { uri, isExternal: true };
  });
}

addTextBox("References heading", { left: 62, top: 120, width: 540, height: 32 }, "Primary legal and regulatory sources", {
  fontSize: headerSize, bold: true, color: ink,
});
addTextBox("Research heading", { left: 650, top: 120, width: 560, height: 32 }, "Research and technical foundations", {
  fontSize: headerSize, bold: true, color: ink,
});

addLinkList("Primary source", references, 64, 164, 550);
addLinkList("Research source", research, 652, 164, 560);

slide.speakerNotes.textFrame.setText(
  "Sources used on this slide:\n" +
    [...references, ...research].map(([label, uri]) => `${label}: ${uri}`).join("\n") +
    "\n\nThe source titles on the slide are individually hyperlinked."
);

await fs.mkdir(outputDir, { recursive: true });
await (await PresentationFile.exportPptx(presentation)).save(draftPath);
console.log(JSON.stringify({ draftPath, outputDir, slide: 6, references: references.length, research: research.length }));
