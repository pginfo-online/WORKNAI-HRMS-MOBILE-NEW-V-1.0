import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { useUIStore } from '../../../store/ui.store';
import { colors } from '../../../constants/colors';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';

export default function DayDetailScreen() {
  const router = useRouter();
  const { theme } = useUIStore();
  const params = useLocalSearchParams<{ dateStr?: string; dayData?: string }>();

  const dateStr = params.dateStr || '';
  let dayData: any = null;
  try {
    dayData = params.dayData ? JSON.parse(params.dayData) : null;
  } catch {}

  const date = dateStr ? parseISO(dateStr) : new Date();
  const record = dayData?.record;

  const s = dayData?.dayStatus;
  let statusVariant: 'success' | 'warning' | 'error' | 'info' | 'neutral' = 'neutral';
  let statusLabel = 'No Data';

  if (dayData?.isHoliday) { statusVariant = 'info'; statusLabel = dayData.holidayName || 'Holiday'; }
  else if (dayData?.isWeekOff) { statusVariant = 'neutral'; statusLabel = 'Week Off'; }
  else if (s === 'P') { statusVariant = 'success'; statusLabel = record?.isLate ? 'Present (Late)' : 'Present'; }
  else if (s === 'Half') { statusVariant = 'warning'; statusLabel = 'Half Day'; }
  else if (s === 'L') { statusVariant = 'info'; statusLabel = 'On Leave'; }
  else if (s === 'Coff') { statusVariant = 'info'; statusLabel = 'Comp-Off'; }
  else if (s === 'A') { statusVariant = 'error'; statusLabel = 'Absent'; }

  const metrics = record ? [
    {
      icon: 'log-in-outline' as const,
      label: 'Check In',
      value: record.inTime ? format(new Date(record.inTime), 'hh:mm a') : 'N/A',
      color: '#10B981',
      bg: 'rgba(16,185,129,0.1)',
    },
    {
      icon: 'log-out-outline' as const,
      label: 'Check Out',
      value: record.outTime ? format(new Date(record.outTime), 'hh:mm a') : 'N/A',
      color: colors.primary,
      bg: 'rgba(32,118,199,0.1)',
    },
    {
      icon: 'time-outline' as const,
      label: 'Total Hours',
      value: record.totalHours ? `${record.totalHours.toFixed(2)}h` : '0.00h',
      color: '#F59E0B',
      bg: 'rgba(245,158,11,0.1)',
    },
    {
      icon: 'navigate-outline' as const,
      label: 'Work Mode',
      value: record.workMode || 'Office',
      color: '#7C3AED',
      bg: 'rgba(124,58,237,0.1)',
    },
  ] : [];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader
        title={format(date, 'EEEE')}
        subtitle={format(date, 'dd MMMM yyyy')}
        showBack
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Status Card */}
        <Card style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View>
              <Text style={[styles.dateLabel, { color: theme.textSecondary }]}>
                {format(date, 'EEEE, dd MMMM yyyy')}
              </Text>
              <Text style={[styles.statusTitle, { color: theme.text }]}>Attendance Status</Text>
            </View>
            <Badge label={statusLabel} variant={statusVariant} />
          </View>

          {record?.isLate && (
            <View style={[styles.lateBanner, { backgroundColor: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.3)' }]}>
              <Ionicons name="warning-outline" size={16} color="#D97706" />
              <Text style={[styles.lateText, { color: '#D97706' }]}>
                Late by {record.lateMinutes} minutes
              </Text>
            </View>
          )}
        </Card>

        {/* Metrics Grid */}
        {metrics.length > 0 && (
          <>
            <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>Time Details</Text>
            <View style={styles.metricsGrid}>
              {metrics.map((m) => (
                <Card key={m.label} style={styles.metricCard}>
                  <View style={[styles.metricIcon, { backgroundColor: m.bg }]}>
                    <Ionicons name={m.icon} size={20} color={m.color} />
                  </View>
                  <Text style={[styles.metricLabel, { color: theme.textTertiary }]}>{m.label}</Text>
                  <Text style={[styles.metricValue, { color: theme.text }]}>{m.value}</Text>
                </Card>
              ))}
            </View>
          </>
        )}

        {/* Work Report */}
        {(record?.todayWork || record?.pendingWork || record?.issuesFaced) && (
          <>
            <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>Work Report</Text>
            {record.todayWork && (
              <Card style={styles.reportCard}>
                <View style={styles.reportSection}>
                  <View style={[styles.reportDot, { backgroundColor: '#10B981' }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.reportLabel, { color: theme.textSecondary }]}>Work Completed</Text>
                    <Text style={[styles.reportText, { color: theme.text }]}>{record.todayWork}</Text>
                  </View>
                </View>
              </Card>
            )}
            {record.pendingWork && (
              <Card style={styles.reportCard}>
                <View style={styles.reportSection}>
                  <View style={[styles.reportDot, { backgroundColor: '#F59E0B' }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.reportLabel, { color: theme.textSecondary }]}>Pending Work</Text>
                    <Text style={[styles.reportText, { color: theme.text }]}>{record.pendingWork}</Text>
                  </View>
                </View>
              </Card>
            )}
            {record.issuesFaced && (
              <Card style={styles.reportCard}>
                <View style={styles.reportSection}>
                  <View style={[styles.reportDot, { backgroundColor: '#EF4444' }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.reportLabel, { color: theme.textSecondary }]}>Issues Faced</Text>
                    <Text style={[styles.reportText, { color: theme.text }]}>{record.issuesFaced}</Text>
                  </View>
                </View>
              </Card>
            )}
          </>
        )}

        {/* Correction Status */}
        {record?.correctionRequested && (
          <>
            <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>Correction Request</Text>
            <Card style={styles.correctionCard}>
              <View style={styles.correctionRow}>
                <Ionicons name="create-outline" size={18} color={
                  record.correctionStatus === 'Approved' ? '#10B981' :
                  record.correctionStatus === 'Rejected' ? '#EF4444' : '#F59E0B'
                } />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.correctionStatus, { color: theme.text }]}>
                    Status: {record.correctionStatus?.replace('Pending_', 'Pending with ') || 'Unknown'}
                  </Text>
                  {record.correctionReason && (
                    <Text style={[styles.correctionReason, { color: theme.textSecondary }]}>
                      {record.correctionReason}
                    </Text>
                  )}
                  {record.requestedInTime && (
                    <Text style={[styles.correctionTime, { color: theme.textTertiary }]}>
                      Requested: {format(new Date(record.requestedInTime), 'hh:mm a')}
                      {record.requestedOutTime ? ` – ${format(new Date(record.requestedOutTime), 'hh:mm a')}` : ''}
                    </Text>
                  )}
                </View>
              </View>
            </Card>
          </>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          {!dayData?.isHoliday && !dayData?.isWeekOff && (
            <TouchableOpacity
              onPress={() => {
                router.push({
                  pathname: '/(tabs)/attendance/correction' as any,
                  params: { prefillDate: dateStr },
                });
              }}
              style={[styles.actionBtn, { backgroundColor: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.3)' }]}
            >
              <Ionicons name="create-outline" size={18} color={colors.warning} />
              <Text style={[styles.actionBtnText, { color: colors.warning }]}>
                Request Correction
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, gap: 14, paddingBottom: 40 },
  statusCard: { padding: 18, gap: 12 },
  statusHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  dateLabel: { fontSize: 13, fontWeight: '600' },
  statusTitle: { fontSize: 18, fontWeight: '800', marginTop: 2 },
  lateBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 12, borderWidth: 1 },
  lateText: { fontSize: 13, fontWeight: '700' },
  sectionHeading: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard: { width: '47%', padding: 14, gap: 8, alignItems: 'flex-start' },
  metricIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  metricLabel: { fontSize: 11, fontWeight: '600' },
  metricValue: { fontSize: 16, fontWeight: '800' },
  reportCard: { padding: 16 },
  reportSection: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  reportDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4, flexShrink: 0 },
  reportLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  reportText: { fontSize: 14, lineHeight: 20 },
  correctionCard: { padding: 16 },
  correctionRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  correctionStatus: { fontSize: 14, fontWeight: '700' },
  correctionReason: { fontSize: 13, marginTop: 4 },
  correctionTime: { fontSize: 12, marginTop: 4 },
  actions: { gap: 10, marginTop: 4 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: 16, borderWidth: 1 },
  actionBtnText: { fontSize: 14, fontWeight: '700' },
});
