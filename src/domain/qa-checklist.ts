/**
 * Persisted QA checklist (client-safe module: no Node imports). Every item must be explicitly confirmed
 * (true) for an approval; mirrored by public.qa_required_checklist_items() and enforced by the database.
 */
export const QA_CHECKLIST_ITEMS = [
  { key: 'scope_matches_purchased_items', label: 'Delivered scope matches the purchased items only' },
  { key: 'delegated_access_via_official_partner_flow', label: 'Access was granted via the official partner/delegation flow' },
  { key: 'no_customer_credentials_collected', label: 'No customer passwords or credentials were collected or stored' },
  { key: 'deliverable_file_opened_and_verified', label: 'The deliverable file was opened and its contents verified' },
  { key: 'customer_facing_notes_accurate', label: 'Customer-facing notes contain no unsupported claims' },
] as const;
export type QaChecklistKey = (typeof QA_CHECKLIST_ITEMS)[number]['key'];
