import React from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { leaveApi } from '../../../api/leave.api';
import { useUIStore } from '../../../store/ui.store';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { format } from 'date-fns';

export default function LeaveHistoryScreen() {
  const { theme } = useUIStore();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['my-leaves-history'],
    queryFn: () => leaveApi.getMyLeaves({ limit: 50 }).then((res) => res.data.data),
  });

  const leaves = data?.leaves || [];

  const renderItem = ({ item }: { item: any }) => {
    const variant =
      item.overallStatus === 'Approved'
        ? 'success'
        : item.overallStatus === 'Pending'
        ? 'warning'
        : item.overallStatus === 'Rejected'
        ? 'error'
        : 'neutral';

    return (
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <View>
            <Text style={[styles.leaveType, { color: theme.text }]}>{item.leaveType} Leave</Text>
            <Text style={[styles.dates, { color: theme.textSecondary }]}>
              {format(new Date(item.startDate), 'dd MMM yyyy')}
              {item.endDate ? ` – ${format(new Date(item.endDate), 'dd MMM yyyy')}` : ''}
            </Text>
          </View>
          <Badge label={item.overallStatus} variant={variant} />
        </View>

        <View style={[styles.footerRow, { borderTopColor: theme.border }]}>
          <Text style={[styles.daysCount, { color: theme.textSecondary }]}>
            Duration: <Text style={{ color: theme.text, fontWeight: '700' }}>{item.totalDays} day(s)</Text>
          </Text>
          {item.reason && (
            <Text style={[styles.reason, { color: theme.textTertiary }]} numberOfLines={1}>
              {item.reason}
            </Text>
          )}
        </View>
      </Card>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader title="Leave History" subtitle="Full log of your leave requests" showBack />

      <FlatList
        data={leaves}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ color: theme.textSecondary }}>No leave records found</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    padding: 20,
    gap: 12,
  },
  card: {
    padding: 16,
    gap: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leaveType: {
    fontSize: 16,
    fontWeight: '700',
  },
  dates: {
    fontSize: 12,
    marginTop: 2,
  },
  footerRow: {
    paddingTop: 10,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  daysCount: {
    fontSize: 12,
  },
  reason: {
    fontSize: 12,
    fontStyle: 'italic',
    maxWidth: '55%',
  },
  empty: {
    padding: 40,
    alignItems: 'center',
  },
});
