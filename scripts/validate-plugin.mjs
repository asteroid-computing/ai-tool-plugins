#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const SEMVER_RE =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const HEX_COLOR_RE = /^#[0-9A-F]{6}$/i;
const HTTPS_RE = /^https:\/\/[^/\s]+/;
const TODO_MARKER = "[TODO:";

const MANIFEST_KEYS = new Set([
  "id",
  "name",
  "version",
  "description",
  "skills",
  "apps",
  "mcpServers",
  "interface",
  "author",
  "homepage",
  "repository",
  "license",
  "keywords",
]);
const INTERFACE_KEYS = new Set([
  "displayName",
  "shortDescription",
  "longDescription",
  "developerName",
  "category",
  "capabilities",
  "websiteURL",
  "privacyPolicyURL",
  "termsOfServiceURL",
  "brandColor",
  "composerIcon",
  "logo",
  "logoDark",
  "screenshots",
  "defaultPrompt",
  "default_prompt",
]);
const INSTALLATION_POLICIES = new Set([
  "NOT_AVAILABLE",
  "AVAILABLE",
  "INSTALLED_BY_DEFAULT",
]);
const AUTHENTICATION_POLICIES = new Set(["ON_INSTALL", "ON_USE"]);

function main() {
  const args = process.argv.slice(2);
  const repoRoot = process.cwd();
  const strictCodex = args.includes("--strict-codex");
  const pluginArgs = args.filter((arg) => !arg.startsWith("-"));
  const pluginRoots =
    pluginArgs.length > 0
      ? pluginArgs.map((arg) => path.resolve(repoRoot, arg))
      : discoverPluginRoots(repoRoot);

  const errors = [];
  const warnings = [];
  validateMarketplace(repoRoot, errors);
  for (const pluginRoot of pluginRoots) {
    validatePlugin(pluginRoot, { errors, warnings, strictCodex });
  }

  if (errors.length > 0) {
    console.error("Plugin validation failed:");
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  if (warnings.length > 0) {
    console.error("Plugin validation warnings:");
    for (const warning of warnings) {
      console.error(`- ${warning}`);
    }
  }

  const labels = pluginRoots.map((root) => path.relative(repoRoot, root)).join(", ");
  console.log(`Plugin validation passed: ${labels}`);
}

function discoverPluginRoots(repoRoot) {
  const pluginsDir = path.join(repoRoot, "plugins");
  if (!isDirectory(pluginsDir)) {
    return [];
  }
  return fs
    .readdirSync(pluginsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => path.join(pluginsDir, entry.name));
}

function validateMarketplace(repoRoot, errors) {
  const marketplacePath = path.join(repoRoot, ".agents", "plugins", "marketplace.json");
  if (!fs.existsSync(marketplacePath)) {
    return;
  }
  const marketplace = readJsonObject(marketplacePath, "marketplace.json", errors);
  if (!marketplace) {
    return;
  }
  requireString(marketplace, "name", "marketplace.name", errors);
  if (marketplace.interface !== undefined) {
    requireObject(marketplace, "interface", "marketplace.interface", errors);
    if (isObject(marketplace.interface)) {
      optionalString(
        marketplace.interface,
        "displayName",
        "marketplace.interface.displayName",
        errors,
      );
    }
  }
  if (!Array.isArray(marketplace.plugins)) {
    errors.push("marketplace.plugins must be an array");
    return;
  }
  const seen = new Set();
  for (const [index, entry] of marketplace.plugins.entries()) {
    const label = `marketplace.plugins[${index}]`;
    if (!isObject(entry)) {
      errors.push(`${label} must be an object`);
      continue;
    }
    const name = requireString(entry, "name", `${label}.name`, errors);
    if (name) {
      if (seen.has(name)) {
        errors.push(`${label}.name duplicates marketplace entry ${name}`);
      }
      seen.add(name);
    }
    if (!isObject(entry.source)) {
      errors.push(`${label}.source must be an object`);
    } else {
      if (entry.source.source !== "local") {
        errors.push(`${label}.source.source must be "local"`);
      }
      const sourcePath = requireString(entry.source, "path", `${label}.source.path`, errors);
      if (name && sourcePath !== `./plugins/${name}`) {
        errors.push(`${label}.source.path must be ./plugins/${name}`);
      }
      if (sourcePath) {
        const resolved = path.resolve(repoRoot, sourcePath);
        if (!isDirectory(resolved)) {
          errors.push(`${label}.source.path does not point to a plugin directory`);
        }
      }
    }
    if (!isObject(entry.policy)) {
      errors.push(`${label}.policy must be an object`);
    } else {
      if (!INSTALLATION_POLICIES.has(entry.policy.installation)) {
        errors.push(`${label}.policy.installation has an unsupported value`);
      }
      if (!AUTHENTICATION_POLICIES.has(entry.policy.authentication)) {
        errors.push(`${label}.policy.authentication has an unsupported value`);
      }
      if (
        entry.policy.products !== undefined &&
        (!Array.isArray(entry.policy.products) ||
          !entry.policy.products.every((value) => isNonEmptyString(value)))
      ) {
        errors.push(`${label}.policy.products must be an array of strings when present`);
      }
    }
    requireString(entry, "category", `${label}.category`, errors);
  }
}

function validatePlugin(pluginRoot, context) {
  const { errors } = context;
  const manifestPath = path.join(pluginRoot, ".codex-plugin", "plugin.json");
  const pluginLabel = path.relative(process.cwd(), pluginRoot);
  if (!fs.existsSync(manifestPath)) {
    errors.push(`${pluginLabel}: missing .codex-plugin/plugin.json`);
    return;
  }

  const manifest = readJsonObject(manifestPath, `${pluginLabel}/.codex-plugin/plugin.json`, errors);
  if (!manifest) {
    return;
  }
  rejectTodos(manifest, `${pluginLabel}/.codex-plugin/plugin.json`, errors);
  rejectUnknownKeys(manifest, MANIFEST_KEYS, `${pluginLabel}: plugin.json`, errors);

  const name = requireString(manifest, "name", `${pluginLabel}: name`, errors);
  if (name && path.basename(pluginRoot) !== name) {
    errors.push(`${pluginLabel}: plugin name must match plugin directory`);
  }
  const version = requireString(manifest, "version", `${pluginLabel}: version`, errors);
  if (version && !SEMVER_RE.test(version)) {
    errors.push(`${pluginLabel}: version must be strict semver`);
  }
  requireString(manifest, "description", `${pluginLabel}: description`, errors);

  const author = requireObject(manifest, "author", `${pluginLabel}: author`, errors);
  if (author) {
    requireString(author, "name", `${pluginLabel}: author.name`, errors);
    optionalString(author, "email", `${pluginLabel}: author.email`, errors);
    optionalHttps(author, "url", `${pluginLabel}: author.url`, errors);
  }

  validateContractPath(manifest, "skills", "skills", `${pluginLabel}: skills`, errors);
  validateContractPath(manifest, "apps", ".app.json", `${pluginLabel}: apps`, errors);
  validateMcpServers(pluginRoot, manifest, pluginLabel, errors);
  validateInterface(pluginRoot, manifest.interface, pluginLabel, errors);
  validateSkills(pluginRoot, context);
}

function validateMcpServers(pluginRoot, manifest, pluginLabel, errors) {
  const value = manifest.mcpServers;
  if (value === undefined) {
    return;
  }
  if (typeof value === "string") {
    validateContractPath(manifest, "mcpServers", ".mcp.json", `${pluginLabel}: mcpServers`, errors);
    validateMcpManifest(path.join(pluginRoot, ".mcp.json"), `${pluginLabel}: .mcp.json`, errors);
    return;
  }
  if (isObject(value)) {
    validateMcpServerEntries(value, `${pluginLabel}: mcpServers`, errors);
    return;
  }
  errors.push(`${pluginLabel}: mcpServers must be a path string or object`);
}

function validateMcpManifest(filePath, label, errors) {
  const mcp = readJsonObject(filePath, label, errors);
  if (!mcp) {
    return;
  }
  rejectUnknownKeys(mcp, new Set(["mcpServers"]), label, errors);
  validateMcpServerEntries(mcp.mcpServers, `${label}.mcpServers`, errors);
}

function validateMcpServerEntries(value, label, errors) {
  if (!isObject(value)) {
    errors.push(`${label} must be an object`);
    return;
  }
  for (const [name, server] of Object.entries(value)) {
    if (!isNonEmptyString(name)) {
      errors.push(`${label} server names must be non-empty strings`);
    }
    if (!isObject(server)) {
      errors.push(`${label}.${name} must be an object`);
      continue;
    }
    validateMcpServer(server, `${label}.${name}`, errors);
  }
}

function validateMcpServer(server, label, errors) {
  const hasCommand = server.command !== undefined;
  const hasUrl = server.url !== undefined;
  if (!hasCommand && !hasUrl) {
    errors.push(`${label} must define command or url`);
  }
  if (hasCommand && !isNonEmptyString(server.command)) {
    errors.push(`${label}.command must be a non-empty string`);
  }
  if (hasUrl && !isNonEmptyString(server.url)) {
    errors.push(`${label}.url must be a non-empty string`);
  }
  if (
    server.args !== undefined &&
    (!Array.isArray(server.args) || !server.args.every((value) => isNonEmptyString(value)))
  ) {
    errors.push(`${label}.args must be an array of non-empty strings when present`);
  }
  if (server.cwd !== undefined && !isNonEmptyString(server.cwd)) {
    errors.push(`${label}.cwd must be a non-empty string when present`);
  }
  if (server.env !== undefined) {
    if (!isObject(server.env)) {
      errors.push(`${label}.env must be an object when present`);
      return;
    }
    for (const [key, value] of Object.entries(server.env)) {
      if (!isNonEmptyString(key) || !isNonEmptyString(value)) {
        errors.push(`${label}.env entries must be non-empty string pairs`);
      }
    }
  }
}

function validateInterface(pluginRoot, value, pluginLabel, errors) {
  const iface = requireObject({ interface: value }, "interface", `${pluginLabel}: interface`, errors);
  if (!iface) {
    return;
  }
  rejectUnknownKeys(iface, INTERFACE_KEYS, `${pluginLabel}: interface`, errors);
  for (const field of [
    "displayName",
    "shortDescription",
    "longDescription",
    "developerName",
    "category",
  ]) {
    requireString(iface, field, `${pluginLabel}: interface.${field}`, errors);
  }
  if (iface.defaultPrompt === undefined && iface.default_prompt === undefined) {
    errors.push(`${pluginLabel}: interface.defaultPrompt is required`);
  }
  if (
    !Array.isArray(iface.capabilities) ||
    !iface.capabilities.every((value) => isNonEmptyString(value))
  ) {
    errors.push(`${pluginLabel}: interface.capabilities must be an array of strings`);
  }
  for (const field of ["websiteURL", "privacyPolicyURL", "termsOfServiceURL"]) {
    optionalHttps(iface, field, `${pluginLabel}: interface.${field}`, errors);
  }
  if (iface.brandColor !== undefined && !HEX_COLOR_RE.test(iface.brandColor)) {
    errors.push(`${pluginLabel}: interface.brandColor must use #RRGGBB`);
  }
  for (const field of ["composerIcon", "logo", "logoDark"]) {
    validateAssetPath(pluginRoot, iface[field], `${pluginLabel}: interface.${field}`, errors);
  }
  const screenshots = iface.screenshots ?? [];
  if (!Array.isArray(screenshots)) {
    errors.push(`${pluginLabel}: interface.screenshots must be an array`);
  } else {
    for (const [index, screenshot] of screenshots.entries()) {
      validateAssetPath(
        pluginRoot,
        screenshot,
        `${pluginLabel}: interface.screenshots[${index}]`,
        errors,
      );
    }
  }
}

function validateSkills(pluginRoot, context) {
  const { errors, warnings, strictCodex } = context;
  const skillsDir = path.join(pluginRoot, "skills");
  if (!isDirectory(skillsDir)) {
    return;
  }
  for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".")) {
      continue;
    }
    const skillRoot = path.join(skillsDir, entry.name);
    const label = path.relative(process.cwd(), skillRoot);
    const skillPath = path.join(skillRoot, "SKILL.md");
    if (!fs.existsSync(skillPath)) {
      errors.push(`${label}: missing SKILL.md`);
      continue;
    }
    const text = fs.readFileSync(skillPath, "utf8");
    const frontmatter = extractFrontmatter(text, label, errors);
    if (!frontmatter) {
      continue;
    }
    requireFrontmatterString(frontmatter, "name", label, errors);
    requireFrontmatterString(frontmatter, "description", label, errors);
    const openAIAgentPolicy = validateOpenAIAgentYaml(skillRoot, label, errors);
    const disableModelInvocation =
      frontmatter["disable-model-invocation"] ?? frontmatter.disable_model_invocation;
    if (disableModelInvocation !== undefined && disableModelInvocation !== "false") {
      const message = `${label}: disable-model-invocation is Claude-specific; keep it only when the shared skill needs Claude explicit-invoke behavior`;
      if (strictCodex) {
        errors.push(`${message} (--strict-codex requires it to be omitted or false)`);
      } else if (openAIAgentPolicy.allowImplicitInvocation !== false) {
        warnings.push(message);
      }
    }
  }
}

