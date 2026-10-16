'use strict';

const { Router } = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const router = Router();

/**
 * Validates the GitHub Webhook HMAC SHA-256 signature or secret token.
 */
function verifySignature(req, secret) {
  if (!secret) return false;

  // 1. Direct header token match (optional convenience)
  const directToken = req.headers['x-webhook-secret'] || req.query.token;
  if (directToken && directToken === secret) {
    return true;
  }

  // 2. Official GitHub X-Hub-Signature-256 HMAC verification
  const sigHeader = req.headers['x-hub-signature-256'];
  if (!sigHeader || !sigHeader.startsWith('sha256=')) {
    return false;
  }

  const payload = req.rawBody || JSON.stringify(req.body || {});
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const expectedSig = `sha256=${hmac.digest('hex')}`;

  const sigBuffer = Buffer.from(sigHeader);
  const expectedBuffer = Buffer.from(expectedSig);

  if (sigBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(sigBuffer, expectedBuffer);
}

/**
 * POST /api/deploy/webhook
 * Receives GitHub push webhook events and triggers deploy.sh in the background.
 */
router.post('/webhook', (req, res) => {
  const secret = process.env.DEPLOY_WEBHOOK_SECRET;

  if (!secret) {
    console.error('[DEPLOY] Webhook received but DEPLOY_WEBHOOK_SECRET is not configured.');
    return res.status(500).json({
      success: false,
      message: 'DEPLOY_WEBHOOK_SECRET is not configured on server.',
    });
  }

  if (!verifySignature(req, secret)) {
    console.warn('[DEPLOY] Webhook rejected: Invalid signature or secret.');
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Invalid signature.',
    });
  }

  // Handle GitHub Ping
  const githubEvent = req.headers['x-github-event'];
  if (githubEvent === 'ping') {
    return res.status(200).json({ success: true, message: 'pong' });
  }

  // Only trigger on pushes to main branch
  const ref = req.body && req.body.ref;
  if (ref && ref !== 'refs/heads/main') {
    return res.status(200).json({
      success: true,
      message: `Ignored push to branch ${ref}. Only main branch triggers automatic deployment.`,
    });
  }

  // Locate deploy.sh
  const vpsStandardPath = '/home/d3l1v3ry/htdocs/clothtrack/deploy.sh';
  const localRelativePath = path.resolve(__dirname, '../../../../deploy.sh');
  const deployScript = fs.existsSync(vpsStandardPath) ? vpsStandardPath : localRelativePath;

  if (!fs.existsSync(deployScript)) {
    console.error(`[DEPLOY] deploy.sh not found at ${deployScript}`);
    return res.status(500).json({
      success: false,
      message: `deploy.sh script not found at ${deployScript}`,
    });
  }

  console.log(`[DEPLOY] Triggering deploy script: ${deployScript}`);

  // Spawn detached process with nohup so PM2 reload cannot kill it
  const child = spawn('nohup', ['/bin/bash', deployScript], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();

  return res.status(200).json({
    success: true,
    message: 'ClothTrack deployment triggered successfully in background.',
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/deploy/status
 * Check deployment status and recent logs directly from a browser.
 */
router.get('/status', (_req, res) => {
  const vpsLogPath = '/home/d3l1v3ry/htdocs/clothtrack/deploy.log';
  const localLogPath = path.resolve(__dirname, '../../../../deploy.log');
  const logFile = fs.existsSync(vpsLogPath) ? vpsLogPath : localLogPath;

  if (!fs.existsSync(logFile)) {
    return res.json({
      success: true,
      status: 'No deployment logs recorded yet.',
      logs: [],
    });
  }

  try {
    const content = fs.readFileSync(logFile, 'utf8');
    const lines = content.trim().split('\n');
    const recent = lines.slice(-25);
    const isCompleted = recent.some((l) => l.includes('Deployment completed successfully'));
    const isStarted = recent.some((l) => l.includes('Deployment started'));

    return res.json({
      success: true,
      status: isCompleted ? 'idle_success' : (isStarted ? 'deploying' : 'unknown'),
      recentLogs: recent,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Failed to read deployment log: ' + err.message,
    });
  }
});

module.exports = router;
