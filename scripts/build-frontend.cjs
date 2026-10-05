const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const output = path.join(root, "dist");
const apiBaseUrl = (process.env.KTX_API_BASE_URL || "").trim().replace(/\/+$/, "");
const allowStudentDemoAuth = process.env.NODE_ENV !== "production"
    && !process.env.VERCEL
    && process.env.KTX_ENABLE_STUDENT_DEMO === "true";

if (process.env.VERCEL && !apiBaseUrl) {
    throw new Error("Set KTX_API_BASE_URL in Vercel before building the frontend.");
}

if (apiBaseUrl) {
    let parsed;
    try {
        parsed = new URL(apiBaseUrl);
    } catch {
        throw new Error("KTX_API_BASE_URL must be an absolute HTTP(S) URL.");
    }
    if (!["http:", "https:"].includes(parsed.protocol)
        || parsed.origin !== apiBaseUrl
        || parsed.pathname !== "/"
        || parsed.search
        || parsed.hash) {
        throw new Error("KTX_API_BASE_URL must be an origin without a path, query, or fragment.");
    }
    if (process.env.VERCEL && parsed.protocol !== "https:") {
        throw new Error("KTX_API_BASE_URL must use HTTPS when building on Vercel.");
    }
}

fs.mkdirSync(output, { recursive: true });
for (const file of ["Admin.html", "Student.html", "style.css", "student.css"]) {
    fs.copyFileSync(path.join(root, file), path.join(output, file));
}
fs.cpSync(path.join(root, "js"), path.join(output, "js"), { recursive: true });
fs.cpSync(path.join(root, "files"), path.join(output, "files"), { recursive: true });
fs.writeFileSync(
    path.join(output, "js", "runtime-config.js"),
    `window.KTX_CONFIG = Object.freeze({ apiBaseUrl: ${JSON.stringify(apiBaseUrl)}, allowStudentDemoAuth: ${allowStudentDemoAuth} });\nwindow.KTX_IMAGE_PATHS = Object.freeze({ dormitory: "files/ky-tuc-xa.webp", banyan: "files/cay-bang.webp" });\n`,
    "utf8"
);
fs.writeFileSync(
    path.join(output, "index.html"),
    '<!doctype html><meta http-equiv="refresh" content="0;url=/Admin.html"><a href="/Admin.html">Open KTX</a>\n',
    "utf8"
);
