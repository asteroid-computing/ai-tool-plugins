#!/usr/bin/env node

import fs from "node:fs";
import https from "node:https";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const DEFAULT_FROM = "1.22";
const GO_DOC_BASE = "https://go.dev/doc";

main().catch((error) => {
  console.error(`go_release_notes: ${error.message}`);
  process.exit(1);
});

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const projectDir = path.resolve(options.project ?? process.cwd());
  const goModPath = options.goMod
    ? path.resolve(options.goMod)
    : findUp(projectDir, "go.mod");
  const goWorkPath =
    !goModPath && options.goWork
      ? path.resolve(options.goWork)
      : !goModPath
        ? findUp(projectDir, "go.work")
        : null;
  const projectFilePath = goModPath ?? goWorkPath;
  const projectFileKind = goModPath ? "go.mod" : goWorkPath ? "go.work" : null;
  const detected = projectFilePath ? parseGoProjectFile(projectFilePath) : null;
  const detectedTarget = detected ? maxVersion(detected.go, detected.toolchain) : null;
  const target = normalizeGoVersion(options.to ?? detectedTarget);

  if (!target) {
    throw new Error(
      "no target Go version found; pass --to=1.N or run from a directory with go.mod",
    );
  }

  const from = normalizeGoVersion(options.from ?? DEFAULT_FROM);
  if (!from) {
    throw new Error(`invalid --from version: ${options.from}`);
  }
  if (compareVersion(from, target) >= 0) {
    const summary = {
      project_dir: projectDir,
      project_file: projectFilePath,
      project_file_kind: projectFileKind,
      from,
      target,
      cache_dir: resolveCacheDir(options.cacheDir),
      notes: [],
      message: `No release notes needed: baseline ${from} is not older than target ${target}.`,
    };
    printSummary(summary, options.json);
    return;
  }

  const cacheDir = resolveCacheDir(options.cacheDir);
  fs.mkdirSync(cacheDir, { recursive: true });

  const notes = [];
  for (const version of minorRangeAfter(from, target)) {
    notes.push(await ensureReleaseNote(version, cacheDir, options.refresh));
  }

  printSummary(
    {
      project_dir: projectDir,
      project_file: projectFilePath,
      project_file_kind: projectFileKind,
      detected,
      from,
      target,
      cache_dir: cacheDir,
      notes,
    },
    options.json,
  );
}

function parseArgs(args) {
  const options = {
    project: undefined,
    goMod: undefined,
    goWork: undefined,
    from: undefined,
    to: undefined,
    cacheDir: undefined,
    refresh: false,
    json: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const [flag, inlineValue] = arg.split("=", 2);
    const readValue = () => {
      if (inlineValue !== undefined) {
        return inlineValue;
      }
      index += 1;
      if (index >= args.length) {
        throw new Error(`missing value for ${flag}`);
      }
      return args[index];
    };

    switch (flag) {
      case "--project":
        options.project = readValue();
        break;
      case "--go-mod":
        options.goMod = readValue();
        break;
      case "--go-work":
        options.goWork = readValue();
        break;
      case "--from":
        options.from = readValue();
        break;
      case "--to":
        options.to = readValue();
        break;
      case "--cache-dir":
        options.cacheDir = readValue();
        break;
      case "--refresh":
        options.refresh = true;
        break;
      case "--json":
        options.json = true;
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
        break;
      default:
        throw new Error(`unknown argument: ${arg}`);
    }
  }

  return options;
}

function printHelp() {
  console.log(`Usage: node go_release_notes.mjs [flags]

Fetch and cache official Go release notes needed for a project.

Flags:
  --project <dir>      Start directory for finding go.mod (default: cwd)
  --go-mod <path>      Parse a specific go.mod
  --go-work <path>     Parse a specific go.work when no go.mod is selected
  --from=1.N           Last Go minor version assumed known; exclusive
  --to=1.N             Target Go minor version; overrides go.mod
  --cache-dir <dir>    Override host plugin data directory detection
  --refresh            Re-fetch notes even if cached
  --json               Print JSON summary
`);
}

