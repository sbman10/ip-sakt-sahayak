import { FileBlob, PresentationFile } from "@oai/artifact-tool";
const source = "C:/Users/thaku/Downloads/SIH2026-IDEA-Presentation-Format.pptx";
const presentation = await PresentationFile.importPptx(await FileBlob.load(source));
const snapshot = await presentation.inspect({
  kind: "slide,textbox,shape,image,table,chart,notes,layout",
  maxChars: 50000,
});
console.log(snapshot.ndjson);
