import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { convertN8NToVibexe } from "../../packages/activepieces-adapter/dist/server.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const workflowPath = join(
  __dirname,
  "Generate AI videos with Google Veo3, save to Google Drive and upload to YouTube.json"
);

const n8nJson = JSON.parse(readFileSync(workflowPath, "utf8"));
const result = convertN8NToVibexe(n8nJson);

// Find the Generate title node and dump its full content
const node = result.nodes.find(function(n) {
  return n.name.toLowerCase().includes("generate title");
});

if (node) {
  console.log("Node name: " + node.name);
  console.log("Node type: " + node.type);
  console.log("Content keys: " + Object.keys(node.content || {}).join(", "));
  console.log("Full content:");
  console.log(JSON.stringify(node.content, null, 2));
} else {
  console.log("Node not found. All names:");
  result.nodes.forEach(function(n) {
    console.log("  " + n.name);
  });
}
