/**
 * Unit tests for the pure, DOM-free logic: redaction, quality engine,
 * formatters. Run with: npm run test:unit
 * (node --experimental-strip-types; no build step needed)
 */
import { applyRedactions } from "../src/lib/redact.ts";
import { assessQuality } from "../src/lib/quality.ts";
import { reportToMarkdown, reportToJSON, slugifyFilename } from "../src/lib/format.ts";
import {
  buildStorageKey,
  isAllowedContentType,
  matchesMagic,
  MAX_ATTACHMENT_BYTES,
  MAX_USER_ATTACHMENTS,
  MAX_USER_STORAGE_BYTES,
  sanitizeFilename,
} from "../functions/lib/attachments.ts";
import type { Report, Step } from "../src/lib/api.ts";

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean) {
  if (cond) { passed++; console.log(`  PASS ${name}`); }
  else { failed++; console.log(`  FAIL ${name}`); }
}

const fullReport = {
  id: "r1", title: "Login button does nothing", description: "Clicking login does nothing on Chrome.",
  site_name: "Acme", site_url: "https://acme.example/login", category: "bug", severity: "high",
  status: "open", expected_result: "Dashboard opens", actual_result: "Nothing happens",
  error_message: "TypeError: x is not a function", notes: "", env_json: "{}",
  created_at: 1, updated_at: 1, owner_id: "u1", workspace_id: null,
  assignee_id: null, archived: 0,
} as unknown as Report;
const fullSteps: Step[] = [
  { id: "s1", report_id: "r1", position: 1, text: "Open the login page", note: "", expected_result: "Form shows" },
  { id: "s2", report_id: "r1", position: 2, text: "Enter valid credentials", note: "", expected_result: "" },
  { id: "s3", report_id: "r1", position: 3, text: "Click Login", note: "", expected_result: "Dashboard opens" },
];

// --- Redaction: covered pixels are truly black, uncovered pixels untouched ---
{
  const w = 4, h = 4;
  const data = new Uint8ClampedArray(w * h * 4).fill(255); // all white
  const out = applyRedactions({ width: w, height: h, data }, [{ x: 1, y: 1, w: 2, h: 2 }]);
  const px = (x: number, y: number) => Array.from(out.data.slice((y * w + x) * 4, (y * w + x) * 4 + 4));
  check("redacted pixel is solid black", px(1, 1).join(",") === "0,0,0,255");
  check("redacted pixel (2,2) is solid black", px(2, 2).join(",") === "0,0,0,255");
  check("uncovered pixel stays white", px(0, 0).join(",") === "255,255,255,255");
  check("original input not mutated", data[0] === 255 && data[(1 * w + 1) * 4] === 255);
  // Out-of-bounds / negative rects must not throw and must clamp safely.
  const out2 = applyRedactions({ width: w, height: h, data }, [{ x: -5, y: -5, w: 20, h: 20 }]);
  check("oversized rect clamps without throwing", out2.data.every((v, i) => (i % 4 === 3 ? v === 255 : v === 0)));
  const out3 = applyRedactions({ width: w, height: h, data }, []);
  check("empty rect list leaves image unchanged", out3.data.every((v) => v === 255));
}

// --- Quality engine ---
{
  const full = assessQuality(fullReport, fullSteps, 1);
  check("complete report scores >= 80", full.score >= 80);
  check("complete report has no error issues", !full.issues.some((i) => i.severity === "error"));
  const empty = assessQuality(
    { ...fullReport, title: "", description: "", expected_result: "", actual_result: "" } as unknown as Report,
    [], 0,
  );
  check("empty report scores low", empty.score < 50);
  check("empty report lists missing title", empty.issues.some((i) => i.message.toLowerCase().includes("title")));
  check("every issue explains WHY", [...full.issues, ...empty.issues].every((i) => typeof i.why === "string" && i.why.length > 0));
  check("good title needs no suggestion (null)", full.suggestedTitle === null);
  const generic = assessQuality({ ...fullReport, title: "bug" } as unknown as Report, fullSteps, 1);
  check("generic title gets a suggested title", typeof generic.suggestedTitle === "string" && (generic.suggestedTitle?.length ?? 0) > 0);
}

