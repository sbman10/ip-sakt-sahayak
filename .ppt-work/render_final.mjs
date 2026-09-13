import fs from "node:fs/promises";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";
const p = await PresentationFile.importPptx(await FileBlob.load("C:/Users/thaku/Desktop/26045/ppt-output/SIH2026-IDEA-Presentation-Format-references.pptx"));
const slide = p.resolve("sl/x8f69ofe");
const png = await slide.export({ format: "png", scale: 2 });
await fs.writeFile("C:/Users/thaku/Desktop/26045/.ppt-work/slide-6-final.png", new Uint8Array(await png.arrayBuffer()));
console.log((await p.inspect({ kind: "slide,textbox,notes", target: { id: "sl/x8f69ofe", beforeLines: 0, afterLines: 40 }, maxChars: 22000 })).ndjson);
