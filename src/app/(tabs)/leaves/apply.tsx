import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import * as Haptics from 'expo-haptics';
import { leaveApi } from '../../../api/leave.api';
import { useUIStore } from '../../../store/ui.store';
import { colors } from '../../../constants/colors';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { format } from 'date-fns';

export default function ApplyLeaveScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const { theme } = useUIStore();

  const [leaveType, setLeaveType] = useState<'Paid' | 'CompOff' | 'Unpaid'>('Paid');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [halfDay, setHalfDay] = useState(false);
  const [halfDayPeriod, setHalfDayPeriod] = useState<'FirstHalf' | 'SecondHalf'>('FirstHalf');
  const [reason, setReason] = useState('');

  const applyMutation = useMutation({
    mutationFn: (data: any) => leaveApi.apply(data),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Toast.show({
        type: 'success',
        text1: 'Leave Applied!',
        text2: 'Your request has been submitted for approval.',
      });
      qc.invalidateQueries({ queryKey: ['my-leaves-recent'] });
      qc.invalidateQueries({ queryKey: ['my-leaves-history'] });
      qc.invalidateQueries({ queryKey: ['my-leave-balance'] });
      router.back();
    },
    onError: (err: any) => {
      Toast.show({
        type: 'error',
        text1: 'Submission Failed',
        text2: err.response?.data?.message || 'Failed to apply leave',
      });
    },
  });

  const handleSubmit = () => {
    if (!reason.trim()) {
      return Toast.show({
        type: 'error',
        text1: 'Reason Required',
        text2: 'Please describe the reason for your leave request.',
      });
    }

    applyMutation.mutate({
      leaveType,
      startDate,
      endDate: halfDay ? startDate : endDate,
      halfDay,
      halfDayPeriod: halfDay ? halfDayPeriod : undefined,
      reason: reason.trim(),
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader title="Apply Leave" subtitle="Request scheduled time off" showBack />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Leave Type Selector */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Leave Type</Text>
          <View style={styles.typeGrid}>
            {(['Paid', 'CompOff', 'Unpaid'] as const).map((type) => (
              <TouchableOpacity
                key={type}
                onPress={() => {
                  Haptics.selectionAsync();
                  setLeaveType(type);
                }}
                style={[
                  styles.typeBtn,
                  {
                    backgroundColor: leaveType === type ? colors.primary : theme.surface,
                    borderColor: leaveType === type ? colors.primary : theme.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.typeBtnText,
                    { color: leaveType === type ? '#FFFFFF' : theme.text },
                  ]}
                >
                  {type === 'CompOff' ? 'Comp-Off' : type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Half Day Toggle */}
        <Card style={styles.toggleCard}>
          <View>
            <Text style={[styles.toggleTitle, { color: theme.text }]}>Half Day Request</Text>
            <Text style={[styles.toggleSub, { color: theme.textSecondary }]}>
              Applies to 0.5 days of working hours
            </Text>
          </View>
          <Switch
            value={halfDay}
            onValueChange={setHalfDay}
            trackColor={{ false: theme.border, true: colors.primary }}
          />
        </Card>

        {/* Dates */}
        <Card style={styles.dateCard}>
          <View style={styles.dateRow}>
            <View style={styles.dateCol}>
              <Text style={[styles.dateLabel, { color: theme.textTertiary }]}>Start Date (YYYY-MM-DD)</Text>
              <TextInput
                value={startDate}
                onChangeText={setStartDate}
                style={[styles.dateInput, { backgroundColor: theme.surfaceAlt, color: theme.text, borderColor: theme.border }]}
              />
            </View>

            {!halfDay && (
              <View style={styles.dateCol}>
                <Text style={[styles.dateLabel, { color: theme.textTertiary }]}>End Date (YYYY-MM-DD)</Text>
                <TextInput
                  value={endDate}
                  onChangeText={setEndDate}
                  style={[styles.dateInput, { backgroundColor: theme.surfaceAlt, color: theme.text, borderColor: theme.border }]}
                />
              </View>
            )}
          </View>
        </Card>

        {/* Reason Text */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Reason for Leave</Text>
          <TextInput
            placeholder="Please provide context for your leave request..."
            placeholderTextColor={theme.textTertiary}
            multiline
            numberOfLines={4}
            value={reason}
            onChangeText={setReason}
            style={[
              styles.reasonInput,
              { backgroundColor: theme.surface, color: theme.text, borderColor: theme.border },
            ]}
          />
        </View>

        {/* Submit */}
        <Button
          title="Submit Application"
          onPress={handleSubmit}
          variant="gradient"
          size="lg"
          loading={applyMutation.isPending}
        />
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
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  typeGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  typeBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  toggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  toggleTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  toggleSub: {
    fontSize: 12,
    marginTop: 2,
  },
  dateCard: {
    padding: 16,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dateCol: {
    flex: 1,
    gap: 6,
  },
  dateLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  dateInput: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '600',
  },
  reasonInput: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    fontSize: 14,
    textAlignVertical: 'top',
  },
});
