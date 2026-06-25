/** Compact, sortable-ish invoice number. Per-gym sequences can come later. */
export function generateInvoiceNumber(): string {
  return `INV-${Date.now().toString(36).toUpperCase()}`;
}
