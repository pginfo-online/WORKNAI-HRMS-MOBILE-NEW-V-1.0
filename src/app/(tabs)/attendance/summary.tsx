import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { attendanceApi } from '../../../api/attendance.api';
import { useUIStore } from '../../../store/ui.store';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Skeleton } from '../../../components/ui/Skeleton';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { MonthYearPicker } from '../../../components/ui/MonthYearPicker';
import { CalendarGrid, DayData } from '../../../components/ui/CalendarGrid';
import { colors } from '../../../constants/colors';

type ViewMode = 'calendar' | 'list';

export default function AttendanceSummaryScreen() {
  const router = useRouter();
  const { theme, isDark } = useUIStore();
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');

  const from = format(startOfMonth(selectedMonth), 'yyyy-MM-dd');
  const to = format(endOfMonth(selectedMonth), 'yyyy-MM-dd');

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['my-attendance-summary', from, to],
    queryFn: () => attendanceApi.getMySummary({ from, to, limit: 31 }).then((res) => res.data.data),
    placeholderData: keepPreviousData,
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
    router.push({
      pathname: '/(tabs)/attendance/day-detail' as any,
      params: {
        dateStr: format(date, 'yyyy-MM-dd'),
        dayData: JSON.stringify(day || { date: date.toISOString(), dateStr: format(date, 'yyyy-MM-dd'), dayStatus: 'A', isWeekOff: false, isHoliday: false }),
      },
    });
  };

  const renderSkeleton = () => (
    <View style={styles.skeletonContent}>
      <Skeleton width="100%" height={52} borderRadius={16} style={{ marginHorizontal: 20 }} />
      <View style={styles.skeletonKpiRow}>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={[styles.kpiCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
            <Skeleton width={36} height={26} borderRadius={6} />
            <Skeleton width={44} height={12} borderRadius={4} style={{ marginTop: 6 }} />
          </View>
        ))}
      </View>
      <Skeleton width="100%" height={280} borderRadius={16} style={{ marginHorizontal: 20 }} />
    </View>
  );

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
                {format(new Date(item.date), 'EEEE, dd MMM')}
              </Text>
              {item.record?.inTime ? (
                <Text style={[styles.timeText, { color: theme.textSecondary }]}>
                  {format(new Date(item.record.inTime), 'hh:mm a')}
                  {item.record.outTime ? ` – ${format(new Date(item.record.outTime), 'hh:mm a')}` : ' (No checkout)'}
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

  const kpiItems = [
    { value: summary?.present ?? 0, label: 'Present', color: '#15803D' },
    { value: summary?.late ?? 0, label: 'Late', color: '#D97706' },
    { value: summary?.absent ?? 0, label: 'Absent', color: '#DC2626' },
    { value: (summary?.totalHours ?? 0).toFixed(0), label: 'Hours', color: colors.primary },
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
          isLoading ? renderSkeleton() : (
            <>
              {/* Month Picker */}
              <MonthYearPicker selectedDate={selectedMonth} onChange={setSelectedMonth} />

              {/* KPI Bar */}
              {summary && (
                <View style={styles.kpiRow}>
                  {kpiItems.map((k) => (
                    <View key={k.label} style={[styles.kpiCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                      <Text style={[styles.kpiVal, { color: k.color }]}>{k.value}</Text>
                      <Text style={[styles.kpiLbl, { color: theme.textTertiary }]}>{k.label}</Text>
                    </View>
                  ))}
                </View>
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
                onPress={() => router.push('/(tabs)/attendance/correction' as any)}
                style={[styles.correctionBanner, { backgroundColor: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.3)' }]}
              >
                <Ionicons name="create-outline" size={18} color={colors.warning} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.correctionTitle, { color: colors.warning }]}>Request Attendance Correction</Text>
                  <Text style={[styles.correctionSub, { color: theme.textSecondary }]}>Wrong check-in/out time? Submit a correction request.</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.warning} />
              </TouchableOpacity>

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
          viewMode === 'list' && !isLoading ? (
            <View style={styles.empty}>
              <Text style={{ color: theme.textSecondary, fontWeight: '600' }}>
                No records found for {format(selectedMonth, 'MMMM yyyy')}
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { paddingBottom: 40, gap: 0 },
  skeletonContent: { gap: 16, paddingTop: 16 },
  skeletonKpiRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 20 },
  kpiRow: { flexDirection: 'row', paddingHorizontal: 20, gap: 10, marginTop: 16 },
  kpiCard: { flex: 1, borderRadius: 16, borderWidth: 1, padding: 14, alignItems: 'center', gap: 4 },
  kpiVal: { fontSize: 22, fontWeight: '900' },
  kpiLbl: { fontSize: 11, fontWeight: '700' },
  viewToggle: { flexDirection: 'row', marginHorizontal: 20, marginTop: 16, borderRadius: 14, padding: 4, gap: 4 },
  toggleBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 10 },
  toggleLabel: { fontSize: 13, fontWeight: '700' },
  calendarCard: { marginHorizontal: 20, marginTop: 12, borderRadius: 20, borderWidth: 1, paddingVertical: 16 },
  correctionBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 20, marginTop: 16, padding: 14, borderRadius: 16, borderWidth: 1 },
  correctionTitle: { fontSize: 13, fontWeight: '800' },
  correctionSub: { fontSize: 12, marginTop: 1 },
  listHeading: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginHorizontal: 20, marginTop: 16, marginBottom: 8 },
  logCard: { marginHorizontal: 20, marginBottom: 8, padding: 14 },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  dateText: { fontSize: 14, fontWeight: '700' },
  timeText: { fontSize: 12, marginTop: 3, fontWeight: '500' },
  logRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  empty: { padding: 40, alignItems: 'center' },
});