function validateOpenAIAgentYaml(skillRoot, label, errors) {
  const agentPath = path.join(skillRoot, "agents", "openai.yaml");
  if (!fs.existsSync(agentPath)) {
    errors.push(`${label}: missing agents/openai.yaml for Codex skill metadata`);
    return {};
  }
  const text = fs.readFileSync(agentPath, "utf8");
  if (!/^interface:\s*$/m.test(text)) {
    errors.push(`${label}: agents/openai.yaml must contain an interface block`);
  }
  for (const field of ["display_name", "short_description"]) {
    const match = text.match(new RegExp(`^\\s{2}${field}:\\s*(.+)$`, "m"));
    if (!match || !unquote(match[1]).trim()) {
      errors.push(`${label}: agents/openai.yaml interface.${field} must be non-empty`);
    }
  }
  const allowImplicit = text.match(/^\s{2}allow_implicit_invocation:\s*(.+)$/m);
  if (allowImplicit && !["true", "false"].includes(unquote(allowImplicit[1]).trim())) {
    errors.push(
      `${label}: agents/openai.yaml policy.allow_implicit_invocation must be a boolean`,
    );
  }
  return {
    allowImplicitInvocation: allowImplicit
      ? unquote(allowImplicit[1]).trim() === "true"
      : undefined,
  };
}

