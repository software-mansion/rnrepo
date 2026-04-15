-- Migration: Add pending value to failed_reason_type enum
-- Created: 2026-04-15
-- Description: Adds 'pending' enum value (must be committed before it can be used as default)

ALTER TYPE failed_reason_type ADD VALUE IF NOT EXISTS 'pending';
