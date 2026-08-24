import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  getDay,
  isSameDay,
  isToday,
  isFuture,
} from 'date-fns';
import * as Haptics from 'expo-haptics';
import { useUIStore } from '../../store/ui.store';
import { colors } from '../../constants/colors';

export interface DayData {
  date: Date;
  dateStr: string;
  dayStatus: string;
  isWeekOff: boolean;
  isHoliday: boolean;
  holidayName?: string;
  record?: any;
}

interface CalendarGridProps {
  month: Date;
  dayDataMap: Map<string, DayData>; // key: YYYY-MM-DD
  onDayPress?: (day: DayData | null, date: Date) => void;
}

const DAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getStatusConfig(dayData: DayData | undefined, isDark: boolean) {
  if (!dayData) return { bg: 'transparent', textColor: isDark ? '#64748B' : '#CBD5E1', dot: null };

  const s = dayData.dayStatus;
  if (dayData.isHoliday) return { bg: 'rgba(59,130,246,0.15)', textColor: '#3B82F6', dot: '#3B82F6' };
  if (dayData.isWeekOff) return { bg: isDark ? '#1E293B' : '#F8FAFC', textColor: isDark ? '#475569' : '#94A3B8', dot: null };
  if (s === 'P') return { bg: 'rgba(16,185,129,0.15)', textColor: '#10B981', dot: '#10B981' };
  if (s === 'Half') return { bg: 'rgba(245,158,11,0.15)', textColor: '#F59E0B', dot: '#F59E0B' };
  if (s === 'L' || s === 'Coff') return { bg: 'rgba(139,92,246,0.15)', textColor: '#8B5CF6', dot: '#8B5CF6' };
  if (s === 'A') return { bg: 'rgba(239,68,68,0.1)', textColor: '#EF4444', dot: '#EF4444' };
  return { bg: 'transparent', textColor: isDark ? '#64748B' : '#CBD5E1', dot: null };
}

export function CalendarGrid({ month, dayDataMap, onDayPress }: CalendarGridProps) {
  const { theme, isDark } = useUIStore();

  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
  const firstDayOfWeek = getDay(startOfMonth(month)); // 0=Sun

  // Build padded grid
  const gridCells: (Date | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...days,
  ];
  // Pad to complete last row
  while (gridCells.length % 7 !== 0) gridCells.push(null);

  return (
    <View style={styles.container}>
      {/* Day headers */}
      <View style={styles.headerRow}>
        {DAY_HEADERS.map((d) => (
          <Text key={d} style={[styles.headerText, { color: theme.textTertiary }]}>
            {d}
          </Text>
        ))}
      </View>

      {/* Grid rows */}
      {Array.from({ length: gridCells.length / 7 }).map((_, rowIdx) => (
        <View key={rowIdx} style={styles.row}>
          {gridCells.slice(rowIdx * 7, rowIdx * 7 + 7).map((date, colIdx) => {
            if (!date) return <View key={colIdx} style={styles.cell} />;

            const dateStr = format(date, 'yyyy-MM-dd');
            const dayData = dayDataMap.get(dateStr);
            const config = getStatusConfig(dayData, isDark);
            const todayHighlight = isToday(date);
            const future = isFuture(date) && !isToday(date);

            return (
              <TouchableOpacity
                key={colIdx}
                style={[
                  styles.cell,
                  { backgroundColor: config.bg },
                  todayHighlight && styles.todayCell,
                ]}
                onPress={() => {
                  if (!future) {
                    Haptics.selectionAsync();
                    onDayPress?.(dayData || null, date);
                  }
                }}
                activeOpacity={future ? 1 : 0.7}
              >
                <Text
                  style={[
                    styles.dayNum,
                    { color: future ? (isDark ? '#2D3748' : '#E2E8F0') : config.textColor },
                    todayHighlight && styles.todayText,
                  ]}
                >
                  {format(date, 'd')}
                </Text>
                {config.dot && !future && (
                  <View style={[styles.dot, { backgroundColor: config.dot }]} />
                )}
                {todayHighlight && (
                  <View style={[styles.todayRing, { borderColor: colors.primary }]} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      ))}

      {/* Legend */}
      <View style={styles.legend}>
        {[
          { color: '#10B981', label: 'Present' },
          { color: '#EF4444', label: 'Absent' },
          { color: '#F59E0B', label: 'Half Day' },
          { color: '#3B82F6', label: 'Holiday' },
          { color: '#8B5CF6', label: 'Leave' },
        ].map((item) => (
          <View key={item.label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: item.color }]} />
            <Text style={[styles.legendText, { color: theme.textTertiary }]}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  headerText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  cell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    margin: 1,
    position: 'relative',
  },
  todayCell: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  todayRing: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 10,
    borderWidth: 2,
  },
  dayNum: {
    fontSize: 12,
    fontWeight: '700',
  },
  todayText: {
    fontWeight: '900',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    position: 'absolute',
    bottom: 4,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 16,
    justifyContent: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
