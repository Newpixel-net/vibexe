import { flag } from "flags/next";

// Self-hosted version: All flags use environment variables instead of Vercel Edge Config

function parseLocalFlag(envKey: string): boolean {
if (process.env[envKey] === undefined) {
return false;
}
if (process.env[envKey] === "false") {
return false;
}
return true;
}

export const developerFlag = flag<boolean>({
key: "developer",
decide() {
return parseLocalFlag("DEVELOPER_FLAG");
},
description: "Enable Developer features",
defaultValue: false,
options: [
{ value: false, label: "Disabled" },
{ value: true, label: "Enabled" },
],
});

export const webSearchAssistantFlag = flag<boolean>({
key: "web-search-assistant",
decide() {
return parseLocalFlag("WEB_SEARCH_ASSISTANT_FLAG");
},
description: "Enable Web Search Assistant",
defaultValue: false,
options: [
{ value: false, label: "Disabled" },
{ value: true, label: "Enabled" },
],
});

export const dataStoreFlag = flag<boolean>({
key: "data-store",
decide() {
return parseLocalFlag("DATA_STORE_FLAG");
},
description: "Enable Data Store and Data Query nodes",
defaultValue: false,
options: [
{ value: false, label: "Disabled" },
{ value: true, label: "Enabled" },
],
});
