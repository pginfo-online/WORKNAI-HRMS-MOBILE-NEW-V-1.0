import React from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import * as Haptics from 'expo-haptics';
import { leaveApi } from '../../../api/leave.api';
import { useUIStore } from '../../../store/ui.store';
import { colors } from '../../../constants/colors';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { format } from 'date-fns';

export default function LeaveHistoryScreen() {
  const { theme } = useUIStore();
  const qc = useQueryClient();

  const { data, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['my-leaves-history'],
    queryFn: () => leaveApi.getMyLeaves({ limit: 50 }).then((res) => res.data.data),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => leaveApi.cancel(id, 'Cancelled by employee'),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Toast.show({
        type: 'success',
        text1: 'Leave Cancelled',
        text2: 'Your leave request has been cancelled and balance refunded.',
      });
      qc.invalidateQueries({ queryKey: ['my-leaves-history'] });
      qc.invalidateQueries({ queryKey: ['my-leaves-recent'] });
    },
    onError: (err: any) => {
      Toast.show({
        type: 'error',
        text1: 'Cancel Failed',
        text2: err.response?.data?.message || 'Failed to cancel leave',
      });
    },
  });

  const handleCancelPress = (item: any) => {
    Alert.alert(
      'Cancel Leave',
      `Are you sure you want to cancel this ${item.leaveType} leave application?`,
      [
        { text: 'No, Keep', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: () => cancelMutation.mutate(item._id),
        },
      ]
    );
  };

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

    const canCancel = item.overallStatus === 'Pending' || item.overallStatus === 'Approved';

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
          <View style={styles.headerRight}>
            <Badge label={item.overallStatus} variant={variant} />
            {canCancel && (
              <TouchableOpacity
                onPress={() => handleCancelPress(item)}
                style={styles.cancelBtn}
                disabled={cancelMutation.isPending}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            )}
          </View>
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
      <ScreenHeader title="Leave History"/>

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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cancelBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#FEE2E2',
  },
  cancelBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#DC2626',
  },
});
