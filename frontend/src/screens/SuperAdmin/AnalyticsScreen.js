import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Alert, ActivityIndicator, FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as SA from '../../api/superAdmin';
import { Colors } from '../../theme';

const PURPLE = '#6A1B9A';

function ReportRow({ row, index }) {
  return (
    <View style={[styles.reportRow, index % 2 === 0 && { backgroundColor: Colors.background }]}>
      <Text style={[styles.reportCell, { fontWeight: '700', flex: 2 }]} numberOfLines={1}>{row.organization}</Text>
      <Text style={styles.reportCell}>{row.city}</Text>
      <Text style={styles.reportCell}>{row.ambulances}</Text>
      <Text style={styles.reportCell}>{row.drivers}</Text>
      <Text style={styles.reportCell}>{row.totalBookings}</Text>
      <Text style={styles.reportCell}>{row.completedTrips}</Text>
      <Text style={styles.reportCell}>{row.cancelledTrips}</Text>
      <Text style={[styles.reportCell, { color: '#2E7D32', fontWeight: '700' }]}>₹{Math.round(row.revenue).toLocaleString()}</Text>
      <Text style={styles.reportCell}>{row.avgResponseTime}m</Text>
    </View>
  );
}

function SummaryCard({ summary }) {
  if (!summary) return null;
  return (
    <View style={styles.summaryBox}>
      <Text style={styles.sectionTitle}>Summary</Text>
      <View style={styles.summaryRow}>
        {[
          { label: 'Total Bookings',   value: summary.totalBookings },
          { label: 'Completed Trips',  value: summary.completedTrips },
          { label: 'Cancelled Trips',  value: summary.cancelledTrips },
          { label: 'Total Revenue',    value: `₹${Math.round(summary.revenue || 0).toLocaleString()}` },
        ].map(({ label, value }) => (
          <View key={label} style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{value ?? 0}</Text>
            <Text style={styles.summaryLabel}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function AnalyticsScreen() {
  const [filters, setFilters] = useState({ orgId: '', city: '', state: '', startDate: '', endDate: '', ambulanceType: '' });
  const [report,  setReport]  = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  const setF = (k) => (v) => setFilters((p) => ({ ...p, [k]: v }));

  const runReport = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => { if (v) q.set(k, v); });
      const res = await SA.getReports(q.toString() ? `?${q}` : '');
      if (res.success) {
        setReport(res.report);
        setSummary(res.summary);
      } else {
        Alert.alert('Error', res.message || 'Failed to generate report.');
      }
    } catch { Alert.alert('Error', 'Network error.'); }
    finally { setLoading(false); }
  };

  const filterFields = [
    { key: 'city',          label: 'City',           placeholder: 'Filter by city...' },
    { key: 'state',         label: 'State',          placeholder: 'Filter by state...' },
    { key: 'startDate',     label: 'Start Date',     placeholder: 'YYYY-MM-DD' },
    { key: 'endDate',       label: 'End Date',       placeholder: 'YYYY-MM-DD' },
    { key: 'ambulanceType', label: 'Ambulance Type', placeholder: 'basic/advanced/icu...' },
  ];

  const columns = ['Organization', 'City', 'Amb', 'Drivers', 'Bookings', 'Done', 'Cancel', 'Revenue', 'Resp.'];

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Analytics & Reports</Text>
      </View>

      <ScrollView>
        {/* Filters */}
        <View style={styles.filterBox}>
          <Text style={styles.sectionTitle}>Filters</Text>
          <View style={styles.filterGrid}>
            {filterFields.map(({ key, label, placeholder }) => (
              <View key={key} style={styles.filterField}>
                <Text style={styles.filterLabel}>{label}</Text>
                <TextInput
                  style={styles.filterInput}
                  placeholder={placeholder}
                  value={filters[key]}
                  onChangeText={setF(key)}
                />
              </View>
            ))}
          </View>
          <TouchableOpacity style={[styles.runBtn, loading && { opacity: 0.6 }]} onPress={runReport} disabled={loading}>
            {loading ? <ActivityIndicator color={Colors.white} /> : (
              <>
                <MaterialCommunityIcons name="chart-bar" size={20} color={Colors.white} />
                <Text style={styles.runBtnText}>Generate Report</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Export Note */}
        <View style={styles.exportBox}>
          <Text style={styles.exportTitle}>Export</Text>
          <View style={styles.exportBtns}>
            <TouchableOpacity style={styles.exportBtn} onPress={() => Alert.alert('PDF Export', 'PDF export requires a PDF generation library. Data is ready for export.')}>
              <MaterialCommunityIcons name="file-pdf-box" size={24} color="#D32F2F" />
              <Text style={styles.exportBtnText}>Export PDF</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.exportBtn} onPress={() => Alert.alert('Excel Export', 'Excel export requires xlsx library. Data is ready for export.')}>
              <MaterialCommunityIcons name="microsoft-excel" size={24} color="#1B5E20" />
              <Text style={styles.exportBtnText}>Export Excel</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Summary */}
        {summary && <SummaryCard summary={summary} />}

        {/* Report Table */}
        {report && (
          <View style={styles.tableBox}>
            <Text style={styles.sectionTitle}>Organization-wise Report ({report.length} organizations)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View>
                {/* Header */}
                <View style={[styles.reportRow, styles.reportHeader]}>
                  {columns.map((c) => (
                    <Text key={c} style={[styles.reportCell, styles.reportHeaderCell, c === 'Organization' && { flex: 2 }]}>{c}</Text>
                  ))}
                </View>
                {/* Rows */}
                {report.map((row, index) => <ReportRow key={index} row={row} index={index} />)}
                {report.length === 0 && (
                  <Text style={styles.empty}>No organization data for the selected filters.</Text>
                )}
              </View>
            </ScrollView>
            <Text style={styles.generatedAt}>Generated at: {new Date().toLocaleString()}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: Colors.background },
  header:          { padding: 16, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  headerTitle:     { fontSize: 18, fontWeight: '700', color: Colors.text },
  filterBox:       { margin: 12, backgroundColor: Colors.surface, borderRadius: 12, padding: 16, elevation: 2 },
  sectionTitle:    { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 12 },
  filterGrid:      { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterField:     { width: '47%' },
  filterLabel:     { fontSize: 11, color: Colors.textSecondary, marginBottom: 4 },
  filterInput:     { borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13 },
  runBtn:          { backgroundColor: PURPLE, borderRadius: 10, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16 },
  runBtnText:      { color: Colors.white, fontSize: 15, fontWeight: '700' },
  exportBox:       { marginHorizontal: 12, backgroundColor: Colors.surface, borderRadius: 12, padding: 16, elevation: 2 },
  exportTitle:     { fontSize: 14, fontWeight: '700', color: Colors.text, marginBottom: 12 },
  exportBtns:      { flexDirection: 'row', gap: 12 },
  exportBtn:       { flex: 1, alignItems: 'center', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, gap: 6 },
  exportBtnText:   { fontSize: 13, fontWeight: '600', color: Colors.text },
  summaryBox:      { margin: 12, backgroundColor: Colors.surface, borderRadius: 12, padding: 16, elevation: 2 },
  summaryRow:      { flexDirection: 'row', justifyContent: 'space-around' },
  summaryItem:     { alignItems: 'center' },
  summaryValue:    { fontSize: 20, fontWeight: '800', color: PURPLE },
  summaryLabel:    { fontSize: 11, color: Colors.textSecondary, textAlign: 'center', marginTop: 2 },
  tableBox:        { margin: 12, backgroundColor: Colors.surface, borderRadius: 12, padding: 16, elevation: 2, marginBottom: 24 },
  reportRow:       { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.divider, backgroundColor: Colors.surface },
  reportHeader:    { backgroundColor: PURPLE + '22' },
  reportCell:      { flex: 1, fontSize: 12, color: Colors.text, paddingHorizontal: 6, minWidth: 60 },
  reportHeaderCell:{ fontWeight: '700', color: PURPLE, fontSize: 11 },
  generatedAt:     { fontSize: 11, color: Colors.textMuted, textAlign: 'right', marginTop: 12 },
  empty:           { textAlign: 'center', color: Colors.textMuted, padding: 20 },
});
