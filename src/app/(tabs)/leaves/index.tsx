import React from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { leaveApi } from '../../../api/leave.api';
import { useUIStore } from '../../../store/ui.store';
import { colors } from '../../../constants/colors';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { format } from 'date-fns';

export default function LeaveDashboardScreen() {
  const router = useRouter();
  const { theme } = useUIStore();

  const { data: balance, refetch: refetchBalance, isRefetching } = useQuery({
    queryKey: ['my-leave-balance'],
    queryFn: () => leaveApi.getMyBalance().then((res) => res.data.data),
  });

  const { data: leavesData, refetch: refetchLeaves } = useQuery({
    queryKey: ['my-leaves-recent'],
    queryFn: () => leaveApi.getMyLeaves({ limit: 5 }).then((res) => res.data.data),
  });

  const recentLeaves = leavesData?.leaves || [];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader
        title="Leave Portal"
        rightAction={
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/leaves/history' as any)}
            style={styles.historyBtn}
          >
            <Ionicons name="time-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
        }
      />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => {
              refetchBalance();
              refetchLeaves();
            }}
          />
        }
      >
        {/* Balances Card Grid */}
        <View style={styles.grid}>
          <Card style={styles.cardItem}>
            <View style={[styles.iconBox, { backgroundColor: '#DCFCE7' }]}>
              <Ionicons name="shield-checkmark" size={20} color="#15803D" />
            </View>
            <Text style={[styles.cardTitle, { color: theme.textSecondary }]}>Paid Leave</Text>
            <Text style={[styles.cardVal, { color: theme.text }]}>
              {balance?.paidLeaveBalance ?? 0}
              <Text style={[styles.cardUnit, { color: theme.textTertiary }]}> days</Text>
            </Text>
          </Card>

          <Card style={styles.cardItem}>
            <View style={[styles.iconBox, { backgroundColor: '#DBEAFE' }]}>
              <Ionicons name="timer" size={20} color="#1D4ED8" />
            </View>
            <Text style={[styles.cardTitle, { color: theme.textSecondary }]}>Comp-Off</Text>
            <Text style={[styles.cardVal, { color: theme.text }]}>
              {balance?.compOffBalance ?? 0}
              <Text style={[styles.cardUnit, { color: theme.textTertiary }]}> days</Text>
            </Text>
          </Card>
        </View>

        {/* Apply CTA Banner */}
        <Card style={styles.applyBanner}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[styles.bannerTitle, { color: theme.text }]}>Planning Time Off?</Text>
            <Text style={[styles.bannerSub, { color: theme.textSecondary }]}>
              Submit a leave request for manager and HR approval
            </Text>
          </View>
          <Button
            title="Apply"
            onPress={() => router.push('/(tabs)/leaves/apply' as any)}
            variant="gradient"
            size="sm"
          />
        </Card>

        {/* Recent Applications */}
        <View style={styles.recentSection}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionHeading, { color: theme.text }]}>Recent Applications</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/leaves/history' as any)}>
              <Text style={styles.viewAllText}>View All →</Text>
            </TouchableOpacity>
          </View>

          {recentLeaves.length === 0 ? (
            <Card style={styles.emptyCard}>
              <Ionicons name="calendar-outline" size={32} color={theme.textTertiary} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                No recent leave applications
              </Text>
            </Card>
          ) : (
            recentLeaves.map((l: any) => {
              const variant =
                l.overallStatus === 'Approved'
                  ? 'success'
                  : l.overallStatus === 'Pending'
                  ? 'warning'
                  : l.overallStatus === 'Rejected'
                  ? 'error'
                  : 'neutral';

              return (
                <Card key={l._id} style={styles.leaveItem}>
                  <View style={styles.leaveHeader}>
                    <View>
                      <Text style={[styles.leaveType, { color: theme.text }]}>{l.leaveType} Leave</Text>
                      <Text style={[styles.leaveDates, { color: theme.textSecondary }]}>
                        {format(new Date(l.startDate), 'dd MMM')}
                        {l.endDate ? ` – ${format(new Date(l.endDate), 'dd MMM yyyy')}` : ''}
                        {' · '}
                        {l.totalDays} day{l.totalDays > 1 ? 's' : ''}
                      </Text>
                    </View>
                    <Badge label={l.overallStatus} variant={variant} />
                  </View>
                  {l.reason && (
                    <Text style={[styles.leaveReason, { color: theme.textTertiary }]} numberOfLines={1}>
                      "{l.reason}"
                    </Text>
                  )}
                </Card>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    gap: 20,
  },
  historyBtn: {
    padding: 6,
  },
  grid: {
    flexDirection: 'row',
    gap: 12,
  },
  cardItem: {
    flex: 1,
    padding: 16,
    gap: 8,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardVal: {
    fontSize: 22,
    fontWeight: '800',
  },
  cardUnit: {
    fontSize: 13,
    fontWeight: '600',
  },
  applyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    gap: 16,
  },
  bannerTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  bannerSub: {
    fontSize: 12,
  },
  recentSection: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  emptyCard: {
    padding: 32,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '500',
  },
  leaveItem: {
    padding: 14,
    gap: 6,
  },
  leaveHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leaveType: {
    fontSize: 15,
    fontWeight: '700',
  },
  leaveDates: {
    fontSize: 12,
    marginTop: 2,
  },
  leaveReason: {
    fontSize: 12,
    fontStyle: 'italic',
  },
});
