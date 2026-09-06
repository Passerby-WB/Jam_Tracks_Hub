const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const a=require("../tools/scripts/umami-snapshot-automation");
const c=require("../tools/scripts/umami-snapshot-contract");
const SHA="a".repeat(40), BASE="b".repeat(40), SOURCE="c".repeat(40);
const image=fs.readFileSync(c.IMAGE);
const env={GITHUB_REPOSITORY:a.REPO,UMAMI_APP_SLUG:a.APP,GITHUB_WORKFLOW_REF:`${a.REPO}/${a.WORKFLOW}@refs/heads/main`,GITHUB_REF:"refs/heads/main",GITHUB_EVENT_NAME:"schedule",UMAMI_DRY_RUN:"false",GITHUB_RUN_ID:"123",GITHUB_SHA:SOURCE};
const before=`outside\n${c.readmeBlock("2026-09-03")}\nend`;
const after=`outside\n${c.readmeBlock("2026-09-06")}\nend`;
function pr(dryRun=false){return {number:41,node_id:"PR_test",title:"chore: refresh Umami analytics snapshot",state:"open",draft:false,mergeable:true,merged:false,changed_files:3,body:a.prBody("2026-09-06",dryRun),user:{login:a.BOT,type:"Bot"},base:{ref:"main",repo:{full_name:a.REPO}},head:{ref:`${a.BRANCH_PREFIX}2026-09-06`,sha:SHA,repo:{full_name:a.REPO}},auto_merge:null};}
function runs(status="completed",conclusion="success"){return a.CHECKS.map((r,i)=>({id:i+1,name:r.name,app:{id:r.app},head_sha:SHA,status,conclusion}));}
function fixture({dryRun=false,checkRuns=runs(),merged=false}={}){
  const record=pr(dryRun),writes=[],mutations=[];
  const files=[{filename:"README.md",status:"modified"},{filename:c.IMAGE,status:"modified"},{filename:`${c.PREFIX}2026-09-06.png`,status:"added"}];
  const api={record,writes,mutations,files,
    async read(path){
      if(path===`pulls/${record.number}`)return {...record,merged:record.merged||merged};
      if(path.startsWith("compare/"))return {total_commits:1,merge_base_commit:{sha:BASE}};
      if(path.startsWith("git/trees/"))return {truncated:false,tree:files.map(f=>({path:f.filename,mode:"100644",type:"blob"}))};
      if(path.startsWith("actions/runs/"))return {path:a.WORKFLOW,head_sha:SOURCE,head_repository:{full_name:a.REPO},event:"schedule",head_branch:"main"};
      if(path.includes("check-runs"))return {total_count:checkRuns.length,check_runs:checkRuns};
      if(path.startsWith("git/ref/heads/"))return {object:{sha:SHA}};
      throw new Error(`unexpected read ${path}`);
    },
    async pages(path){
      if(path.endsWith("/files"))return files;
      if(path.endsWith("/commits"))return [{author:{login:a.BOT},committer:{login:a.BOT},commit:{verification:{verified:true},message:`snapshot\nUmami-Run: 123\nUmami-Source: ${SOURCE}\nUmami-Mode: ${dryRun?"dry-run":"production"}\n`}}];
      return [];
    },
    async blob(sha,path){return path==="README.md"?Buffer.from(sha===BASE?before:after):image;},
    async write(method,path,body){writes.push({method,path,body});if(body?.state==="closed")record.state="closed";return {};},
    async mutate(name,input){mutations.push({name,input});record.auto_merge=name.startsWith("enable")?{}:null;return {};}
  };return api;
}
test("execution accepts main and confines feature dispatch to dry-run",()=>{
  a.assertExecution(env);
  const e={...env,GITHUB_REF:"refs/heads/fix/umami-readme-automerge-v1",GITHUB_EVENT_NAME:"workflow_dispatch",UMAMI_DRY_RUN:"true"};e.GITHUB_WORKFLOW_REF=`${a.REPO}/${a.WORKFLOW}@${e.GITHUB_REF}`;a.assertExecution(e);
  assert.throws(()=>a.assertExecution({...e,UMAMI_DRY_RUN:"false"}));
  for(const patch of [{GITHUB_REPOSITORY:"other/repo"},{UMAMI_APP_SLUG:"other"},{GITHUB_WORKFLOW_REF:"other.yml"},{GITHUB_EVENT_NAME:"pull_request"}])assert.throws(()=>a.assertExecution({...env,...patch}));
});
test("identity rejects humans, forks, normal branches, wrong base, draft and dry-run promotion",()=>{
  a.identify(pr());
  for(const edit of [p=>p.user.login="human",p=>p.user.type="User",p=>p.head.repo.full_name="fork/repo",p=>p.head.ref="fix/umami-readme-automerge-v1",p=>p.base.ref="release",p=>p.draft=true,p=>p.body="spoofed"]){const p=pr();edit(p);assert.throws(()=>a.identify(p));}
  assert.throws(()=>a.identify(pr(true)));
});
test("one open PR maximum, reuse existing machine branch, normal PRs ignored",()=>{
  assert.equal(a.selectOpen([pr()],false).number,41);
  assert.throws(()=>a.selectOpen([pr(),pr()],false));
  const normal=pr();normal.head.ref="fix/something";assert.equal(a.selectOpen([normal],false),undefined);
});
test("required checks must match producer, SHA, latest attempt and positive success",()=>{
  assert.equal(a.requiredChecks(runs(),SHA),"PASS");
  for(const conclusion of ["failure","cancelled","timed_out","skipped","neutral"])assert.equal(a.requiredChecks(runs("completed",conclusion),SHA),"FAIL");
  assert.equal(a.requiredChecks([],SHA),"PENDING");assert.equal(a.requiredChecks(runs(),BASE),"PENDING");
  const spoof=runs();spoof[0].app.id=999;assert.equal(a.requiredChecks(spoof,SHA),"PENDING");
  const rerun=runs();rerun.push({...rerun[0],id:50,status:"in_progress",conclusion:null});assert.equal(a.requiredChecks(rerun,SHA),"PENDING");
});
test("remote PR passes data, signed App commits and workflow provenance gates",async()=>{const api=fixture();assert.equal((await a.validateRemotePR(api,api.record,false)).length,3);});
test("GitHub-signed web-flow committer and trimmed message preserve strict App provenance",async()=>{
  const api=fixture(),pages=api.pages;
  api.pages=async path=>{const rows=await pages(path);if(path.endsWith("/commits")){rows[0].committer.login="web-flow";rows[0].commit.message=rows[0].commit.message.trimEnd();}return rows;};
  assert.equal((await a.validateRemotePR(api,api.record,false)).length,3);
  const signedPages=api.pages;
  api.pages=async path=>{const rows=await signedPages(path);if(path.endsWith("/commits"))rows[0].commit.verification.verified=false;return rows;};
  await assert.rejects(a.validateRemotePR(api,api.record,false));
});
test("remote gate rejects nonallowlisted code before retrieving its contents",async()=>{
  const api=fixture();api.files[2]={filename:"worker.js",status:"modified"};await assert.rejects(a.validateRemotePR(api,api.record,false));assert.equal(api.writes.length,0);
});
test("remote gate rejects unrelated README edits",async()=>{
  const api=fixture(),original=api.blob;api.blob=async(sha,path)=>path==="README.md"&&sha===SHA?Buffer.from(after.replace("outside","injected")):original(sha,path);
  await assert.rejects(a.validateRemotePR(api,api.record,false));
});
test("remote gate rejects unsigned/foreign commits and wrong workflow",async()=>{
  for(const mode of ["unsigned","human","workflow"]){
    const api=fixture(),pages=api.pages,read=api.read;
    api.pages=async p=>{const rows=await pages(p);if(p.endsWith("commits")){if(mode==="unsigned")rows[0].commit.verification.verified=false;if(mode==="human")rows[0].author.login="human";}return rows;};
    api.read=async p=>{const r=await read(p);if(mode==="workflow"&&p.startsWith("actions/runs"))r.path="other.yml";return r;};
    await assert.rejects(a.validateRemotePR(api,api.record,false));
  }
});
test("remote gate rejects symlink modes and truncated inventories",async()=>{
  for(const truncated of [false,true]){const api=fixture(),read=api.read;api.read=async p=>p.startsWith("git/trees")?{truncated,tree:api.files.map(f=>({path:f.filename,mode:"120000",type:"blob"}))}:read(p);await assert.rejects(a.validateRemotePR(api,api.record,false));}
});
test("conflicting PR safely stops without writes or automerge",async()=>{const api=fixture();api.record.mergeable=false;await assert.rejects(a.finishPR(api,41,SHA,false,async()=>{}));assert.equal(api.mutations.length,0);assert.equal(api.writes.length,0);});
test("failed CI leaves PR open without merge enrollment",async()=>{const api=fixture({checkRuns:runs("completed","failure")});await assert.rejects(a.finishPR(api,41,SHA,false,async()=>{}),/REQUIRED_CHECK_FAILED/);assert.equal(api.record.state,"open");assert.equal(api.mutations.length,0);});
test("native auto-merge is SHA-bound SQUASH and has no bypass/direct merge fallback",async()=>{
  const api=fixture({checkRuns:runs("in_progress",null)});
  await assert.rejects(a.finishPR(api,41,SHA,false,async()=>{throw new Error("stop polling");}),/stop polling/);
  assert.deepEqual(api.mutations[0].input.expectedHeadOid,SHA);assert.equal(api.mutations[0].input.mergeMethod,"SQUASH");assert.equal(api.mutations[0].name,"enablePullRequestAutoMerge");assert.equal(api.writes.length,0);
});
test("API rejection of native auto-merge never falls back to direct merge",async()=>{const api=fixture();api.mutate=async()=>{throw new Error("GITHUB_GRAPHQL_FAILURE");};await assert.rejects(a.finishPR(api,41,SHA,false,async()=>{}));assert.equal(api.writes.length,0);});
test("dry run proves checks then closes/deletes only its test branch; never enables merge",async()=>{
  const api=fixture({dryRun:true});assert.equal(await a.finishPR(api,41,SHA,true,async()=>{}),"DRY_RUN_PASS");assert.equal(api.mutations.length,0);
  assert.deepEqual(api.writes.map(w=>[w.method,w.path]),[["PATCH","pulls/41"],["DELETE",`git/refs/heads/${api.record.head.ref}`]]);
});
test("cleanup rejects main, human branches, unmerged production PR and changed tips",async()=>{
  for(const edit of [p=>p.head.ref="main",p=>p.head.ref="fix/human",p=>p.merged=false]){
    const api=fixture(),p={...pr(),state:"closed",merged:true};edit(p);await assert.rejects(a.cleanup(api,p,SHA));assert.equal(api.writes.length,0);
  }
  const api=fixture();await assert.rejects(a.cleanup(api,{...pr(),state:"closed",merged:true},BASE));
});
test("no image diff makes no remote mutation or branch",async()=>{
  const api=fixture();assert.deepEqual(await a.runAutomation({env,api,capture:async()=>image,now:"2026-09-06"}),{state:"UNCHANGED"});assert.equal(api.writes.length,0);assert.equal(api.mutations.length,0);
});
test("unchanged dry-run retry only completes existing PR checks and cleanup",async()=>{
  const api=fixture({dryRun:true}),pages=api.pages;
  api.pages=async path=>path.startsWith("pulls?state=open")?[api.record]:pages(path);
  assert.equal((await a.runAutomation({env:{...env,UMAMI_DRY_RUN:"true"},api,capture:async()=>image,now:"2026-09-06",wait:async()=>{}})).state,"DRY_RUN_PASS");
  assert.equal(api.mutations.length,0);
  assert.deepEqual(api.writes.map(w=>w.method),["PATCH","DELETE"]);
  assert.equal(api.writes[0].body.state,"closed");
});
test("GitHub error bodies and credentials are never surfaced",async()=>{
  const api=new a.GitHub("PRIVATE_TOKEN","READ_TOKEN",async()=>({ok:false,status:403,json:()=>({message:"PRIVATE_SHARE_URL"})}));
  await assert.rejects(api.read("pulls"),e=>e.message==="GITHUB_403");
});
// A second deterministic, valid image; never contacts a live dashboard.
function oldImage(){
  const {deflateSync}=require("node:zlib");
  function chunk(type,bytes){const out=Buffer.alloc(bytes.length+12);out.writeUInt32BE(bytes.length);out.write(type,4);bytes.copy(out,8);out.writeUInt32BE(c.crc32(out.subarray(4,-4)),out.length-4);return out;}
  const header=Buffer.alloc(13);header.writeUInt32BE(600);header.writeUInt32BE(250,4);header[8]=8;header[9]=2;
  return Buffer.concat([image.subarray(0,8),chunk("IHDR",header),chunk("IDAT",deflateSync(Buffer.alloc(1801*250))),chunk("IEND",Buffer.alloc(0))]);
}
function lifecycle({existing=false,closed=[],drift=false}={}){
  const api=fixture({dryRun:true}),read=api.read,pages=api.pages,write=api.write;
  let mainReads=0,published=false;
  api.read=async path=>{
    if(path==="git/ref/heads/main")return {object:{sha:drift&&++mainReads>1?SOURCE:BASE}};
    if(path.startsWith("git/commits/"))return {tree:{sha:BASE}};
    return read(path);
  };
  api.pages=async path=>{
    if(path.startsWith("pulls?state=open"))return existing?[api.record]:[];
    if(path.startsWith("pulls?state=closed"))return closed;
    return pages(path);
  };
  api.blob=async(sha,path)=>path==="README.md"?Buffer.from(sha===BASE?before:after):sha===BASE||(!published&&existing&&sha===SHA)?oldImage():image;
  api.write=async(method,path,body)=>{
    await write(method,path,body);
    if(path==="git/commits"){published=true;return {sha:SHA};}
    if(path==="pulls")return api.record;
    return {sha:SHA};
  };
  return api;
}
test("new cycle creates atomic three-file tree from fresh main, then dry-run closes without merge",async()=>{
  const api=lifecycle();
  const result=await a.runAutomation({env:{...env,UMAMI_DRY_RUN:"true"},api,capture:async()=>image,now:"2026-09-06",wait:async()=>{}});
  assert.equal(result.state,"DRY_RUN_PASS");
  const tree=api.writes.find(w=>w.path==="git/trees");assert.equal(tree.body.tree.length,3);assert.equal(tree.body.base_tree,BASE);
  assert.deepEqual(api.writes.find(w=>w.path==="git/commits").body.parents,[BASE]);
  assert.equal(api.writes.filter(w=>w.path==="pulls").length,1);assert.equal(api.mutations.length,0);
});
test("next-day update reuses single existing branch and PR, with no force push",async()=>{
  const api=lifecycle({existing:true});
  await a.runAutomation({env:{...env,UMAMI_DRY_RUN:"true"},api,capture:async()=>image,now:"2026-09-07",wait:async()=>{}});
  assert.equal(api.writes.filter(w=>w.path==="pulls"||w.path==="git/refs").length,0);
  const update=api.writes.find(w=>w.method==="PATCH"&&w.path.startsWith("git/refs/"));assert.equal(update.body.force,false);
  assert.equal(update.path,`git/refs/heads/${api.record.head.ref}`);
});
test("fresh main drift before a new branch safely stops before remote writes",async()=>{
  const api=lifecycle({drift:true});await assert.rejects(a.runAutomation({env:{...env,UMAMI_DRY_RUN:"true"},api,capture:async()=>image,now:"2026-09-06"}));assert.equal(api.writes.length,0);
});
test("human-closed production snapshot with identical pixels is not recreated",async()=>{
  const old={...pr(),state:"closed",merged_at:null};const api=lifecycle({closed:[old]});
  assert.equal((await a.runAutomation({env,api,capture:async()=>image,now:"2026-09-07"})).state,"REJECTED_SNAPSHOT_UNCHANGED");assert.equal(api.writes.length,0);
});
test("closed same-date dry-run is not reopened or duplicated",async()=>{
  const old={...pr(true),state:"closed",merged_at:null};const api=lifecycle({closed:[old]});
  assert.equal((await a.runAutomation({env:{...env,UMAMI_DRY_RUN:"true"},api,capture:async()=>image,now:"2026-09-06"})).state,"CYCLE_ALREADY_CLOSED");assert.equal(api.writes.length,0);
});
test("CI failure after enrollment disables auto-merge and preserves open PR",async()=>{
  const api=fixture({checkRuns:runs("in_progress",null)}),read=api.read;
  await assert.rejects(a.finishPR(api,41,SHA,false,async()=>{api.read=async p=>p.includes("check-runs")?{total_count:2,check_runs:runs("completed","failure")}:read(p);}),/REQUIRED_CHECK_FAILED/);
  assert.deepEqual(api.mutations.map(m=>m.name),["enablePullRequestAutoMerge","disablePullRequestAutoMerge"]);assert.equal(api.record.state,"open");assert.equal(api.writes.length,0);
});
test("bounded blob fallback supports images above Contents API inline threshold",async()=>{
  const bytes=Buffer.alloc(1024*1024+1),api=new a.GitHub("x","y");
  api.read=async path=>path.startsWith("contents/")?{type:"file",size:bytes.length,encoding:"none",sha:SHA}:{size:bytes.length,encoding:"base64",content:bytes.toString("base64")};
  assert.deepEqual(await api.blob(SHA,c.IMAGE),bytes);
});
test("workflow confines write token and triggers, locks Node/Playwright, serializes writers",()=>{
  const y=fs.readFileSync(".github/workflows/umami-readme-screenshot.yml","utf8"),s=fs.readFileSync("tools/scripts/umami-snapshot-automation.js","utf8");
  assert.doesNotMatch(y,/git push|contents: write\n\njobs|pull_request_target:/);assert.match(y,/cancel-in-progress: false/);assert.match(y,/group: umami-snapshot-writer/);
  assert.match(y,/repositories: Jam_Tracks_Hub/);assert.match(y,/UMAMI_SNAPSHOT_APP_PRIVATE_KEY/);assert.match(y,/persist-credentials: false/);assert.match(y,/node-version: 22\.23\.2/);assert.match(y,/npm ci/);assert.doesNotMatch(y,/npm install --no-save/);
  assert.doesNotMatch(s,/mergePullRequest\b|\/merge["'`]|force:\s*true|admin:\s*true/);
  assert.equal(require("../package.json").devDependencies.playwright,"1.63.0");
});
