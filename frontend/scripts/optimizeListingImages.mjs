import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import sharp from "sharp";

const SUPPORTED_SOURCE_PATTERN =
  /^[a-z0-9]+(?:-[a-z0-9]+)*-\d{2}\.(?:jpe?g|png|tiff?|webp)$/;
const DEFAULT_OUTPUT_DIRECTORY = "public/images/listings/demo";
const TARGET_WIDTH = 1200;
const TARGET_HEIGHT = 800;
const WEBP_QUALITY = 80;

const readOption = (name) => {
  const optionIndex = process.argv.indexOf(name);
  return optionIndex >= 0 ? process.argv[optionIndex + 1] : "";
};

const inputOption = readOption("--input");
const outputOption = readOption("--output") || DEFAULT_OUTPUT_DIRECTORY;
const force = process.argv.includes("--force");

if (!inputOption) {
  throw new Error(
    "Missing --input. Example: npm run images:optimize -- --input ./listing-image-sources",
  );
}

const inputDirectory = path.resolve(process.cwd(), inputOption);
const outputDirectory = path.resolve(process.cwd(), outputOption);

const inputStats = await fs.stat(inputDirectory).catch(() => null);
if (!inputStats?.isDirectory()) {
  throw new Error(`Input directory does not exist: ${inputDirectory}`);
}

const sourceNames = (await fs.readdir(inputDirectory))
  .filter((fileName) => !fileName.startsWith("."))
  .sort((firstName, secondName) => firstName.localeCompare(secondName));

if (sourceNames.length === 0) {
  throw new Error(`Input directory contains no files: ${inputDirectory}`);
}

const invalidNames = sourceNames.filter(
  (fileName) => !SUPPORTED_SOURCE_PATTERN.test(fileName),
);
if (invalidNames.length > 0) {
  throw new Error(
    `Source filenames must be lowercase, hyphen-separated, zero-padded, and use a supported raster extension: ${invalidNames.join(
      ", ",
    )}`,
  );
}

await fs.mkdir(outputDirectory, { recursive: true });

for (const sourceName of sourceNames) {
  const sourcePath = path.join(inputDirectory, sourceName);
  const outputName = `${path.parse(sourceName).name}.webp`;
  const outputPath = path.join(outputDirectory, outputName);

  if (!force) {
    const existingOutput = await fs.stat(outputPath).catch(() => null);
    if (existingOutput) {
      throw new Error(
        `Refusing to overwrite ${outputPath}. Re-run with --force after reviewing the target.`,
      );
    }
  }

  const sourceMetadata = await sharp(sourcePath).metadata();
  if (!sourceMetadata.width || !sourceMetadata.height) {
    throw new Error(`Could not read image dimensions: ${sourcePath}`);
  }

  const result = await sharp(sourcePath)
    .rotate()
    .resize({
      width: TARGET_WIDTH,
      height: TARGET_HEIGHT,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: WEBP_QUALITY, effort: 6 })
    .toFile(outputPath);
  const outputStats = await fs.stat(outputPath);

  console.log(
    `${sourceName} -> ${outputName}: ${result.width}x${result.height}, ${outputStats.size} bytes`,
  );
}
