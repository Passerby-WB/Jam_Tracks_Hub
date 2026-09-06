"use strict";

const MISSING_SECRET_FAILURE = "UMAMI_SHARE_CREDENTIAL_UNAVAILABLE";

class ShareCredentialError extends Error {
  constructor() {
    super(MISSING_SECRET_FAILURE);
    this.name = "ShareCredentialError";
  }
}

function requireShareCredential(value) {
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value) {
    throw new ShareCredentialError();
  }
  return value;
}

// GitHub workflow commands decode these three sequences before registering the
// mask. Escaping prevents a credential from creating a second command or
// truncating the mask if its format ever changes.
function escapeWorkflowCommandData(value) {
  return value.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
}

function registerShareMask(value, write = chunk => process.stdout.write(chunk)) {
  const credential = requireShareCredential(value);
  write(`::add-mask::${escapeWorkflowCommandData(credential)}\n`);
}

function safeShareCredentialFailure(error) {
  return error instanceof ShareCredentialError ? MISSING_SECRET_FAILURE : "VALIDATION_FAILURE";
}

function main({ env = process.env, stdout = process.stdout, stderr = process.stderr } = {}) {
  try {
    registerShareMask(env.UMAMI_SHARE_URL, chunk => stdout.write(chunk));
    return 0;
  } catch (error) {
    stderr.write(`${safeShareCredentialFailure(error)}\n`);
    return 1;
  }
}

if (require.main === module) process.exitCode = main();

module.exports = {
  MISSING_SECRET_FAILURE,
  ShareCredentialError,
  requireShareCredential,
  escapeWorkflowCommandData,
  registerShareMask,
  safeShareCredentialFailure,
  main
};
