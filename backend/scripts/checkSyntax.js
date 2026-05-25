const { readdirSync } = require("node:fs");
const { join, relative } = require("node:path");
const { spawnSync } = require("node:child_process");

const rootDir = join(__dirname, "..");
const ignoredDirectories = new Set(["node_modules", ".git"]);

const findJavaScriptFiles = (directory) => {
  const entries = readdirSync(directory, { withFileTypes: true });
  const files = [];

  entries.forEach((entry) => {
    const fullPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      if (!ignoredDirectories.has(entry.name)) {
        files.push(...findJavaScriptFiles(fullPath));
      }
      return;
    }

    if (entry.isFile() && entry.name.endsWith(".js")) {
      files.push(fullPath);
    }
  });

  return files;
};

const files = findJavaScriptFiles(rootDir);
const failures = [];

files.forEach((file) => {
  const result = spawnSync(process.execPath, ["--check", file], {
    encoding: "utf8",
  });

  if (result.status !== 0) {
    failures.push({
      file: relative(rootDir, file),
      output: `${result.stdout}${result.stderr}`.trim(),
    });
  }
});

if (failures.length > 0) {
  console.error("Backend syntax check failed:");
  failures.forEach((failure) => {
    console.error(`\n${failure.file}`);
    console.error(failure.output);
  });
  process.exit(1);
}

console.log(`Backend syntax check passed for ${files.length} JavaScript files.`);
