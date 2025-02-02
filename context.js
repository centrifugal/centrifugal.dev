const fs = require("fs");
const path = require("path");

// Paths
const DOCUSAURUS_DOCS_DIR = path.join(__dirname, "docs");
const SIDEBARS_FILE = path.join(__dirname, "src/sidebars.js");
const OUTPUT_FILE = path.join(__dirname, "static/centrifugo-ai-context-v6.md");

// Read external directories and files with descriptions from CLI args
const args = process.argv.slice(2);
let externalItems = [];

for (let i = 0; i < args.length; i += 2) {
    const itemPath = args[i];
    const description = args[i + 1] || "Additional Documentation";

    if (!fs.existsSync(itemPath)) {
        console.error(`❌ ERROR: File or directory not found - "${itemPath}"`);
        process.exit(1);
    }

    externalItems.push({ path: itemPath, description, isDirectory: fs.statSync(itemPath).isDirectory() });
}

// Function to get all markdown files recursively from the `docs` directory (only .md/.mdx)
function getMarkdownFiles(dir) {
    let files = [];
    try {
        fs.readdirSync(dir).forEach((file) => {
            let fullPath = path.join(dir, file);
            if (fs.statSync(fullPath).isDirectory()) {
                files = files.concat(getMarkdownFiles(fullPath));
            } else if (fullPath.endsWith(".md") || fullPath.endsWith(".mdx")) {
                files.push(fullPath);
            }
        });
    } catch (error) {
        console.error(`⚠️ Error reading directory ${dir}:`, error.message);
    }
    return files;
}

// Function to get all files recursively (including non-markdown files) from external sources
function getAllFiles(dir) {
    let files = [];
    try {
        fs.readdirSync(dir).forEach((file) => {
            let fullPath = path.join(dir, file);
            if (fs.statSync(fullPath).isDirectory()) {
                files = files.concat(getAllFiles(fullPath));
            } else {
                files.push(fullPath);
            }
        });
    } catch (error) {
        console.error(`⚠️ Error reading directory ${dir}:`, error.message);
    }
    return files;
}

// Function to extract ordered document IDs from sidebars.js
function getSidebarOrder() {
    try {
        const sidebarConfig = require(SIDEBARS_FILE);
        let orderedIDs = [];

        function extractIDs(items) {
            if (Array.isArray(items)) {
                items.forEach((item) => {
                    if (typeof item === "string") {
                        orderedIDs.push(item);
                    } else if (item.items) {
                        extractIDs(item.items);
                    }
                });
            }
        }

        Object.values(sidebarConfig).forEach(extractIDs);
        console.log(`📌 Found ${orderedIDs.length} document IDs from sidebars.js`);
        return orderedIDs;
    } catch (error) {
        console.error("❌ ERROR: Failed to load sidebars.js");
        process.exit(1);
    }
}

// Function to extract document ID from markdown frontmatter
function getDocID(filePath) {
    try {
        let content = fs.readFileSync(filePath, "utf-8");
        let match = content.match(/---\s*\n(?:.|\n)*?id:\s*([\w\-/]+)\s*\n/);
        if (match) {
            return match[1].trim();
        } else {
            console.warn(`⚠️ Warning: No 'id' found in ${filePath}`);
            return null;
        }
    } catch (error) {
        console.error(`⚠️ Error reading file ${filePath}:`, error.message);
        return null;
    }
}

// Function to build a map of file paths based on their document ID
function getOrderedDocsFiles() {
    let allFiles = getMarkdownFiles(DOCUSAURUS_DOCS_DIR);
    let fileMap = new Map();

    console.log(`📂 Found ${allFiles.length} markdown files in the docs directory`);

    // Build a map of doc ID -> file path (including folder structure)
    allFiles.forEach((file) => {
        let docID = getDocID(file);
        if (docID) {
            let relativePath = path.relative(DOCUSAURUS_DOCS_DIR, file);
            let folderPath = path.dirname(relativePath).replace(/\\/g, "/"); // Normalize Windows paths
            let fullID = folderPath === "." ? docID : `${folderPath}/${docID}`; // Include folder if exists

            fileMap.set(fullID, file);
            console.log(`✅ Mapping: ${fullID} -> ${file}`);
        }
    });

    let orderedIDs = getSidebarOrder();
    let orderedFiles = [];

    // Add files based on sidebar order
    orderedIDs.forEach((docID) => {
        if (fileMap.has(docID)) {
            orderedFiles.push(fileMap.get(docID));
        } else {
            console.warn(`⚠️ Missing file for ID: ${docID}`);
        }
    });

    console.log(`📌 Ordered ${orderedFiles.length} documents based on sidebar`);

    return orderedFiles;
}

// Function to read and concatenate file content
function combineFiles(files, header = "") {
    let content = header ? `\n## ${header}\n\n` : "";
    files.forEach((file) => {
        try {
            content += `\n\n---\n\n### ${path.basename(file)}\n\n`;
            content += fs.readFileSync(file, "utf-8");
        } catch (error) {
            console.error(`⚠️ Error reading file ${file}:`, error.message);
        }
    });
    return content;
}

// Main function to merge documentation
function mergeDocs() {
    console.log("🔍 Collecting markdown files...");

    let allContent = `# Centrifugo AI context\n\n`;

    // Add Docusaurus docs in the specified order
    let docFiles = getOrderedDocsFiles();
    if (docFiles.length) {
        allContent += combineFiles(docFiles, "Centrifugo Documentation");
    } else {
        console.warn("⚠️ No Docusaurus documentation files found! Check sidebar order or file mapping.");
    }

    // Process external directories and individual files (include all files)
    externalItems.forEach(({ path, description, isDirectory }) => {
        console.log(`📂 Including: ${path}`);
        let files = isDirectory ? getAllFiles(path) : [path];

        if (files.length) {
            allContent += `\n\n## ${description}\n\n`;
            allContent += combineFiles(files);
        }
    });

    // Ensure the static directory exists
    const outputDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write final document
    fs.writeFileSync(OUTPUT_FILE, allContent, "utf-8");

    console.log(`✅ Combined document saved at: ${OUTPUT_FILE}`);
}

// Run script
mergeDocs();