function extractFrontmatter(text, label, errors) {
  if (!text.startsWith("---\n")) {
    errors.push(`${label}: SKILL.md must start with YAML frontmatter`);
    return null;
  }
  const end = text.indexOf("\n---", 4);
  if (end === -1) {
    errors.push(`${label}: SKILL.md frontmatter is not closed`);
    return null;
  }
  const raw = text.slice(4, end);
  const result = {};
  for (const [index, line] of raw.split("\n").entries()) {
    if (!line.trim()) {
      continue;
    }
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!match) {
      errors.push(`${label}: unsupported frontmatter line ${index + 1}: ${line}`);
      continue;
    }
    result[match[1]] = unquote(match[2]);
  }
  return result;
}

function readJsonObject(filePath, label, errors) {
  if (!fs.existsSync(filePath)) {
    errors.push(`${label} does not exist`);
    return null;
  }
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    errors.push(`${label} must be valid JSON: ${error.message}`);
    return null;
  }
  if (!isObject(parsed)) {
    errors.push(`${label} must contain a JSON object`);
    return null;
  }
  return parsed;
}

function rejectTodos(value, label, errors) {
  if (typeof value === "string" && value.includes(TODO_MARKER)) {
    errors.push(`${label} contains a [TODO: ...] placeholder`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => rejectTodos(item, label, errors));
    return;
  }
  if (isObject(value)) {
    Object.values(value).forEach((item) => rejectTodos(item, label, errors));
  }
}

