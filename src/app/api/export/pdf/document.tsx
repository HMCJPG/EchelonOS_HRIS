import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { DirectoryRow } from "@/repo/employees";

const styles = StyleSheet.create({
  page: { padding: 28, fontSize: 8 },
  title: { fontSize: 14, marginBottom: 10 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#ccc", paddingVertical: 3 },
  header: { fontFamily: "Helvetica-Bold", borderBottomWidth: 1, borderBottomColor: "#333" },
  name: { width: "16%" },
  cellTitle: { width: "16%" },
  dept: { width: "12%" },
  email: { width: "20%" },
  manager: { width: "14%" },
  hire: { width: "8%" },
  status: { width: "7%" },
  salary: { width: "7%", textAlign: "right" },
});

export function DirectoryPdf({ rows, generatedAt }: { rows: DirectoryRow[]; generatedAt: string }) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>Employee Directory — {rows.length} employees ({generatedAt})</Text>
        <View style={[styles.row, styles.header]} fixed>
          <Text style={styles.name}>Name</Text>
          <Text style={styles.cellTitle}>Title</Text>
          <Text style={styles.dept}>Department</Text>
          <Text style={styles.email}>Email</Text>
          <Text style={styles.manager}>Manager</Text>
          <Text style={styles.hire}>Hired</Text>
          <Text style={styles.status}>Status</Text>
          <Text style={styles.salary}>Salary</Text>
        </View>
        {rows.map((r) => (
          <View key={r.id} style={styles.row} wrap={false}>
            <Text style={styles.name}>
              {r.firstName} {r.lastName}
            </Text>
            <Text style={styles.cellTitle}>{r.title ?? ""}</Text>
            <Text style={styles.dept}>{r.department ?? ""}</Text>
            <Text style={styles.email}>{r.email}</Text>
            <Text style={styles.manager}>{r.managerName ?? ""}</Text>
            <Text style={styles.hire}>{r.hireDate ?? ""}</Text>
            <Text style={styles.status}>{r.status}</Text>
            <Text style={styles.salary}>{r.salary != null ? `$${r.salary.toLocaleString()}` : ""}</Text>
          </View>
        ))}
      </Page>
    </Document>
  );
}
