-- Block the IP indicators published in FBI FLASH-20261113-001 (ARTEX
-- autonomous intrusion framework), 13 Nov 2026. The FBI notes these are
-- historically observed infrastructure that can be reassigned, so each block
-- expires after 90 days rather than permanently. BlockedIP feeds the proxy's
-- in-memory blocklist on its next sync.
INSERT INTO "BlockedIP" ("id", "ipAddress", "reason", "violationCount", "blockedAt", "expiresAt", "createdAt", "updatedAt")
SELECT
  'ioc_' || md5(ip),
  ip,
  'Threat intel: FBI FLASH-20261113-001 (ARTEX) ' || ctx,
  1,
  now(),
  now() + interval '90 days',
  now(),
  now()
FROM (VALUES
  ('38.244.50.120',   'ARTEX host and open directory (South Korea financial campaign)'),
  ('144.172.64.60',   'ConnectWise campaign; sign-ins and Graph API activity'),
  ('144.172.64.99',   'ConnectWise campaign; sign-ins and Graph API activity'),
  ('144.172.64.128',  'ConnectWise campaign; sign-ins and Graph API activity'),
  ('187.15.88.186',   'Graph API access via compromised apps (transient VPN IP)'),
  ('187.15.90.217',   'Graph API access via compromised apps (transient VPN IP)'),
  ('187.15.89.186',   'Graph API access via compromised apps (transient VPN IP)'),
  ('101.53.80.20',    'Proxy IP (South Korea financial campaign)'),
  ('205.214.59.31',   'Proxy IP (South Korea financial campaign)'),
  ('124.155.252.63',  'Proxy IP (South Korea financial campaign)'),
  ('154.201.79.246',  'Proxy IP (South Korea financial campaign)'),
  ('23.248.249.90',   'Proxy IP (South Korea financial campaign)'),
  ('23.158.220.98',   'Proxy IP (South Korea financial campaign)'),
  ('103.248.148.84',  'Proxy IP (South Korea financial campaign)'),
  ('203.160.133.172', 'Proxy IP (South Korea financial campaign)'),
  ('209.209.85.38',   'Proxy IP (South Korea financial campaign)'),
  ('199.19.95.66',    'WISP C2 node (Storm-3358 campaign)'),
  ('199.19.95.67',    'WISP C2 node (Storm-3358 campaign)'),
  ('199.19.95.68',    'WISP C2 node (Storm-3358 campaign)'),
  ('91.92.240.238',   'ARTEX server (Storm-3358 campaign)'),
  ('85.11.168.45',    'ARTEX server (Storm-3358 campaign)'),
  ('178.16.54.129',   'ARTEX server (Storm-3358 campaign)'),
  ('31.77.229.35',    'ARTEX server (Storm-3358 campaign)'),
  ('85.11.167.52',    'C2 server (Storm-3358 campaign)')
) AS iocs(ip, ctx)
ON CONFLICT ("ipAddress") DO UPDATE
  SET "expiresAt" = GREATEST("BlockedIP"."expiresAt", EXCLUDED."expiresAt"),
      "reason" = EXCLUDED."reason",
      "updatedAt" = now();
