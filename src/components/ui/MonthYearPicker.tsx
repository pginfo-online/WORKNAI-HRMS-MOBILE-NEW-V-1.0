import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { format, addMonths, subMonths, isFuture, startOfMonth } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { useUIStore } from '../../store/ui.store';
import { colors } from '../../constants/colors';

interface MonthYearPickerProps {
  selectedDate: Date;
  onChange: (date: Date) => void;
  maxDate?: Date; // defaults to current month
}

export function MonthYearPicker({ selectedDate, onChange, maxDate }: MonthYearPickerProps) {
  const { theme } = useUIStore();
  const effectiveMax = maxDate ?? new Date();

  const canGoNext = !isFuture(startOfMonth(addMonths(selectedDate, 1)));

  const handlePrev = () => {
    Haptics.selectionAsync();
    onChange(subMonths(selectedDate, 1));
  };

  const handleNext = () => {
    if (!canGoNext) return;
    Haptics.selectionAsync();
    onChange(addMonths(selectedDate, 1));
  };

  const isCurrentMonth =
    selectedDate.getMonth() === new Date().getMonth() &&
    selectedDate.getFullYear() === new Date().getFullYear();

  return (
    <View style={[styles.container, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <TouchableOpacity onPress={handlePrev} style={styles.arrow} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="chevron-back" size={20} color={colors.primary} />
      </TouchableOpacity>

      <View style={styles.center}>
        <Text style={[styles.monthLabel, { color: theme.text }]}>
          {format(selectedDate, 'MMMM yyyy')}
        </Text>
        {isCurrentMonth && (
          <View style={[styles.currentBadge, { backgroundColor: 'rgba(32,118,199,0.1)' }]}>
            <Text style={[styles.currentBadgeText, { color: colors.primary }]}>Current</Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        onPress={handleNext}
        style={[styles.arrow, !canGoNext && styles.arrowDisabled]}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        disabled={!canGoNext}
      >
        <Ionicons name="chevron-forward" size={20} color={canGoNext ? colors.primary : theme.border} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginHorizontal: 20,
  },
  arrow: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(32,118,199,0.08)',
  },
  arrowDisabled: {
    backgroundColor: 'transparent',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  monthLabel: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  currentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  currentBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
