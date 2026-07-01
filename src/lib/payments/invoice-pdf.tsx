import "server-only";
import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { InvoiceData } from "@/lib/payments/invoice-data";
import { fetchPdfImageDataUri } from "@/lib/images/pdf-image";

// The built-in Helvetica PDF font has no ₹ (U+20B9) glyph, so it renders as tofu.
// Swap it for "Rs" in the PDF only — the screen and the WhatsApp/email text, which
// are real Unicode, keep the symbol.
function pdfMoney(formatted: string): string {
  return formatted.replace(/₹\s?/g, "Rs ");
}

const C = {
  ink: "#1f2937",
  muted: "#6b7280",
  faint: "#9ca3af",
  line: "#e5e7eb",
  rule: "#d1d5db",
};

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: "Helvetica", color: C.ink, lineHeight: 1.4 },

  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 },
  brand: { flexDirection: "row", alignItems: "center" },
  logo: { width: 44, height: 44, borderRadius: 6, objectFit: "cover", marginRight: 10 },
  gymName: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  receiptLabel: { fontSize: 9, color: C.muted, marginTop: 2 },

  meta: { alignItems: "flex-end" },
  metaLabel: { fontSize: 8, color: C.muted, textTransform: "uppercase", letterSpacing: 0.6 },
  invoiceNo: { fontSize: 11, fontFamily: "Courier", marginTop: 2 },
  metaDate: { fontSize: 9, color: C.muted, marginTop: 3 },

  sectionLabel: { fontSize: 8, color: C.muted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 4 },
  billName: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  billLine: { fontSize: 10, color: C.muted },
  section: { marginBottom: 24 },

  tHead: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: C.rule, paddingBottom: 6 },
  tHeadCol: { fontSize: 8, color: C.muted, textTransform: "uppercase", letterSpacing: 0.6 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: C.line, paddingVertical: 10 },
  descCol: { flex: 1, paddingRight: 12 },
  amtCol: { width: 120, textAlign: "right" },
  noteLine: { fontSize: 9, color: C.faint, marginTop: 3 },

  totalRow: { flexDirection: "row", marginTop: 12 },
  totalLabel: { flex: 1, textAlign: "right", paddingRight: 12, fontFamily: "Helvetica-Bold" },
  totalAmt: { width: 120, textAlign: "right", fontSize: 15, fontFamily: "Helvetica-Bold" },
  paidVia: { fontSize: 9, color: C.muted, marginTop: 10 },

  footer: { marginTop: "auto", borderTopWidth: 0.5, borderTopColor: C.line, paddingTop: 12, textAlign: "center", fontSize: 9, color: C.muted },
});

function InvoiceDocument({ data, logo }: { data: InvoiceData; logo: string | null }) {
  const amount = pdfMoney(data.amount);
  return (
    <Document title={`Invoice ${data.invoiceNumber}`} author={data.gymName}>
      <Page size="A4" style={styles.page}>
        {/* Header: branding + invoice meta */}
        <View style={styles.header}>
          <View style={styles.brand}>
            {logo ? <Image src={logo} style={styles.logo} /> : null}
            <View>
              <Text style={styles.gymName}>{data.gymName}</Text>
              <Text style={styles.receiptLabel}>Payment receipt · {data.purpose}</Text>
            </View>
          </View>
          <View style={styles.meta}>
            <Text style={styles.metaLabel}>Invoice</Text>
            <Text style={styles.invoiceNo}>{data.invoiceNumber}</Text>
            <Text style={styles.metaDate}>{data.date}</Text>
          </View>
        </View>

        {/* Bill to */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Bill to</Text>
          <Text style={styles.billName}>{data.memberName}</Text>
          {data.memberPhone ? <Text style={styles.billLine}>{data.memberPhone}</Text> : null}
          {data.memberEmail ? <Text style={styles.billLine}>{data.memberEmail}</Text> : null}
        </View>

        {/* Line items */}
        <View style={styles.tHead}>
          <Text style={[styles.tHeadCol, styles.descCol]}>Description</Text>
          <Text style={[styles.tHeadCol, styles.amtCol]}>Amount</Text>
        </View>
        <View style={styles.row}>
          <View style={styles.descCol}>
            <Text>{data.lineItem}</Text>
            {data.period ? <Text style={styles.noteLine}>{data.period}</Text> : null}
            {data.note ? <Text style={styles.noteLine}>{data.note}</Text> : null}
          </View>
          <Text style={styles.amtCol}>{amount}</Text>
        </View>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalAmt}>{amount}</Text>
        </View>
        <Text style={styles.paidVia}>Paid via {data.methodLabel}</Text>

        <Text style={styles.footer}>Thank you for being a member of {data.gymName}.</Text>
      </Page>
    </Document>
  );
}

/** Render an invoice to a PDF Buffer — reused by both the WhatsApp and email actions. */
export async function renderInvoicePdf(data: InvoiceData): Promise<Buffer> {
  const logo = await fetchPdfImageDataUri(data.logoUrl);
  return renderToBuffer(<InvoiceDocument data={data} logo={logo} />);
}
