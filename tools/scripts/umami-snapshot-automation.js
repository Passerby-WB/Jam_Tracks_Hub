"use strict";

// Executed from the workflow checkout, never from a machine PR's code.
const { buildSnapshot, decodePng, validateFiles, validateReadme, snapshotDate, validDate, IMAGE, PREFIX, requireValid, safeFailure } = require("./umami-snapshot-contract");
const { captureScreenshot } = require("./update-umami-readme-screenshot");
const { MISSING_SECRET_FAILURE, ShareCredentialError, requireShareCredential } = require("./umami-share-security");
const REPO = "Jasper-hsury/Jam_Tracks_Hub";
const APP = "jam-tracks-hub-umami-snapshot-bot";
const BOT = `${APP}[bot]`;
const BRANCH_PREFIX = "automation/umami-readme-snapshot-";
const WORKFLOW = ".github/workflows/umami-readme-screenshot.yml";
const FIX_REF = "refs/heads/fix/umami-readme-automerge-v1";
const CHECKS = [{ name: "static-checks", app: 15368 }, { name: "Workers Builds: jamtrackshub", app: 85455 }];
const TITLE = "chore: refresh Umami analytics snapshot";
const MARKER = "<!-- jth-umami-snapshot:v1 -->";
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function legacyBranch(branch) {
  return typeof branch === "string" && branch.startsWith(BRANCH_PREFIX) && validDate(branch.slice(BRANCH_PREFIX.length));
}
function cyclePrefix(dryRun) { return `${BRANCH_PREFIX}${dryRun ? "dry-run" : "production"}-`; }
function machineBranch(branch, dryRun=false) {
  const prefix=cyclePrefix(dryRun);
  return typeof branch === "string" && branch.startsWith(prefix) && validDate(branch.slice(prefix.length));
}
function modeRecords(prs, dryRun) {
  // Legacy closed PRs used a shared namespace. Their explicit mode is needed
  // only for historical cycle policy, never to reuse a legacy branch.
  return prs.filter(pr=>pr.head?.ref?.startsWith(cyclePrefix(dryRun)) ||
    (legacyBranch(pr.head?.ref) && pr.body?.startsWith(`${MARKER}\nMode: ${dryRun ? "dry-run" : "production"}\n`)));
}
function assertExecution(env) {
  requireValid(env.GITHUB_REPOSITORY === REPO && env.UMAMI_APP_SLUG === APP);
  requireValid(env.GITHUB_WORKFLOW_REF === `${REPO}/${WORKFLOW}@${env.GITHUB_REF}`);
  requireValid(["schedule", "workflow_dispatch"].includes(env.GITHUB_EVENT_NAME));
  requireValid(["true","false"].includes(env.UMAMI_DRY_RUN));
  requireValid(env.GITHUB_REF === "refs/heads/main" || (env.UMAMI_DRY_RUN === "true" && env.GITHUB_EVENT_NAME === "workflow_dispatch" && env.GITHUB_REF === FIX_REF));
  requireValid(/^\d+$/.test(env.GITHUB_RUN_ID) && /^[a-f0-9]{40}$/.test(env.GITHUB_SHA));
}
function identify(pr, {dryRun=false,allowLegacy=false}={}) {
  requireValid(pr.base?.ref === "main" && pr.base.repo?.full_name === REPO && pr.head.repo?.full_name === REPO);
  requireValid(pr.user?.login === BOT && pr.user?.type === "Bot" && (machineBranch(pr.head.ref,dryRun) || (allowLegacy && pr.state==="closed" && legacyBranch(pr.head.ref))));
  requireValid(pr.title === TITLE && !pr.draft && pr.body?.startsWith(`${MARKER}\nMode: ${dryRun ? "dry-run" : "production"}\n`));
  requireValid(pr.body.includes(`Workflow: ${WORKFLOW}\n`));
}
function selectOpen(prs, dryRun) {
  const matches = modeRecords(prs,dryRun).filter(pr => pr.state === "open");
  requireValid(matches.length <= 1);
  if (matches.length) identify(matches[0], {dryRun});
  return matches[0];
}
function requiredChecks(runs, sha) {
  const states = CHECKS.map(check => runs.filter(r => r.name === check.name && r.app?.id === check.app && r.head_sha === sha).sort((a,b)=>b.id-a.id)[0]);
  if (states.some(r=>r?.status === "completed" && r.conclusion !== "success")) return "FAIL";
  return states.every(r=>r?.status === "completed" && r.conclusion === "success") ? "PASS" : "PENDING";
}
function prBody(day, dryRun) {
  return `${MARKER}\nMode: ${dryRun ? "dry-run" : "production"}\nWorkflow: ${WORKFLOW}\nSnapshot date: ${day}\n\nAutomated Umami snapshot. Allowed: README.md inside Website Analytics markers, ${IMAGE}, and dated PNGs in ${PREFIX}. No runtime source or configuration change.\n\nRequired checks: static-checks and Workers Builds: jamtrackshub. ${dryRun ? "Dry run: auto-merge disabled; close without merging." : "Native automatic SQUASH merge is authorized only for this App's validated snapshot PR, with all main rules enforced and no bypass."}\n`;
}