function rejectUnknownKeys(value, allowed, label, errors) {
  if (!isObject(value)) {
    return;
  }
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      errors.push(`${label}.${key} is not accepted`);
    }
  }
}

function validateContractPath(object, field, expected, label, errors) {
  if (object[field] === undefined) {
    return;
  }
  if (typeof object[field] !== "string") {
    errors.push(`${label} must be a string path`);
    return;
  }
  const normalized = object[field].replace(/^\.\//, "").replace(/\/$/, "");
  if (normalized !== expected) {
    errors.push(`${label} must resolve to ${expected}`);
  }
}

function validateAssetPath(pluginRoot, rawPath, label, errors) {
  if (rawPath === undefined) {
    return;
  }
  if (!isNonEmptyString(rawPath)) {
    errors.push(`${label} must be a non-empty string`);
    return;
  }
  if (!rawPath.startsWith("./assets/")) {
    errors.push(`${label} must point under ./assets/`);
    return;
  }
  if (!fs.existsSync(path.resolve(pluginRoot, rawPath))) {
    errors.push(`${label} does not exist`);
  }
}

function requireObject(object, field, label, errors) {
  if (!isObject(object[field])) {
    errors.push(`${label} must be an object`);
    return null;
  }
  return object[field];
}

function requireString(object, field, label, errors) {
  if (!isNonEmptyString(object[field])) {
    errors.push(`${label} must be a non-empty string`);
    return null;
  }
  return object[field];
}

function optionalString(object, field, label, errors) {
  if (object[field] !== undefined && !isNonEmptyString(object[field])) {
    errors.push(`${label} must be a non-empty string when present`);
  }
}

function optionalHttps(object, field, label, errors) {
  if (object[field] !== undefined && (!isNonEmptyString(object[field]) || !HTTPS_RE.test(object[field]))) {
    errors.push(`${label} must be an absolute https:// URL when present`);
  }
}

function requireFrontmatterString(frontmatter, field, label, errors) {
  if (!isNonEmptyString(frontmatter[field])) {
    errors.push(`${label}: frontmatter field ${field} must be non-empty`);
  }
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isDirectory(value) {
  return fs.existsSync(value) && fs.statSync(value).isDirectory();
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function unquote(value) {
  return String(value).trim().replace(/^["']|["']$/g, "");
}

main();
