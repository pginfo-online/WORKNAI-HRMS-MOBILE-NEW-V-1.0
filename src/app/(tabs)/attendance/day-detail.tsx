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
import { safeFormat } from '../../../utils/dateUtils';
import { useUIStore } from '../../../store/ui.store';
import { colors } from '../../../constants/colors';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { ErrorBoundary } from '../../../components/ErrorBoundary';

function DayDetailContent() {
  const router = useRouter();
  const { theme } = useUIStore();
  const params = useLocalSearchParams<{
    dateStr?: string;
    dayData?: string;
    dayStatus?: string;
    inTime?: string;
    outTime?: string;
    totalHours?: string;
    workMode?: string;
    isLate?: string;
    lateMinutes?: string;
    isEarlyCheckout?: string;
    earlyCheckoutMinutes?: string;
    overtimeMinutes?: string;
    shortfallMinutes?: string;
    isHoliday?: string;
    holidayName?: string;
    isWeekOff?: string;
    todayWork?: string;
    pendingWork?: string;
    issuesFaced?: string;
  }>();

  const dateStr = params.dateStr || '';

  // Safely attempt parsing dayData if provided (legacy)
  let legacyData: any = null;
  if (params.dayData) {
    try {
      legacyData = JSON.parse(params.dayData);
    } catch {
      console.warn('[DayDetail] Failed to parse dayData JSON parameter');
    }
  }

  const isHoliday = params.isHoliday === '1' || legacyData?.isHoliday;
  const holidayName = params.holidayName || legacyData?.holidayName || '';
  const isWeekOff = params.isWeekOff === '1' || legacyData?.isWeekOff;
  const dayStatus = params.dayStatus || legacyData?.dayStatus || 'A';

  const inTime = params.inTime || legacyData?.record?.inTime || null;
  const outTime = params.outTime || legacyData?.record?.outTime || null;
  const totalHoursStr = params.totalHours || (legacyData?.record?.totalHours ? String(legacyData.record.totalHours) : '');
  const workMode = params.workMode || legacyData?.record?.workMode || 'Office';
  const isLate = params.isLate === '1' || legacyData?.record?.isLate;
  const lateMinutes = Number(params.lateMinutes || legacyData?.record?.lateMinutes || 0);
  const isEarlyCheckout = params.isEarlyCheckout === '1' || legacyData?.record?.isEarlyCheckout;
  const earlyCheckoutMinutes = Number(params.earlyCheckoutMinutes || legacyData?.record?.earlyCheckoutMinutes || 0);
  const overtimeMinutes = Number(params.overtimeMinutes || legacyData?.record?.overtimeMinutes || 0);
  const shortfallMinutes = Number(params.shortfallMinutes || legacyData?.record?.shortfallMinutes || 0);

  const todayWork = params.todayWork || legacyData?.record?.todayWork || '';
  const pendingWork = params.pendingWork || legacyData?.record?.pendingWork || '';
  const issuesFaced = params.issuesFaced || legacyData?.record?.issuesFaced || '';

  let statusVariant: 'success' | 'warning' | 'error' | 'info' | 'neutral' = 'neutral';
  let statusLabel = 'No Data';

  if (isHoliday) {
    statusVariant = 'info';
    statusLabel = holidayName || 'Holiday';
  } else if (isWeekOff) {
    statusVariant = 'neutral';
    statusLabel = 'Week Off';
  } else if (dayStatus === 'P') {
    statusVariant = 'success';
    statusLabel = isLate ? 'Present (Late)' : 'Present';
  } else if (dayStatus === 'Half') {
    statusVariant = 'warning';
    statusLabel = 'Half Day';
  } else if (dayStatus === 'L') {
    statusVariant = 'info';
    statusLabel = 'On Leave';
  } else if (dayStatus === 'Coff') {
    statusVariant = 'info';
    statusLabel = 'Comp-Off';
  } else if (dayStatus === 'A') {
    statusVariant = 'error';
    statusLabel = 'Absent';
  }

  const hasRecord = Boolean(inTime || outTime || totalHoursStr);

  const metrics = hasRecord
    ? [
        {
          icon: 'log-in-outline' as const,
          label: 'Check In',
          value: inTime ? safeFormat(inTime, 'hh:mm a') : 'N/A',
          color: '#10B981',
          bg: 'rgba(16,185,129,0.1)',
        },
        {
          icon: 'log-out-outline' as const,
          label: 'Check Out',
          value: outTime ? safeFormat(outTime, 'hh:mm a') : 'N/A',
          color: colors.primary,
          bg: 'rgba(32,118,199,0.1)',
        },
        {
          icon: 'time-outline' as const,
          label: 'Total Hours',
          value: totalHoursStr ? `${parseFloat(totalHoursStr).toFixed(2)}h` : '0.00h',
          color: '#F59E0B',
          bg: 'rgba(245,158,11,0.1)',
        },
        {
          icon: 'navigate-outline' as const,
          label: 'Work Mode',
          value: workMode,
          color: '#7C3AED',
          bg: 'rgba(124,58,237,0.1)',
        },
        ...(overtimeMinutes > 0
          ? [
              {
                icon: 'trending-up-outline' as const,
                label: 'Overtime',
                value: `${overtimeMinutes}m`,
                color: '#10B981',
                bg: 'rgba(16,185,129,0.1)',
              },
            ]
          : []),
        ...(shortfallMinutes > 0
          ? [
              {
                icon: 'trending-down-outline' as const,
                label: 'Shortfall',
                value: `${shortfallMinutes}m`,
                color: '#EF4444',
                bg: 'rgba(239,68,68,0.1)',
              },
            ]
          : []),
      ]
    : [];

  const displayTitle = safeFormat(dateStr, 'EEEE', 'Day Detail');
  const displaySub = safeFormat(dateStr, 'dd MMMM yyyy', dateStr || 'Attendance Record');

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader
        title={displayTitle}
        subtitle={displaySub}
        showBack
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Status Card */}
        <Card style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View>
              <Text style={[styles.dateLabel, { color: theme.textSecondary }]}>
                {safeFormat(dateStr, 'EEEE, dd MMMM yyyy', dateStr)}
              </Text>
              <Text style={[styles.statusTitle, { color: theme.text }]}>Attendance Status</Text>
            </View>
            <Badge label={statusLabel} variant={statusVariant} />
          </View>

          {isLate && (
            <View style={[styles.lateBanner, { backgroundColor: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.3)' }]}>
              <Ionicons name="warning-outline" size={16} color="#D97706" />
              <Text style={[styles.lateText, { color: '#D97706' }]}>
                Late by {lateMinutes} minutes
              </Text>
            </View>
          )}

          {isEarlyCheckout && (
            <View style={[styles.lateBanner, { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)', marginTop: isLate ? 8 : 0 }]}>
              <Ionicons name="exit-outline" size={16} color="#DC2626" />
              <Text style={[styles.lateText, { color: '#DC2626' }]}>
                Early checkout by {earlyCheckoutMinutes} minutes
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
        {(todayWork || pendingWork || issuesFaced) ? (
          <>
            <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>Work Report</Text>
            {todayWork ? (
              <Card style={styles.reportCard}>
                <View style={styles.reportSection}>
                  <View style={[styles.reportDot, { backgroundColor: '#10B981' }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.reportLabel, { color: theme.textSecondary }]}>Work Completed</Text>
                    <Text style={[styles.reportText, { color: theme.text }]}>{todayWork}</Text>
                  </View>
                </View>
              </Card>
            ) : null}
            {pendingWork ? (
              <Card style={styles.reportCard}>
                <View style={styles.reportSection}>
                  <View style={[styles.reportDot, { backgroundColor: '#F59E0B' }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.reportLabel, { color: theme.textSecondary }]}>Pending Work</Text>
                    <Text style={[styles.reportText, { color: theme.text }]}>{pendingWork}</Text>
                  </View>
                </View>
              </Card>
            ) : null}
            {issuesFaced ? (
              <Card style={styles.reportCard}>
                <View style={styles.reportSection}>
                  <View style={[styles.reportDot, { backgroundColor: '#EF4444' }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.reportLabel, { color: theme.textSecondary }]}>Blockers / Issues</Text>
                    <Text style={[styles.reportText, { color: theme.text }]}>{issuesFaced}</Text>
                  </View>
                </View>
              </Card>
            ) : null}
          </>
        ) : null}

        {/* Request Correction CTA */}
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => {
            router.push({
              pathname: '/(tabs)/attendance/correction',
              params: { prefillDate: dateStr },
            });
          }}
          style={[styles.correctionBtn, { backgroundColor: colors.primary }]}
        >
          <Ionicons name="create-outline" size={18} color="#FFFFFF" />
          <Text style={styles.correctionBtnText}>Request Correction for this Day</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

export default function DayDetailScreen() {
  return (
    <ErrorBoundary>
      <DayDetailContent />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  statusCard: { padding: 18, gap: 12 },
  correctionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 14,
    marginTop: 8,
  },
  correctionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  statusHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dateLabel: { fontSize: 12, fontWeight: '600' },
  statusTitle: { fontSize: 18, fontWeight: '800', marginTop: 2 },
  lateBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 12, borderWidth: 1 },
  lateText: { fontSize: 12, fontWeight: '700' },
  sectionHeading: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 4 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard: { width: '47%', padding: 14, gap: 6 },
  metricIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  metricLabel: { fontSize: 11, fontWeight: '600' },
  metricValue: { fontSize: 15, fontWeight: '800' },
  reportCard: { padding: 16 },
  reportSection: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  reportDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  reportLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  reportText: { fontSize: 13, marginTop: 4, lineHeight: 18 },
});
