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
import { fetchPdfImageDataUri } from "@/lib/images/pdf-image";
import type { JoiningFormData } from "@/lib/members/joining-form-data";

const C = {
  ink: "#1f2937",
  muted: "#6b7280",
  faint: "#9ca3af",
  line: "#e5e7eb",
  rule: "#d1d5db",
};

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: "Helvetica", color: C.ink, lineHeight: 1.4 },

  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  brand: { flexDirection: "row", alignItems: "center", flex: 1, paddingRight: 12 },
  logo: { width: 64, height: 64, borderRadius: 8, objectFit: "cover", marginRight: 14 },
  gymName: { fontSize: 24, fontFamily: "Helvetica-Bold" },
  gymAddress: { fontSize: 12, color: C.muted, marginTop: 4, maxWidth: 320 },
  photo: { width: 84, height: 100, borderRadius: 6, objectFit: "cover", borderWidth: 1, borderColor: C.line },

  divider: { borderBottomWidth: 1, borderBottomColor: C.rule, marginTop: 16, marginBottom: 16 },
  title: { fontSize: 16, fontFamily: "Helvetica-Bold", textAlign: "center", marginBottom: 20 },

  section: { marginBottom: 20 },
  sectionHeading: { fontSize: 9, color: C.muted, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 },

  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: "50%", marginBottom: 8, paddingRight: 12 },
  cellLabel: { fontSize: 8, color: C.muted, textTransform: "uppercase", letterSpacing: 0.5 },
  cellValue: { fontSize: 11, marginTop: 1 },

  ruleRow: { flexDirection: "row", marginBottom: 5 },
  ruleNum: { width: 18, color: C.muted },
  ruleText: { flex: 1 },

  footer: { marginTop: "auto", borderTopWidth: 0.5, borderTopColor: C.line, paddingTop: 12, textAlign: "center", fontSize: 9, color: C.muted },
});

function Cell({ label, value }: { label: string; value: string | null }) {
  return (
    <View style={styles.cell}>
      <Text style={styles.cellLabel}>{label}</Text>
      <Text style={styles.cellValue}>{value ?? "—"}</Text>
    </View>
  );
}

function JoiningFormDocument({
  data,
  logo,
  photo,
}: {
  data: JoiningFormData;
  logo: string | null;
  photo: string | null;
}) {
  const { member, membership } = data;
  return (
    <Document title={`Joining Form — ${member.fullName}`} author={data.gymName}>
      <Page size="A4" style={styles.page}>
        {/* Gym header */}
        <View style={styles.header}>
          <View style={styles.brand}>
            {logo ? <Image src={logo} style={styles.logo} /> : null}
            <View>
              <Text style={styles.gymName}>{data.gymName}</Text>
              {data.gymAddress ? <Text style={styles.gymAddress}>{data.gymAddress}</Text> : null}
            </View>
          </View>
          {photo ? <Image src={photo} style={styles.photo} /> : null}
        </View>

        <View style={styles.divider} />
        <Text style={styles.title}>Membership Joining Form</Text>

        {/* Member details */}
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>Member Details</Text>
          <View style={styles.grid}>
            <Cell label="Name" value={member.fullName} />
            <Cell label="Membership No." value={member.serial} />
            <Cell label="Gender" value={member.gender} />
            <Cell label="Date of Birth" value={member.dateOfBirth} />
            <Cell label="Phone" value={member.phone} />
            <Cell label="Email" value={member.email} />
            <Cell label="Address" value={member.address} />
            <Cell label="Joined" value={member.joinedAt} />
            <Cell label="Height" value={member.height} />
            <Cell label="Weight" value={member.weight} />
          </View>
        </View>

        {/* Membership details */}
        {membership ? (
          <View style={styles.section}>
            <Text style={styles.sectionHeading}>Membership Details</Text>
            <View style={styles.grid}>
              <Cell label="Plan" value={membership.planName} />
              <Cell label="Status" value={membership.status} />
              <Cell label="Start Date" value={membership.startDate} />
              <Cell label="End Date" value={membership.endDate} />
            </View>
          </View>
        ) : null}

        {/* Gym rules */}
        {data.rules.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionHeading}>Gym Rules</Text>
            {data.rules.map((rule, i) => (
              <View key={i} style={styles.ruleRow}>
                <Text style={styles.ruleNum}>{i + 1}.</Text>
                <Text style={styles.ruleText}>{rule}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <Text style={styles.footer}>
          This is a system-generated joining form · {data.gymName}
        </Text>
      </Page>
    </Document>
  );
}

/** Render a member's joining form to a PDF Buffer. */
export async function renderJoiningFormPdf(data: JoiningFormData): Promise<Buffer> {
  const [logo, photo] = await Promise.all([
    fetchPdfImageDataUri(data.logoUrl),
    fetchPdfImageDataUri(data.member.photoUrl),
  ]);
  return renderToBuffer(<JoiningFormDocument data={data} logo={logo} photo={photo} />);
}
