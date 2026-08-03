import { readFile } from "node:fs/promises";

export function parseEnv(text) {
  const values = {};

  for (const rawLine of String(text).split(/\r?\n/)) {
    let line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("export ")) line = line.slice(7).trimStart();

    const separator = line.indexOf("=");
    if (separator < 1) continue;

    const key = line.slice(0, separator).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;

    let value = line.slice(separator + 1).trim();
    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.endsWith(quote)) {
      value = value.slice(1, -1);
      if (quote === '"') value = value.replace(/\\n/g, "\n").replace(/\\r/g, "\r").replace(/\\t/g, "\t").replace(/\\"/g, '"').replace(/\\\\/g, "\\");
    } else {
      value = value.replace(/\s+#.*$/, "").trimEnd();
    }

    values[key] = value;
  }

  return values;
}

export async function loadEnvFile(path) {
  let text;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }

  for (const [key, value] of Object.entries(parseEnv(text))) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
  return true;
}
