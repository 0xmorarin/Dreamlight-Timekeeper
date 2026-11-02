// Build-time, not user-selectable: a reviewable text-only RC candidate.
// This is not a product READ/Cursor attestation or a public release grant.
// The same flag is checked by Worker before any edited-copy preparation.
export const READONLY_TEXT_RC_BUILD=import.meta.env?.VITE_WEB_READONLY_RC==='1';