class GitHub {
  constructor(token, readToken, fetcher=fetch) { this.token=token; this.readToken=readToken; this.fetcher=fetcher; }
  async request(method, endpoint, body, readOnly=false) {
    requireValid(endpoint.startsWith(`/repos/${REPO}/`) || endpoint === "/graphql");
    const response = await this.fetcher(`https://api.github.com${endpoint}`, {method, headers:{Accept:"application/vnd.github+json",Authorization:`Bearer ${readOnly ? this.readToken : this.token}`,"X-GitHub-Api-Version":"2022-11-28","Content-Type":"application/json"},...(body ? {body:JSON.stringify(body)} : {}),signal:AbortSignal.timeout(30000)});
    if (!response.ok) throw new Error(`GITHUB_${response.status}`);
    if (response.status === 204) return null;
    const value=await response.json();
    if (value.errors) throw new Error("GITHUB_GRAPHQL_FAILURE");
    return value;
  }
  read(path) { return this.request("GET",`/repos/${REPO}/${path}`,undefined,true); }
  write(method,path,body) { return this.request(method,`/repos/${REPO}/${path}`,body); }
  async pages(path) {
    const result=[];
    for(let page=1;page<=20;page++) {
      const rows=await this.read(`${path}${path.includes("?")?"&":"?"}per_page=100&page=${page}`);
      requireValid(Array.isArray(rows));result.push(...rows);
      if(rows.length<100)return result;
    }
    throw new Error("PAGINATION_BOUND");
  }
  async blob(sha, path) {
    requireValid(/^[a-f0-9]{40}$/.test(sha));
    const value=await this.read(`contents/${path}?ref=${sha}`);
    requireValid(value.type === "file" && value.size <= 2*1024*1024);
    const blob = value.encoding === "base64" ? value : await this.read(`git/blobs/${value.sha}`);
    requireValid(blob.encoding === "base64" && blob.size === value.size);
    const bytes = Buffer.from(blob.content,"base64");
    requireValid(bytes.length === value.size);
    return bytes;
  }
  async mutate(name, input) {
    requireValid(["enablePullRequestAutoMerge","disablePullRequestAutoMerge"].includes(name));
    const type=name[0].toUpperCase()+name.slice(1)+"Input";
    return this.request("POST","/graphql",{query:`mutation($input:${type}!) { ${name}(input:$input) { pullRequest { number autoMergeRequest { mergeMethod } } } }`,variables:{input}});
  }
}