function findUp(startDir, fileName) {
  let current = path.resolve(startDir);
  while (true) {
    const candidate = path.join(current, fileName);
    if (fs.existsSync(candidate)) {
      return candidate;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

function parseGoProjectFile(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  let go = null;
  let toolchain = null;

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("//")) {
      continue;
    }
    const goMatch = trimmed.match(/^go\s+([0-9]+(?:\.[0-9]+){1,2})\b/);
    if (goMatch) {
      go = normalizeGoVersion(goMatch[1]);
      continue;
    }
    const toolchainMatch = trimmed.match(/^toolchain\s+go([0-9]+(?:\.[0-9]+){1,2})\b/);
    if (toolchainMatch) {
      toolchain = normalizeGoVersion(toolchainMatch[1]);
    }
  }

  return { go, toolchain };
}

function normalizeGoVersion(value) {
  if (!value) {
    return null;
  }
  const match = String(value)
    .trim()
    .match(/^(?:go)?([0-9]+)\.([0-9]+)(?:\.[0-9]+)?$/);
  if (!match) {
    return null;
  }
  return `${Number(match[1])}.${Number(match[2])}`;
}

function maxVersion(a, b) {
  if (!a) {
    return b ?? null;
  }
  if (!b) {
    return a;
  }
  return compareVersion(a, b) >= 0 ? a : b;
}

function compareVersion(a, b) {
  const [majorA, minorA] = a.split(".").map(Number);
  const [majorB, minorB] = b.split(".").map(Number);
  if (majorA !== majorB) {
    return majorA - majorB;
  }
  return minorA - minorB;
}

function minorRangeAfter(from, target) {
  const result = [];
  const [targetMajor, targetMinor] = target.split(".").map(Number);
  let [major, minor] = from.split(".").map(Number);
  minor += 1;

  while (major < targetMajor || (major === targetMajor && minor <= targetMinor)) {
    result.push(`${major}.${minor}`);
    minor += 1;
  }

  return result;
}

function resolveCacheDir(override) {
  if (override) {
    return path.resolve(override);
  }

  const envDir =
    process.env.CLAUDE_PLUGIN_DATA ||
    process.env.CODEX_PLUGIN_DATA ||
    process.env.GO_TOOLS_PLUGIN_DATA ||
    process.env.ASTEROID_GO_TOOLS_PLUGIN_DATA;
  if (envDir) {
    return path.join(path.resolve(envDir), "go-release-notes");
  }

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const pluginRoot = path.resolve(scriptDir, "../../..");
  return path.join(pluginRoot, ".data", "go-release-notes");
}

async function ensureReleaseNote(version, cacheDir, refresh) {
  const slug = `go${version}`;
  const url = `${GO_DOC_BASE}/${slug}`;
  const htmlPath = path.join(cacheDir, `${slug}.html`);
  const textPath = path.join(cacheDir, `${slug}.txt`);
  let fromCache = true;

  if (refresh || !fs.existsSync(htmlPath) || !fs.existsSync(textPath)) {
    fromCache = false;
    const html = await fetchText(url);
    fs.writeFileSync(htmlPath, html);
    fs.writeFileSync(textPath, extractText(html, slug));
  }

  return {
    version,
    url,
    html_path: htmlPath,
    text_path: textPath,
    cached: fromCache,
  };
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: {
            "user-agent": "asteroid-go-release-notes-skill",
          },
        },
        (response) => {
          if (
            response.statusCode >= 300 &&
            response.statusCode < 400 &&
            response.headers.location
          ) {
            response.resume();
            fetchText(new URL(response.headers.location, url).toString())
              .then(resolve)
              .catch(reject);
            return;
          }
          if (response.statusCode !== 200) {
            response.resume();
            reject(new Error(`GET ${url} returned HTTP ${response.statusCode}`));
            return;
          }
          response.setEncoding("utf8");
          let body = "";
          response.on("data", (chunk) => {
            body += chunk;
          });
          response.on("end", () => resolve(body));
        },
      )
      .on("error", reject);
  });
}

function extractText(html, slug) {
  const title = `# Go ${slug.slice(2)} Release Notes`;
  const main = extractBetween(html, /<main\b[^>]*>/i, /<\/main>/i) ?? html;
  const withBreaks = main
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, "")
    .replace(/<(h[1-6])\b[^>]*>/gi, "\n\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "\n- ")
    .replace(/<\/(p|div|section|article|ul|ol|pre|blockquote|table|tr)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  const text = decodeEntities(withBreaks)
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t]+/g, " ").trimEnd())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return `${title}\n\nSource: ${GO_DOC_BASE}/${slug}\n\n${text}\n`;
}

function extractBetween(text, startRe, endRe) {
  const start = startRe.exec(text);
  if (!start) {
    return null;
  }
  const bodyStart = start.index + start[0].length;
  const rest = text.slice(bodyStart);
  const end = endRe.exec(rest);
  if (!end) {
    return null;
  }
  return rest.slice(0, end.index);
}

function decodeEntities(text) {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&lsquo;/g, "'")
    .replace(/&rdquo;/g, '"')
    .replace(/&ldquo;/g, '"')
    .replace(/&ndash;/g, "-")
    .replace(/&mdash;/g, "-")
    .replace(/&hellip;/g, "...")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, decimal) => String.fromCodePoint(parseInt(decimal, 10)));
}

function printSummary(summary, json) {
  if (json) {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  console.log("Go release notes cache");
  console.log(`Project: ${summary.project_dir}`);
  if (summary.project_file) {
    console.log(`${summary.project_file_kind}: ${summary.project_file}`);
  }
  if (summary.detected) {
    console.log(`Detected go directive: ${summary.detected.go ?? "(none)"}`);
    console.log(`Detected toolchain directive: ${summary.detected.toolchain ?? "(none)"}`);
  }
  console.log(`Baseline (exclusive): ${summary.from}`);
  console.log(`Target: ${summary.target}`);
  console.log(`Cache: ${summary.cache_dir}`);
  if (summary.message) {
    console.log(summary.message);
    return;
  }
  console.log("");
  console.log("Read these files into context before continuing:");
  for (const note of summary.notes) {
    const source = note.cached ? "cached" : "fetched";
    console.log(`- Go ${note.version} (${source}): ${note.text_path}`);
    console.log(`  Source: ${note.url}`);
  }
}
