/**
 * SkeletonPresets.tsx
 *
 * Dedicated skeleton layout presets for major screens in the Attendance module.
 * Eliminates layout jumps and ensures consistent, polished loading across the app.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Skeleton, SkeletonCircle, SkeletonText } from './Skeleton';
import { useUIStore } from '../../store/ui.store';

// ── Attendance Main Screen Skeleton ──────────────────────────────────────────

export const AttendanceMainSkeleton: React.FC = () => {
  const { theme } = useUIStore();

  return (
    <View style={styles.container}>
      {/* Geo pill row */}
      <View style={styles.geoPillRow}>
        <Skeleton width={150} height={30} borderRadius={999} />
        <Skeleton width={32} height={32} borderRadius={10} />
      </View>

      {/* Hero card skeleton */}
      <View style={[styles.heroCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <SkeletonCircle size={60} style={{ alignSelf: 'center', marginBottom: 12 }} />
        <Skeleton width="60%" height={24} borderRadius={8} style={{ alignSelf: 'center', marginBottom: 8 }} />
        <Skeleton width="80%" height={14} borderRadius={6} style={{ alignSelf: 'center', marginBottom: 20 }} />
        <Skeleton width="100%" height={52} borderRadius={16} />
      </View>

      {/* Nav shortcuts row */}
      <View style={styles.navRow}>
        {[1, 2, 3].map((i) => (
          <View
            key={i}
            style={[styles.navCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <Skeleton width={40} height={40} borderRadius={12} />
            <View style={{ flex: 1, gap: 6 }}>
              <Skeleton width="50%" height={14} borderRadius={4} />
              <Skeleton width="80%" height={11} borderRadius={4} />
            </View>
            <Skeleton width={16} height={16} borderRadius={4} />
          </View>
        ))}
      </View>

      {/* Deliverables section */}
      <View style={{ gap: 10 }}>
        <Skeleton width="40%" height={18} borderRadius={6} />
        <Skeleton width="100%" height={72} borderRadius={16} />
        <Skeleton width="100%" height={72} borderRadius={16} />
      </View>

      {/* Duty metrics grid */}
      <View style={{ gap: 10, marginTop: 4 }}>
        <Skeleton width="30%" height={14} borderRadius={4} />
        <View style={styles.metricsGrid}>
          {[1, 2, 3, 4].map((i) => (
            <View
              key={i}
              style={[styles.metricCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
            >
              <Skeleton width={40} height={40} borderRadius={12} />
              <View style={{ gap: 4 }}>
                <Skeleton width={45} height={10} borderRadius={4} />
                <Skeleton width={60} height={16} borderRadius={4} />
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
};

// ── Summary Screen Skeleton ──────────────────────────────────────────────────

export const SummarySkeleton: React.FC = () => {
  const { theme } = useUIStore();

  return (
    <View style={styles.summaryContainer}>
      {/* Month picker placeholder */}
      <Skeleton width="100%" height={52} borderRadius={16} />

      {/* 7 KPI Chips Row */}
      <View style={styles.kpiRow}>
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <View
            key={i}
            style={[styles.kpiCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
          >
            <Skeleton width={28} height={20} borderRadius={4} />
            <Skeleton width={38} height={10} borderRadius={4} style={{ marginTop: 4 }} />
          </View>
        ))}
      </View>

      {/* View Toggle */}
      <Skeleton width="100%" height={42} borderRadius={14} />

      {/* Calendar Card */}
      <View style={[styles.calendarBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={{ gap: 12 }}>
          <Skeleton width="100%" height={32} borderRadius={8} />
          <View style={{ gap: 8 }}>
            {[1, 2, 3, 4, 5].map((row) => (
              <View key={row} style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 6 }}>
                {[1, 2, 3, 4, 5, 6, 7].map((col) => (
                  <Skeleton key={col} width={34} height={34} borderRadius={10} />
                ))}
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* Correction banner */}
      <Skeleton width="100%" height={56} borderRadius={16} />
    </View>
  );
};

// ── Task List Skeleton ───────────────────────────────────────────────────────

export const TaskListSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => {
  const { theme } = useUIStore();

  return (
    <View style={{ gap: 10 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[styles.taskCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
        >
          <Skeleton width={24} height={24} borderRadius={8} />
          <View style={{ flex: 1, gap: 6 }}>
            <Skeleton width="70%" height={16} borderRadius={4} />
            <Skeleton width="90%" height={12} borderRadius={4} />
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 2 }}>
              <Skeleton width={60} height={18} borderRadius={6} />
              <Skeleton width={50} height={18} borderRadius={6} />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
};

// ── Check-In / Check-Out Form Skeleton ───────────────────────────────────────

export const CheckInFormSkeleton: React.FC = () => {
  const { theme } = useUIStore();

  return (
    <View style={{ gap: 16 }}>
      <Skeleton width="100%" height={64} borderRadius={16} />
      <View style={[styles.formCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Skeleton width="40%" height={18} borderRadius={6} />
        <Skeleton width="100%" height={48} borderRadius={12} />
        <View style={{ gap: 6 }}>
          <Skeleton width="30%" height={14} borderRadius={4} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} width="22%" height={42} borderRadius={10} />
            ))}
          </View>
        </View>
        <Skeleton width="100%" height={46} borderRadius={12} />
      </View>
      <Skeleton width="100%" height={52} borderRadius={16} />
    </View>
  );
};

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { gap: 16, paddingBottom: 24 },
  geoPillRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  heroCard: { borderRadius: 24, padding: 22, borderWidth: 1 },
  navRow: { gap: 8 },
  navCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, borderRadius: 16, borderWidth: 1 },
  metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metricCard: { width: '48%', flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1 },
  summaryContainer: { gap: 16, paddingHorizontal: 20, paddingTop: 16 },
  kpiRow: { flexDirection: 'row', gap: 8, overflow: 'hidden' },
  kpiCard: { width: 72, borderRadius: 14, borderWidth: 1, padding: 10, alignItems: 'center' },
  calendarBox: { borderRadius: 20, borderWidth: 1, padding: 16 },
  taskCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1 },
  formCard: { borderRadius: 20, borderWidth: 1, padding: 18, gap: 14 },
});