// --- Formatters ---
{
  const md = reportToMarkdown(fullReport, fullSteps, []);
  check("markdown contains title", md.includes("Login button does nothing"));
  check("markdown contains numbered steps", md.includes("1. Open the login page") && md.includes("3. Click Login"));
  check("markdown contains expected/actual", md.includes("Dashboard opens") && md.includes("Nothing happens"));
  const js = JSON.parse(reportToJSON(fullReport, fullSteps, []));
  check("JSON export round-trips title + steps", js.title === fullReport.title && js.steps.length === 3);
  check("slugify produces safe filename", slugifyFilename("Login button does nothing!") === "login-button-does-nothing");
  check("slugify falls back for empty title", slugifyFilename("!!!") === "reprokit-report");
}

// --- Attachment helpers (storage layer): magic bytes, size cap, filenames, keys, quotas ---
{
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
  const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
  const text = new TextEncoder().encode("hello, not an image");
  check("magic: real PNG matches", matchesMagic(png, "image/png"));
  check("magic: real JPEG matches", matchesMagic(jpeg, "image/jpeg"));
  check("magic: real WebP matches", matchesMagic(webp, "image/webp"));
  check("magic: text bytes fail PNG", !matchesMagic(text, "image/png"));
  check("magic: PNG bytes fail JPEG (cross-type)", !matchesMagic(png, "image/jpeg"));
  check("magic: truncated PNG fails", !matchesMagic(new Uint8Array([0x89, 0x50]), "image/png"));
  check("magic: empty buffer fails", !matchesMagic(new Uint8Array(0), "image/png"));
  check("magic: unknown type fails", !matchesMagic(png, "image/gif"));

  check("content-type allowlist accepts png/jpeg/webp",
    isAllowedContentType("image/png") && isAllowedContentType("image/jpeg") && isAllowedContentType("image/webp"));
  check("content-type allowlist rejects gif/svg", !isAllowedContentType("image/gif") && !isAllowedContentType("image/svg+xml"));
  check("content-type allowlist is case-sensitive (server lowercases first)",
    !isAllowedContentType("IMAGE/PNG"));

  check("size cap is exactly 10 MiB", MAX_ATTACHMENT_BYTES === 10 * 1024 * 1024);
  check("size cap fits KV 25 MiB value limit", MAX_ATTACHMENT_BYTES < 25 * 1024 * 1024);

  check("sanitize strips path separators", sanitizeFilename("../../etc/passwd") === "__.._etc_passwd");
  check("sanitize strips backslashes + reserved chars", sanitizeFilename("a\\b:c?d*e") === "a_b_c_d_e");
  check("sanitize strips leading dots", sanitizeFilename("...hidden") === "_hidden");
  check("sanitize keeps a normal name", sanitizeFilename("screenshot 1.png") === "screenshot 1.png");
  check("sanitize caps at 120 chars", sanitizeFilename("x".repeat(200)).length === 120);
  check("sanitize falls back for empty name", sanitizeFilename("") === "upload");

  check("storage key is server-generated opaque path", buildStorageKey("owner1", "att1") === "att/owner1/att1");
  check("storage key never contains the client filename",
    !buildStorageKey("owner1", "att1").includes("screenshot"));

  check("user quota is 200 MiB", MAX_USER_STORAGE_BYTES === 200 * 1024 * 1024);
  check("user file-count quota is 200", MAX_USER_ATTACHMENTS === 200);
}

console.log(`\nUnit: ${passed}/${passed + failed} passed${failed ? ` — ${failed} FAILURES` : ""}`);
process.exit(failed ? 1 : 0);
