const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");
const { deflateSync } = require("node:zlib");
const c = require("../tools/scripts/umami-snapshot-contract");
const { captureScreenshot, generateSnapshot, findDashboardIssue } = require("../tools/scripts/update-umami-readme-screenshot");
const readme = `prefix\n${c.readmeBlock("2026-09-03T00:00:00Z")}\ntrailing spaces  \n`;
const canonical = fs.readFileSync(c.IMAGE);
function chunk(type, bytes) {
  const out = Buffer.alloc(bytes.length + 12); out.writeUInt32BE(bytes.length);
  out.write(type,4); bytes.copy(out,8); out.writeUInt32BE(c.crc32(out.subarray(4,-4)),out.length-4); return out;
}
function png({width=600,height=250,filter=0,metadata=false,rawLength}={}) {
  const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=2;
  const raw=Buffer.alloc(rawLength ?? (width*3+1)*height,47);
  for(let y=0;y<height;y++) raw[y*(width*3+1)]=filter;
  return Buffer.concat([canonical.subarray(0,8),chunk("IHDR",header),...(metadata?[chunk("tEXt",Buffer.from("private URL"))]:[]),chunk("IDAT",deflateSync(raw)),chunk("IEND",Buffer.alloc(0))]);
}
test("canonical PNG decodes within measured limits",()=>assert.deepEqual([c.decodePng(canonical).width,c.decodePng(canonical).height],[1278,521]));
test("valid image produces exactly three bounded files and preserves README bytes outside markers",()=>{
  const result=c.buildSnapshot({readme,previousImage:canonical,image:png(),now:"2026-09-05T16:01:00Z"});
  assert.equal(result.state,"UPDATED");assert.equal(result.day,"2026-09-06");assert.equal(result.files.length,3);
  c.validateReadme(readme,result.files[0].bytes.toString());assert.equal(result.files[2].path,"assets/analytics/history/2026-09-06.png");
});
test("same decoded pixels have no timestamp/history/commit churn",()=>assert.deepEqual(c.buildSnapshot({readme,previousImage:canonical,image:canonical,now:"2026-09-07"}).files,[]));
test("Taipei midnight and leap dates are deterministic",()=>{
  assert.equal(c.snapshotDate("2026-09-05T15:59:59Z"),"2026-09-05");assert.equal(c.snapshotDate("2026-09-05T16:00:00Z"),"2026-09-06");
  assert.equal(c.validDate("2026-02-29"),false);assert.equal(c.validDate("2028-02-29"),true);assert.equal(c.validDate("2026-99-01"),false);
  assert.throws(()=>c.snapshotDate("invalid"));
});
test("markers must exist once in order",()=>{
  for(const text of ["",c.END+c.START,readme+c.START,readme+c.END]) assert.throws(()=>c.splitReadme(text));
});
test("README rejects unrelated edits and injected analytics markup",()=>{
  assert.throws(()=>c.validateReadme(readme,readme.replace("prefix","changed")));
  assert.throws(()=>c.validateReadme(readme,readme.replace("Daily Umami","<script>Daily Umami")));
});
test("file allowlist excludes code, path traversal, invalid dates, deletions and symlinks",()=>{
  for(const path of ["worker.js","assets/analytics/history/2026-02-30.png","assets/analytics/history/../x.png","assets/analytics/foo.png"])
    assert.throws(()=>c.validateFiles([{path,status:"added",bytes:canonical}]));
  for(const status of ["removed","renamed"]) assert.throws(()=>c.validateFiles([{path:c.IMAGE,status,bytes:canonical}]));
  assert.throws(()=>c.validateFiles([{path:c.IMAGE,status:"modified",mode:"120000",bytes:canonical}]));
});
test("PNG rejects corrupt CRC, truncated stream, oversized dimensions, metadata, trailing data, illegal filters",()=>{
  const corrupt=Buffer.from(canonical);corrupt[40]^=1;
  for(const bytes of [Buffer.from("not png"),corrupt,canonical.subarray(0,-8),Buffer.concat([canonical,Buffer.from("secret")]),png({width:2001}),png({height:1001}),png({metadata:true}),png({filter:5}),png({rawLength:100}),Buffer.alloc(c.LIMITS.maxBytes+1)]) assert.throws(()=>c.decodePng(bytes));
});
test("PNG reconstructs all five standard filters",()=>{for(let filter=0;filter<=4;filter++) assert.equal(c.decodePng(png({filter})).width,600);});
test("invalid generation preserves last-good image, README, and history",async()=>{
  const before=Buffer.from(canonical), original=readme;
  await assert.rejects(generateSnapshot({readme,previousImage:canonical,shareUrl:"private",capture:async()=>Buffer.from("bad")}),c.SnapshotError);
  assert.deepEqual(canonical,before);assert.equal(readme,original);
});
test("fetch exceptions redact URLs and all original exception content",async()=>{
  const chromium={launch:async()=>({newPage:async()=>({goto:async()=>{throw new Error("https://cloud.umami.is/share/PRIVATE_TOKEN");}}),close:async()=>{}})};
  await assert.rejects(captureScreenshot("https://cloud.umami.is/share/PRIVATE_TOKEN",chromium),e=>e.message==="FETCH_FAILURE");
  assert.equal(c.safeFailure(new Error("SECRET")),"VALIDATION_FAILURE");
});
test("missing or untrusted Share URL fails without browser navigation",async()=>{
  for(const url of [undefined,"http://cloud.umami.is/share/x","https://evil.test/share/x","https://user:pass@cloud.umami.is/share/x"])
    await assert.rejects(captureScreenshot(url,{}),e=>e.state==="FETCH_FAILURE");
});
test("dashboard classifier recognizes valid and error pages without returning private text",async()=>{
  const previous=global.document;
  try { for(const [text,invalid] of [["Visitors Views",false],["Something went wrong PRIVATE",true],["Sign in",true]]) {
    global.document={body:{innerText:text}};
    const result=await findDashboardIssue({evaluate:fn=>fn()});assert.equal(Boolean(result),invalid);assert.ok(!result.includes("PRIVATE"));
  }} finally {global.document=previous;}
});
test("CLI failure returns nonzero without exposing Share URL or touching outputs",()=>{
  const before=fs.readFileSync("README.md"), image=fs.readFileSync(c.IMAGE);
  const result=spawnSync(process.execPath,["tools/scripts/update-umami-readme-screenshot.js"],{env:{...process.env,UMAMI_SHARE_URL:"https://evil.test/PRIVATE_CANARY"},encoding:"utf8"});
  assert.equal(result.status,1);assert.match(result.stderr,/FETCH_FAILURE/);assert.doesNotMatch(result.stderr,/PRIVATE_CANARY|evil/);
  assert.deepEqual(fs.readFileSync("README.md"),before);assert.deepEqual(fs.readFileSync(c.IMAGE),image);
});