async function validateRemotePR(api, pr, dryRun) {
  identify(pr,{dryRun});requireValid(pr.state === "open" && pr.mergeable === true);
  const comparison=await api.read(`compare/main...${pr.head.sha}`);
  requireValid(comparison.total_commits > 0 && comparison.total_commits <= 30);
  const base=comparison.merge_base_commit.sha;
  const files=await api.pages(`pulls/${pr.number}/files`);
  requireValid(files.length === pr.changed_files && files.length <= 34);
  const data=[];
  for(const f of files) {
    requireValid(["added","modified"].includes(f.status));
    requireValid(f.filename === "README.md" || f.filename === IMAGE || (f.filename.startsWith(PREFIX) && f.filename.endsWith(".png") && validDate(f.filename.slice(PREFIX.length,-4))));
    data.push({path:f.filename,status:f.status,bytes:await api.blob(pr.head.sha,f.filename)});
  }
  validateFiles(data);
  requireValid(data.some(f=>f.path===IMAGE) && data.some(f=>f.path==="README.md"));
  validateReadme((await api.blob(base,"README.md")).toString(),data.find(f=>f.path==="README.md").bytes.toString());
  const tree=await api.read(`git/trees/${pr.head.sha}?recursive=1`);requireValid(!tree.truncated);
  for(const f of data) requireValid(tree.tree.some(t=>t.path===f.path && t.mode==="100644" && t.type==="blob"));
  const commits=await api.pages(`pulls/${pr.number}/commits`);
  requireValid(commits.length===comparison.total_commits);
  for(const commit of commits) {
    // GitHub signs API-created App commits as web-flow while preserving the
    // authenticated App author; it also strips the final message newline.
    requireValid(commit.author?.login===BOT && [BOT,"web-flow"].includes(commit.committer?.login) && commit.commit.verification?.verified===true);
    const provenance=commit.commit.message.match(/\nUmami-Run: (\d+)\nUmami-Source: ([a-f0-9]{40})\nUmami-Mode: (production|dry-run)(?:\n|$)/);
    requireValid(provenance && provenance[3]===(dryRun?"dry-run":"production"));
    const run=await api.read(`actions/runs/${provenance[1]}`);
    requireValid(run.path===WORKFLOW && run.head_sha===provenance[2] && run.head_repository?.full_name===REPO);
    requireValid(["schedule","workflow_dispatch"].includes(run.event));
    requireValid(run.head_branch==="main" || (dryRun && run.event==="workflow_dispatch" && run.head_branch===FIX_REF.replace("refs/heads/","")));
  }
  return data;
}
async function getPR(api, number, wait=sleep) {
  for(let i=0;i<12;i++) {
    const pr=await api.read(`pulls/${number}`);
    if(pr.mergeable !== null || pr.state !== "open")return pr;
    await wait(5000);
  }
  throw new Error("MERGEABILITY_UNKNOWN");
}
async function cleanup(api, pr, expectedSha, dryRun=false) {
  identify(pr,{dryRun});
  requireValid(pr.head.sha===expectedSha && pr.state==="closed" && (dryRun ? !pr.merged : pr.merged===true));
  const ref=await api.read(`git/ref/heads/${pr.head.ref}`);
  requireValid(ref.object.sha===expectedSha && machineBranch(pr.head.ref,dryRun));
  await api.write("DELETE",`git/refs/heads/${pr.head.ref}`);
}
async function finishPR(api, number, sha, dryRun, wait=sleep) {
  let pr=await getPR(api,number,wait);
  requireValid(pr.head.sha===sha);
  await validateRemotePR(api,pr,dryRun);
  let checks=await api.read(`commits/${sha}/check-runs?per_page=100`);
  requireValid(checks.total_count<=100);
  if(requiredChecks(checks.check_runs,sha)==="FAIL")throw new Error("REQUIRED_CHECK_FAILED");
  if(!dryRun) {
    // Enroll only this verified SHA. GitHub waits for both required checks and
    // all main rules. Never fall back to a direct or administrator merge.
    await api.mutate("enablePullRequestAutoMerge",{pullRequestId:pr.node_id,expectedHeadOid:sha,mergeMethod:"SQUASH",commitHeadline:TITLE,commitBody:"Validated daily Umami snapshot; required main checks and rules enforced."});
  }
  for(let i=0;i<120;i++) {
    await wait(20000);
    pr=await api.read(`pulls/${number}`);
    requireValid(pr.head.sha===sha);
    if(pr.merged) {
      requireValid(!dryRun);
      checks=await api.read(`commits/${sha}/check-runs?per_page=100`);
      requireValid(checks.total_count<=100 && requiredChecks(checks.check_runs,sha)==="PASS");
      await cleanup(api,pr,sha,false);
      return "MERGED";
    }
    requireValid(pr.state==="open");
    checks=await api.read(`commits/${sha}/check-runs?per_page=100`);
    requireValid(checks.total_count<=100);
    const state=requiredChecks(checks.check_runs,sha);
    if(state==="FAIL") {
      if(pr.auto_merge)await api.mutate("disablePullRequestAutoMerge",{pullRequestId:pr.node_id});
      throw new Error("REQUIRED_CHECK_FAILED");
    }
    if(dryRun && state==="PASS") {
      await validateRemotePR(api,await getPR(api,number,wait),true);
      requireValid(!pr.auto_merge);
      await api.write("PATCH",`pulls/${number}`,{state:"closed"});
      await cleanup(api,await api.read(`pulls/${number}`),sha,true);
      return "DRY_RUN_PASS";
    }
  }
  throw new Error("CHECK_WAIT_TIMEOUT");
}
async function runAutomation({env=process.env, api, capture=captureScreenshot, wait=sleep, now=new Date().toISOString(), report=console.log}={}) {
  const shareUrl=requireShareCredential(env.UMAMI_SHARE_URL);
  assertExecution(env);
  api ||= new GitHub(env.UMAMI_APP_TOKEN,env.UMAMI_READ_TOKEN);
  const dryRun=env.UMAMI_DRY_RUN==="true", day=snapshotDate(now);
  const main=await api.read("git/ref/heads/main");
  const prs=await api.pages("pulls?state=open&base=main");
  let pr=selectOpen(prs,dryRun);
  if(pr) {
    pr=await getPR(api,pr.number,wait);
    await validateRemotePR(api,pr,dryRun);
    if(pr.auto_merge) await api.mutate("disablePullRequestAutoMerge",{pullRequestId:pr.node_id});
  }
  const base=pr ? pr.head.sha : main.object.sha;
  const image=await capture(shareUrl);
  const snapshot=buildSnapshot({readme:(await api.blob(base,"README.md")).toString(),previousImage:await api.blob(base,IMAGE),image,now});
  if(snapshot.state==="UNCHANGED") {
    // A dry-run retry may finish checks/cleanup of its existing test PR without
    // producing any content change. Production no-diff never enrolls or merges.
    if(dryRun && pr)return {state:await finishPR(api,pr.number,base,true,wait),pr:pr.number};
    return {state:"UNCHANGED"};
  }
  const closed=modeRecords(await api.pages("pulls?state=closed&base=main&sort=updated&direction=desc"),dryRun);
  for(const old of closed) {
    identify(old,{dryRun,allowLegacy:true});
    if(old.merged_at) {
      requireValid(!dryRun);
      if(legacyBranch(old.head.ref))continue;
      try { await cleanup(api,{...old,merged:true},old.head.sha,false); }
      catch(error) { if(error.message!=="GITHUB_404")throw error; }
    } else if(!dryRun && decodePng(await api.blob(old.head.sha,IMAGE)).digest===decodePng(image).digest) {
      return {state:"REJECTED_SNAPSHOT_UNCHANGED"};
    }
  }
  const branch=pr?.head.ref || `${cyclePrefix(dryRun)}${day}`;
  if(!pr && closed.some(p=>p.head.ref.endsWith(day)))return {state:"CYCLE_ALREADY_CLOSED"};
  const freshMain=await api.read("git/ref/heads/main");
  if(!pr)requireValid(freshMain.object.sha===main.object.sha);
  if(pr) {
    const fresh=await getPR(api,pr.number,wait);
    requireValid(fresh.state==="open" && fresh.mergeable===true && fresh.head.sha===base);
  }
  const treeEntries=[];
  for(const f of snapshot.files) {
    const blob=await api.write("POST","git/blobs",{content:f.bytes.toString("base64"),encoding:"base64"});
    treeEntries.push({path:f.path,mode:"100644",type:"blob",sha:blob.sha});
  }
  const parent=await api.read(`git/commits/${base}`);
  const tree=await api.write("POST","git/trees",{base_tree:parent.tree.sha,tree:treeEntries});
  // Let GitHub attribute and sign the commit as the authenticated App.
  const commit=await api.write("POST","git/commits",{message:`${TITLE}\n\nUmami-Run: ${env.GITHUB_RUN_ID}\nUmami-Source: ${env.GITHUB_SHA}\nUmami-Mode: ${dryRun?"dry-run":"production"}\n`,tree:tree.sha,parents:[base]});
  requireValid(machineBranch(branch,dryRun));
  if(pr)await api.write("PATCH",`git/refs/heads/${branch}`,{sha:commit.sha,force:false});
  else await api.write("POST","git/refs",{ref:`refs/heads/${branch}`,sha:commit.sha});
  if(pr) await api.write("PATCH",`pulls/${pr.number}`,{title:TITLE,body:prBody(day,dryRun)});
  else pr=await api.write("POST","pulls",{title:TITLE,head:branch,base:"main",body:prBody(day,dryRun),maintainer_can_modify:false});
  report(`SNAPSHOT_PR=${pr.number}`);
  return {state:await finishPR(api,pr.number,commit.sha,dryRun,wait),pr:pr.number};
}
function safeAutomationFailure(error) {
  if(error instanceof ShareCredentialError)return MISSING_SECRET_FAILURE;
  const allowed=/^(GITHUB_\d{3}|GITHUB_GRAPHQL_FAILURE|REQUIRED_CHECK_FAILED|CHECK_WAIT_TIMEOUT|MERGEABILITY_UNKNOWN|PAGINATION_BOUND)$/;
  return allowed.test(error?.message)?error.message:safeFailure(error);
}
async function runCli({execute=runAutomation,log=console.log,error=console.error}={}) {
  try { const result=await execute();log(result.state);return 0; }
  catch(failure) { error(safeAutomationFailure(failure));return 1; }
}
if(require.main===module)runCli().then(code=>{process.exitCode=code;});
module.exports={REPO,APP,BOT,BRANCH_PREFIX,WORKFLOW,CHECKS,MARKER,cyclePrefix,machineBranch,assertExecution,identify,selectOpen,requiredChecks,prBody,GitHub,validateRemotePR,getPR,cleanup,finishPR,runAutomation,safeAutomationFailure,runCli};
