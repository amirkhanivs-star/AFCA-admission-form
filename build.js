import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dist = path.join(__dirname, "dist");

if (fs.existsSync(dist)) {
  fs.rmSync(dist, {
    recursive: true,
    force: true,
  });
}

fs.mkdirSync(dist, {
  recursive: true,
});

const files = [
  "index.html",
  "styles.css",
  "script.js",
];

for (const file of files) {
  fs.copyFileSync(
    path.join(__dirname, file),
    path.join(dist, file)
  );

  console.log(`Copied: ${file}`);
}

const imgSource = path.join(__dirname, "img");
const imgDestination = path.join(dist, "img");

if (fs.existsSync(imgSource)) {
  fs.cpSync(imgSource, imgDestination, {
    recursive: true,
  });

  console.log("Copied: img/");
}

console.log("AFCA static build completed.");
