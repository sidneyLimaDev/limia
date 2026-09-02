const { copyFileSync, mkdirSync } = require("node:fs");
const { join } = require("node:path");

const root = join(__dirname, "..");
const output = join(root, "dist", "renderer", "assets");
mkdirSync(output, { recursive: true });
copyFileSync(join(root, "bloub-hexagone-attentif-encre-anime.svg"), join(output, "limia-animated.svg"));
