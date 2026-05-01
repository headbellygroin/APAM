/*
  # Update spawn log to support 'evolve' action

  The Master AI spawn log now tracks three types of actions:
  - 'spawn' - creating a new hybrid account
  - 'retire' - stopping an underperforming account
  - 'evolve' - codifying a drift pattern into a named ruleset

  This migration updates the check constraint to allow 'evolve'.
*/

ALTER TABLE master_ai_spawn_log DROP CONSTRAINT IF EXISTS master_ai_spawn_log_action_check;

ALTER TABLE master_ai_spawn_log ADD CONSTRAINT master_ai_spawn_log_action_check
  CHECK (action IN ('spawn', 'retire', 'absorb', 'evolve'));
