import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";

const SKILL_DIR = "C:/Users/thaku/.codex/plugins/cache/openai-primary-runtime/presentations/26.909.12148/skills/presentations";
const workspaceDir = "C:/Users/thaku/Desktop/26045";
const stagingDir = path.join(workspaceDir, ".codex-finalizer");
const candidatePath = path.join(workspaceDir, ".ppt-work", "sih2026-references-draft.pptx");
const finalPath = path.join(workspaceDir, "ppt-output", "SIH2026-IDEA-Presentation-Format-references.pptx");
await fs.mkdir(stagingDir, { recursive: true });
await fs.mkdir(path.dirname(finalPath), { recursive: true });
const presentation = await PresentationFile.importPptx(await FileBlob.load(candidatePath));
const { finalizePresentation } = await import(pathToFileURL(path.join(SKILL_DIR, "container_tools/artifact_tool_utils.mjs")).href);

function pathToFileURL(value) {
  return new URL(`file:///${value.replaceAll("\\", "/")}`);
}

const result = await finalizePresentation({
  workspaceDir,
  candidatePath,
  finalPath,
  pythonExecutable: "C:/Users/thaku/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe",
  integrityValidatorPath: path.join(SKILL_DIR, "container_tools/inspect_presentation_package_integrity.py"),
  layoutValidatorPath: path.join(SKILL_DIR, "container_tools/inspect_presentation_layout_geometry.py"),
  layoutArgs: ["--expected-slide-size-emu", "12192000,6858000", "--validate-bullet-geometry", "--validate-heading-fit"],
  explicitTotalSlideCount: 6,
  requiredNativeTableOwnerSlides: [],
  requiredNativeChartOwnerSlides: [],
  fontPolicy: {
    basis: "reference",
    families: ["Arial", "Calibri", "Garamond", "Times New Roman", "TradeGothic"],
    referencePath: "C:/Users/thaku/Downloads/SIH2026-IDEA-Presentation-Format.pptx",
    referenceSha256: "ce3e5deebec2741f3383cb2dd21269cad8d9930f7c747c9903d7d4b27db14de6",
  },
  verifyArtifactToolImport: true,
  receiptPath: path.join(stagingDir, "SIH2026-references.validation.json"),
});
console.log(JSON.stringify(result, null, 2));
