import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { safeFormat } from '../../../utils/dateUtils';
import { attendanceApi } from '../../../api/attendance.api';
import { useUIStore } from '../../../store/ui.store';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { SummarySkeleton } from '../../../components/ui/SkeletonPresets';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { MonthYearPicker } from '../../../components/ui/MonthYearPicker';
import { CalendarGrid, DayData } from '../../../components/ui/CalendarGrid';
import { colors } from '../../../constants/colors';
import { ErrorBoundary } from '../../../components/ErrorBoundary';

type ViewMode = 'calendar' | 'list';

function AttendanceSummaryContent() {
  const router = useRouter();
  const { theme, isDark } = useUIStore();
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');

  const from = safeFormat(startOfMonth(selectedMonth), 'yyyy-MM-dd', format(new Date(), 'yyyy-MM-01'));
  const to = safeFormat(endOfMonth(selectedMonth), 'yyyy-MM-dd', format(new Date(), 'yyyy-MM-31'));

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['my-attendance-summary', from, to],
    queryFn: () => attendanceApi.getMySummary({ from, to, limit: 31 }).then((res) => res.data.data),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });

  const records: DayData[] = data?.records || [];
  const summary = data?.summary;

  // Build map for calendar
  const dayDataMap = useMemo(() => {
    const map = new Map<string, DayData>();
    records.forEach((r) => {
      if (r.dateStr) map.set(r.dateStr, r);
    });
    return map;
  }, [records]);

  const handleDayPress = (day: DayData | null, date: Date) => {
    const dStr = safeFormat(date, 'yyyy-MM-dd', format(new Date(), 'yyyy-MM-dd'));
    router.push({
      pathname: '/(tabs)/attendance/day-detail',
      params: {
        dateStr: dStr,
        dayStatus: day?.dayStatus || 'A',
        inTime: day?.record?.inTime || '',
        outTime: day?.record?.outTime || '',
        totalHours: day?.record?.totalHours ? String(day.record.totalHours) : '',
        workMode: day?.record?.workMode || 'Office',
        isLate: day?.record?.isLate ? '1' : '0',
        lateMinutes: day?.record?.lateMinutes ? String(day.record.lateMinutes) : '0',
        isEarlyCheckout: day?.record?.isEarlyCheckout ? '1' : '0',
        earlyCheckoutMinutes: day?.record?.earlyCheckoutMinutes ? String(day.record.earlyCheckoutMinutes) : '0',
        overtimeMinutes: day?.record?.overtimeMinutes ? String(day.record.overtimeMinutes) : '0',
        shortfallMinutes: day?.record?.shortfallMinutes ? String(day.record.shortfallMinutes) : '0',
        isHoliday: day?.isHoliday ? '1' : '0',
        holidayName: day?.holidayName || '',
        isWeekOff: day?.isWeekOff ? '1' : '0',
        todayWork: day?.record?.todayWork || '',
        pendingWork: day?.record?.pendingWork || '',
        issuesFaced: day?.record?.issuesFaced || '',
      },
    });
  };

  const renderListItem = ({ item }: { item: DayData }) => {
    const s = item.dayStatus;
    let variant: 'success' | 'warning' | 'error' | 'info' | 'neutral' = 'neutral';
    let label = 'Absent';

    if (item.isHoliday) { variant = 'info'; label = item.holidayName || 'Holiday'; }
    else if (item.isWeekOff) { variant = 'neutral'; label = 'Week Off'; }
    else if (s === 'P') { variant = 'success'; label = item.record?.isLate ? 'Late Present' : 'Present'; }
    else if (s === 'Half') { variant = 'warning'; label = 'Half Day'; }
    else if (s === 'L' || s === 'Coff') { variant = 'info'; label = s === 'Coff' ? 'Comp-Off' : 'Leave'; }
    else { variant = 'error'; label = 'Absent'; }

    return (
      <TouchableOpacity
        onPress={() => handleDayPress(item, new Date(item.date))}
        activeOpacity={0.75}
      >
        <Card style={styles.logCard}>
          <View style={styles.logHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.dateText, { color: theme.text }]}>
                {safeFormat(item.date, 'EEEE, dd MMM')}
              </Text>
              {item.record?.inTime ? (
                <Text style={[styles.timeText, { color: theme.textSecondary }]}>
                  {safeFormat(item.record.inTime, 'hh:mm a')}
                  {item.record.outTime ? ` – ${safeFormat(item.record.outTime, 'hh:mm a')}` : ' (No checkout)'}
                  {item.record.totalHours ? ` · ${item.record.totalHours.toFixed(1)}h` : ''}
                </Text>
              ) : (item.isHoliday || item.isWeekOff) ? null : (
                <Text style={[styles.timeText, { color: theme.textTertiary }]}>No attendance recorded</Text>
              )}
            </View>
            <View style={styles.logRight}>
              <Badge label={label} variant={variant} />
              <Ionicons name="chevron-forward" size={14} color={theme.textTertiary} />
            </View>
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  const { data: correctionsData } = useQuery({
    queryKey: ['my-corrections'],
    queryFn: () => attendanceApi.getMyCorrectionHistory().then((res) => res.data.data || []),
    staleTime: 60_000,
  });

  const kpiItems = [
    { value: summary?.present ?? 0, label: 'Present', color: '#15803D' },
    { value: summary?.halfDay ?? 0, label: 'Half Day', color: '#D97706' },
    { value: summary?.absent ?? 0, label: 'Absent', color: '#DC2626' },
    { value: summary?.late ?? 0, label: 'Late', color: '#B45309' },
    { value: summary?.earlyCheckout ?? 0, label: 'Early Out', color: '#E11D48' },
    { value: summary?.weekOff ?? 0, label: 'Week Off', color: '#0369A1' },
    { value: summary?.holiday ?? 0, label: 'Holiday', color: '#DB2777' },
    { value: `${summary?.attendancePercentage ?? 0}%`, label: 'Rate', color: colors.primary },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader title="Attendance Logs" subtitle="Monthly Presence & Calendar" showBack />

      <FlatList
        data={viewMode === 'list' ? records : []}
        keyExtractor={(item, index) => item.dateStr || String(index)}
        renderItem={renderListItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          isLoading ? <SummarySkeleton /> : isError ? (
            <View style={styles.errorCardWrap}>
              <Card style={styles.errorCard}>
                <Ionicons name="alert-circle-outline" size={36} color={colors.error} />
                <Text style={[styles.errorTitle, { color: theme.text }]}>Failed to Load Summary</Text>
                <Text style={[styles.errorSub, { color: theme.textSecondary }]}>Network or server issue. Tap to try again.</Text>
                <TouchableOpacity style={[styles.retryBtn, { backgroundColor: colors.primary }]} onPress={() => refetch()}>
                  <Text style={styles.retryBtnText}>Retry</Text>
                </TouchableOpacity>
              </Card>
            </View>
          ) : (
            <>
              {/* Month Picker */}
              <MonthYearPicker selectedDate={selectedMonth} onChange={setSelectedMonth} />

              {/* KPI Bar */}
              {summary && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.kpiRowHorizontal}>
                  {kpiItems.map((k) => (
                    <View key={k.label} style={[styles.kpiCardItem, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                      <Text style={[styles.kpiVal, { color: k.color }]}>{k.value}</Text>
                      <Text style={[styles.kpiLbl, { color: theme.textTertiary }]}>{k.label}</Text>
                    </View>
                  ))}
                </ScrollView>
              )}

              {/* View Mode Toggle */}
              <View style={[styles.viewToggle, { backgroundColor: theme.surfaceAlt }]}>
                <TouchableOpacity
                  onPress={() => setViewMode('calendar')}
                  style={[styles.toggleBtn, viewMode === 'calendar' && { backgroundColor: theme.surface }]}
                >
                  <Ionicons name="calendar" size={16} color={viewMode === 'calendar' ? colors.primary : theme.textTertiary} />
                  <Text style={[styles.toggleLabel, { color: viewMode === 'calendar' ? colors.primary : theme.textTertiary }]}>Calendar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setViewMode('list')}
                  style={[styles.toggleBtn, viewMode === 'list' && { backgroundColor: theme.surface }]}
                >
                  <Ionicons name="list" size={16} color={viewMode === 'list' ? colors.primary : theme.textTertiary} />
                  <Text style={[styles.toggleLabel, { color: viewMode === 'list' ? colors.primary : theme.textTertiary }]}>List</Text>
                </TouchableOpacity>
              </View>

              {/* Calendar View */}
              {viewMode === 'calendar' && (
                <View style={[styles.calendarCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  <CalendarGrid
                    month={selectedMonth}
                    dayDataMap={dayDataMap}
                    onDayPress={handleDayPress}
                  />
                </View>
              )}

              {/* Correction Request Banner */}
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/attendance/correction')}
                style={[styles.correctionBanner, { backgroundColor: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.3)' }]}
              >
                <Ionicons name="create-outline" size={18} color={colors.warning} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.correctionTitle, { color: colors.warning }]}>Request Attendance Correction</Text>
                  <Text style={[styles.correctionSub, { color: theme.textSecondary }]}>Wrong check-in/out time? Submit a correction request.</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.warning} />
              </TouchableOpacity>

              {/* Correction Status History Section */}
              {correctionsData && correctionsData.length > 0 && (
                <View style={{ marginHorizontal: 20, marginTop: 16, gap: 8 }}>
                  <Text style={[styles.listHeading, { marginHorizontal: 0, marginTop: 0 }]}>Correction Requests Status</Text>
                  {correctionsData.slice(0, 3).map((corr: any) => {
                    const st = corr.correctionStatus;
                    const isAppr = st === 'Approved';
                    const isRej = st === 'Rejected';
                    const badgeBg = isAppr ? 'rgba(16,185,129,0.1)' : isRej ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)';
                    const badgeColor = isAppr ? colors.success : isRej ? colors.error : colors.warning;
                    return (
                      <TouchableOpacity
                        key={corr._id}
                        disabled={isAppr || isRej}
                        activeOpacity={0.7}
                        onPress={() => {
                          if (!isAppr && !isRej) {
                            router.push({
                              pathname: '/(tabs)/attendance/correction',
                              params: {
                                correctionId: corr._id,
                                prefillDate: corr.date ? corr.date.substring(0, 10) : undefined,
                                prefillReason: corr.correctionReason,
                                prefillStatus: corr.requestedStatus,
                                prefillInTime: corr.requestedInTime,
                                prefillOutTime: corr.requestedOutTime,
                              },
                            });
                          }
                        }}
                        style={[styles.corrHistoryCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
                      >
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={[styles.corrHistDate, { color: theme.text }]}>
                              {corr.date ? safeFormat(corr.date, 'dd MMM yyyy') : 'Request'}
                            </Text>
                            {!isAppr && !isRej && (
                              <Ionicons name="create-outline" size={14} color={colors.warning} />
                            )}
                          </View>
                          <Text style={[styles.corrHistReason, { color: theme.textSecondary }]} numberOfLines={1}>
                            {corr.correctionReason}
                          </Text>
                        </View>
                        <View style={[styles.corrStatusPill, { backgroundColor: badgeBg }]}>
                          <Text style={[styles.corrStatusText, { color: badgeColor }]}>
                            {isAppr ? 'Approved' : isRej ? 'Rejected' : 'Pending HR (Edit)'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* List header if list mode */}
              {viewMode === 'list' && (
                <Text style={[styles.listHeading, { color: theme.textSecondary }]}>
                  Daily Records
                </Text>
              )}
            </>
          )
        }
        ListEmptyComponent={
          viewMode === 'list' && !isLoading && !isError ? (
            <View style={styles.empty}>
              <Text style={{ color: theme.textSecondary, fontWeight: '600' }}>
                No records found for {safeFormat(selectedMonth, 'MMMM yyyy')}
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

export default function AttendanceSummaryScreen() {
  return (
    <ErrorBoundary>
      <AttendanceSummaryContent />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingBottom: 40, gap: 0 },
  skeletonContent: { gap: 16, paddingTop: 16 },
  skeletonKpiRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20 },
  kpiRowHorizontal: { paddingHorizontal: 20, gap: 10, marginTop: 16 },
  kpiCard: { flex: 1, borderRadius: 16, borderWidth: 1, padding: 14, alignItems: 'center', gap: 4 },
  kpiCardItem: { width: 90, borderRadius: 16, borderWidth: 1, padding: 12, alignItems: 'center', gap: 4 },
  kpiVal: { fontSize: 20, fontWeight: '900' },
  kpiLbl: { fontSize: 11, fontWeight: '700' },
  viewToggle: { flexDirection: 'row', marginHorizontal: 20, marginTop: 16, borderRadius: 14, padding: 4, gap: 4 },
  toggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 10 },
  toggleLabel: { fontSize: 13, fontWeight: '700' },
  calendarCard: { marginHorizontal: 20, marginTop: 12, borderRadius: 20, borderWidth: 1, paddingVertical: 16 },
  correctionBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 20, marginTop: 16, padding: 14, borderRadius: 16, borderWidth: 1 },
  correctionTitle: { fontSize: 13, fontWeight: '800' },
  correctionSub: { fontSize: 12, marginTop: 1 },
  corrHistoryCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, borderWidth: 1 },
  corrHistDate: { fontSize: 13, fontWeight: '700' },
  corrHistReason: { fontSize: 11, marginTop: 2 },
  corrStatusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  corrStatusText: { fontSize: 11, fontWeight: '800' },
  listHeading: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginHorizontal: 20, marginTop: 16, marginBottom: 8 },
  logCard: { marginHorizontal: 20, marginBottom: 8, padding: 14 },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  dateText: { fontSize: 14, fontWeight: '700' },
  timeText: { fontSize: 12, marginTop: 3, fontWeight: '500' },
  logRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  empty: { padding: 40, alignItems: 'center' },
  errorCardWrap: { paddingHorizontal: 20, marginTop: 20 },
  errorCard: { padding: 24, alignItems: 'center', gap: 8 },
  errorTitle: { fontSize: 16, fontWeight: '800' },
  errorSub: { fontSize: 13, textAlign: 'center' },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10, marginTop: 8 },
  retryBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
});
