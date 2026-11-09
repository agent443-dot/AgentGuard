-- Pins every agent's x402 domains from the payments it already made, so the first payment after
-- the upgrade is compared with the last one before it instead of setting a pin unchecked. The
-- latest executed payment per agent and domain wins; a tie on the same instant keeps one of them.
INSERT OR IGNORE INTO `x402_pins` (`agent_id`, `domain`, `chain`, `token`, `recipient`, `amount`, `updated_at`)
SELECT i.`agent_id`, i.`domain`, i.`chain`, i.`token`, i.`recipient`, i.`amount`, i.`created_at`
FROM `intents` i
WHERE i.`kind` = 'x402'
  AND i.`status` = 'executed'
  AND i.`domain` IS NOT NULL
  AND i.`created_at` = (
    SELECT max(j.`created_at`) FROM `intents` j
    WHERE j.`agent_id` = i.`agent_id`
      AND j.`domain` = i.`domain`
      AND j.`kind` = 'x402'
      AND j.`status` = 'executed'
  );
