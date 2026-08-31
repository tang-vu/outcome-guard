/* eslint-disable @typescript-eslint/no-require-imports */
/* global require, __dirname, process, module */
const path = require("node:path");

const root = __dirname;
const webRoot = path.join(root, "apps", "web");
const localAppData = process.env.LOCALAPPDATA;

if (!localAppData) throw new Error("LOCALAPPDATA is required for machine-local services.");

const cloudflared = process.env.OUTCOMEGUARD_CLOUDFLARED_BIN
  ?? "C:\\Program Files (x86)\\cloudflared\\cloudflared.exe";
const tunnelConfig = process.env.OUTCOMEGUARD_CLOUDFLARED_CONFIG
  ?? path.join(localAppData, "OutcomeGuard", "cloudflared", "config.yml");
const executionInbox = path.join(localAppData, "OutcomeGuard", "execution-inbox");
const executionStatuses = path.join(localAppData, "OutcomeGuard", "execution-status");

const sharedEnvironment = {
  NODE_ENV: "production",
  NETWORK: "testnet",
  CHAIN_ID: "50312",
  RPC_URL: "https://api.infra.testnet.somnia.network",
  WS_RPC_URL: "wss://api.infra.testnet.somnia.network/ws",
  INDEXER_URL: "https://dev.smk.somnia.host/v1/graphql",
  VENUE_ID: "0x679795a0195a1b76cdebb7c51d74e058aee92919b8c3389af86ef24535e8a28c",
  DRY_RUN: "true",
  FIXTURE_MODE: "true",
  NEXT_PUBLIC_CHAIN_ID: "50312",
  NEXT_PUBLIC_RPC_URL: "https://api.infra.testnet.somnia.network",
  NEXT_PUBLIC_FIXTURE_MODE: "true",
  NEXT_PUBLIC_SITE_URL: "https://outcomeguard.tangvu.dev",
  AGENT_SIGNER_ADDRESS: "0x1A3b41966bd8fFf0637685D5398762778FdeFfc2",
  AUTO_EXECUTION_ENABLED: process.env.OUTCOMEGUARD_AUTO_EXECUTION_ENABLED ?? "false",
  AUTHORIZED_HUMAN_SIGNER: process.env.OUTCOMEGUARD_AUTHORIZED_HUMAN_SIGNER ?? "",
  EXECUTION_INBOX_DIR: executionInbox,
  EXECUTION_STATUS_DIR: executionStatuses
};

module.exports = {
  apps: [
    {
      name: "outcome-guard-web",
      namespace: "outcomeguard",
      cwd: webRoot,
      script: path.join(webRoot, "node_modules", "next", "dist", "bin", "next"),
      args: ["start", "--hostname", "127.0.0.1", "--port", "3217"],
      interpreter: process.execPath,
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      min_uptime: "10s",
      max_restarts: 20,
      restart_delay: 2_000,
      exp_backoff_restart_delay: 100,
      max_memory_restart: "768M",
      kill_timeout: 15_000,
      listen_timeout: 15_000,
      time: true,
      env: sharedEnvironment
    },
    {
      name: "outcome-guard-executor-watch",
      namespace: "outcomeguard",
      cwd: root,
      script: path.join(root, "scripts", "watch-signed-bundles.mjs"),
      args: [executionInbox, executionStatuses],
      interpreter: process.execPath,
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      min_uptime: "10s",
      max_restarts: 20,
      restart_delay: 2_000,
      max_memory_restart: "256M",
      kill_timeout: 15_000,
      time: true
    },
    {
      name: "outcome-guard-tunnel",
      namespace: "outcomeguard",
      cwd: root,
      script: cloudflared,
      args: ["tunnel", "--config", tunnelConfig, "run"],
      interpreter: "none",
      instances: 1,
      autorestart: true,
      min_uptime: "10s",
      max_restarts: 50,
      restart_delay: 2_000,
      exp_backoff_restart_delay: 100,
      max_memory_restart: "256M",
      kill_timeout: 15_000,
      time: true
    }
  ]
};
