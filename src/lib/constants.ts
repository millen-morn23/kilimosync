/**
 * Flat delivery fee used until real logistics/transporter pricing exists
 * (Phase 5/6 — see docs/ROADMAP.md). Not stored in the database because
 * it isn't a platform policy the admin configures yet, unlike
 * platform_fee_percent.
 */
export const FLAT_DELIVERY_FEE_KES = 150;
