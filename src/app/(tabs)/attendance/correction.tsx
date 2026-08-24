import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as DocumentPicker from 'expo-document-picker';
import Toast from 'react-native-toast-message';
import { useMutation, useQuery } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { attendanceApi } from '../../../api/attendance.api';
import { useUIStore } from '../../../store/ui.store';
import { colors } from '../../../constants/colors';
import { Card } from '../../../components/ui/Card';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { DatePickerModal } from '../../../components/ui/DatePickerModal';

type PickerMode = 'date' | 'time' | null;

export default function CorrectionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ prefillDate?: string }>();
  const { theme } = useUIStore();

  const [selectedDate, setSelectedDate] = useState<Date | null>(
    params.prefillDate ? parseISO(params.prefillDate) : null
  );
  const [requestedInTime, setRequestedInTime] = useState<Date | null>(null);
  const [requestedOutTime, setRequestedOutTime] = useState<Date | null>(null);
  const [reason, setReason] = useState('');
  const [proofImageUri, setProofImageUri] = useState<string | null>(null);

  const [pickerMode, setPickerMode] = useState<PickerMode>(null);
  const [pickerTarget, setPickerTarget] = useState<'date' | 'inTime' | 'outTime'>('date');

  const REASON_MAX = 300;

  // Dynamically fetch the record for the selected date
  const selectedDateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';
  const { data: recordData, isLoading: recordLoading } = useQuery({
    queryKey: ['attendance-record', selectedDateStr],
    queryFn: () => attendanceApi.getMySummary({ from: selectedDateStr, to: selectedDateStr, limit: 1 })
      .then(res => res.data.data?.records?.[0] || null),
    enabled: !!selectedDateStr,
  });

  const openPicker = (target: typeof pickerTarget, mode: PickerMode) => {
    setPickerTarget(target);
    setPickerMode(mode);
  };

  const handleConfirmPicker = (date: Date) => {
    setPickerMode(null);
    if (pickerTarget === 'date') {
      setSelectedDate(date);
      setRequestedInTime(null);
      setRequestedOutTime(null);
    } else if (pickerTarget === 'inTime') {
      setRequestedInTime(date);
    } else {
      setRequestedOutTime(date);
    }
  };

  const handlePickImage = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.[0]?.uri) {
        setProofImageUri(result.assets[0].uri);
        Haptics.selectionAsync();
      }
    } catch (err) {
      console.log('Document pick error', err);
    }
  };

  const correctionMutation = useMutation({
    mutationFn: async () => {
      const attendanceId = recordData?.record?._id;
      if (!attendanceId) throw new Error('Cannot request correction — no attendance record for this date.');

      if (requestedInTime && requestedOutTime && requestedInTime > requestedOutTime) {
        throw new Error('Check-Out time cannot be earlier than Check-In time.');
      }

      await attendanceApi.requestCorrection({
        attendanceId,
        requestedInTime: requestedInTime?.toISOString(),
        requestedOutTime: requestedOutTime?.toISOString(),
        correctionReason: reason.trim(),
      });
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Toast.show({
        type: 'success',
        text1: 'Correction Submitted ✓',
        text2: 'Your request has been sent to HR for review.',
      });
      setSelectedDate(null);
      setRequestedInTime(null);
      setRequestedOutTime(null);
      setReason('');
      setProofImageUri(null);
    },
    onError: (err: any) => {
      Toast.show({
        type: 'error',
        text1: 'Submission Failed',
        text2: err.message || err.response?.data?.message || 'Could not submit correction request.',
      });
    }
  });

  const handleSubmit = () => {
    if (!selectedDate) return Toast.show({ type: 'error', text1: 'Select a Date' });
    if (!reason.trim() || reason.trim().length < 10) return Toast.show({ type: 'error', text1: 'Reason Required', text2: 'Please be more specific (min 10 characters).' });
    correctionMutation.mutate();
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader
        title="Attendance Correction"
        subtitle="Request a time correction for HR review"
        showBack
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Info Banner */}
          <View style={[styles.infoBanner, { backgroundColor: 'rgba(32,118,199,0.08)', borderColor: 'rgba(32,118,199,0.2)' }]}>
            <Ionicons name="information-circle" size={20} color={colors.primary} />
            <Text style={[styles.infoText, { color: theme.textSecondary }]}>
              Corrections are reviewed by HR. Select the date, specify corrected times, and provide a clear reason.
            </Text>
          </View>

          {/* Step 1: Select Date */}
          <Card style={styles.stepCard}>
            <View style={styles.stepHeader}>
              <View style={[styles.stepNum, { backgroundColor: colors.primary }]}>
                <Text style={styles.stepNumText}>1</Text>
              </View>
              <Text style={[styles.stepTitle, { color: theme.text }]}>Select Date to Correct</Text>
            </View>

            <TouchableOpacity
              onPress={() => openPicker('date', 'date')}
              style={[styles.picker, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
            >
              <Ionicons name="calendar-outline" size={18} color={selectedDate ? colors.primary : theme.textTertiary} />
              <Text style={[styles.pickerText, { color: selectedDate ? theme.text : theme.textTertiary }]}>
                {selectedDate ? format(selectedDate, 'EEEE, dd MMM yyyy') : 'Tap to select date'}
              </Text>
              <Ionicons name="chevron-down" size={16} color={theme.textTertiary} />
            </TouchableOpacity>

            {selectedDate && (
              <View style={[styles.currentRecord, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
                <Text style={[styles.currentRecordLabel, { color: theme.textSecondary }]}>Current Record</Text>
                {recordLoading ? (
                  <ActivityIndicator color={colors.primary} style={{ alignSelf: 'flex-start', marginTop: 4 }} />
                ) : (
                  <Text style={[styles.currentRecordValue, { color: theme.text }]}>
                    {recordData?.record?.inTime ? format(new Date(recordData.record.inTime), 'hh:mm a') : 'No Check-In'}
                    {recordData?.record?.outTime ? ` – ${format(new Date(recordData.record.outTime), 'hh:mm a')}` : ' – No Check-Out'}
                    {!recordData?.record?.inTime && !recordData?.record?.outTime && ' (No Data)'}
                  </Text>
                )}
              </View>
            )}
          </Card>

          {/* Step 2: Correct Times */}
          <Card style={styles.stepCard}>
            <View style={styles.stepHeader}>
              <View style={[styles.stepNum, { backgroundColor: selectedDate ? colors.primary : theme.border }]}>
                <Text style={styles.stepNumText}>2</Text>
              </View>
              <Text style={[styles.stepTitle, { color: theme.text }]}>Corrected Check-In / Check-Out</Text>
            </View>
            <Text style={[styles.stepHint, { color: theme.textTertiary }]}>
              Leave blank if you only need to correct one time.
            </Text>

            <View style={styles.timeRow}>
              <TouchableOpacity
                onPress={() => selectedDate && openPicker('inTime', 'time')}
                disabled={!selectedDate}
                style={[styles.timePicker, { backgroundColor: theme.surfaceAlt, borderColor: requestedInTime ? colors.primary : theme.border, opacity: selectedDate ? 1 : 0.4 }]}
              >
                <Ionicons name="log-in-outline" size={16} color={requestedInTime ? colors.primary : theme.textTertiary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.timePickerLabel, { color: theme.textTertiary }]}>Check-In</Text>
                  <Text style={[styles.timePickerValue, { color: requestedInTime ? theme.text : theme.textTertiary }]}>
                    {requestedInTime ? format(requestedInTime, 'hh:mm a') : 'Select time'}
                  </Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => selectedDate && openPicker('outTime', 'time')}
                disabled={!selectedDate}
                style={[styles.timePicker, { backgroundColor: theme.surfaceAlt, borderColor: requestedOutTime ? colors.primary : theme.border, opacity: selectedDate ? 1 : 0.4 }]}
              >
                <Ionicons name="log-out-outline" size={16} color={requestedOutTime ? colors.primary : theme.textTertiary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.timePickerLabel, { color: theme.textTertiary }]}>Check-Out</Text>
                  <Text style={[styles.timePickerValue, { color: requestedOutTime ? theme.text : theme.textTertiary }]}>
                    {requestedOutTime ? format(requestedOutTime, 'hh:mm a') : 'Select time'}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </Card>

          {/* Step 3: Reason */}
          <Card style={styles.stepCard}>
            <View style={styles.stepHeader}>
              <View style={[styles.stepNum, { backgroundColor: reason.length >= 10 ? colors.primary : theme.border }]}>
                <Text style={styles.stepNumText}>3</Text>
              </View>
              <Text style={[styles.stepTitle, { color: theme.text }]}>Reason for Correction *</Text>
            </View>
            <TextInput
              style={[styles.reasonInput, { backgroundColor: theme.surfaceAlt, color: theme.text, borderColor: theme.border }]}
              placeholder="Describe why you need this correction (e.g., forgot to check out, system error, etc.)"
              placeholderTextColor={theme.textTertiary}
              value={reason}
              onChangeText={(t) => setReason(t.slice(0, REASON_MAX))}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <Text style={[styles.charCount, { color: reason.length > REASON_MAX * 0.8 ? colors.warning : theme.textTertiary }]}>
              {reason.length}/{REASON_MAX}
            </Text>
          </Card>

          {/* Step 4: Optional Proof */}
          <Card style={styles.stepCard}>
            <View style={styles.stepHeader}>
              <View style={[styles.stepNum, { backgroundColor: proofImageUri ? colors.primary : theme.border }]}>
                <Text style={styles.stepNumText}>4</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.stepTitle, { color: theme.text }]}>Attach Proof (Optional)</Text>
                <Text style={[styles.stepHint, { color: theme.textTertiary }]}>Photo of email, ID card scan, or other evidence</Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={handlePickImage}
              style={[styles.proofBtn, { borderColor: theme.border, backgroundColor: theme.surfaceAlt }]}
            >
              <Ionicons name={proofImageUri ? 'checkmark-circle' : 'image-outline'} size={20} color={proofImageUri ? colors.success : theme.textTertiary} />
              <Text style={[styles.proofBtnText, { color: proofImageUri ? colors.success : theme.textSecondary }]}>
                {proofImageUri ? 'Document Attached ✓ (tap to change)' : 'Tap to attach photo or PDF proof'}
              </Text>
            </TouchableOpacity>
          </Card>

          {/* Submit */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={correctionMutation.isPending || recordLoading}
            style={[
              styles.submitBtn,
              { backgroundColor: colors.primary, opacity: correctionMutation.isPending || recordLoading ? 0.7 : 1 },
            ]}
          >
            {correctionMutation.isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="send-outline" size={18} color="#FFFFFF" />
                <Text style={styles.submitText}>Submit Correction Request</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <DatePickerModal
        visible={!!pickerMode}
        mode={pickerMode as any || 'date'}
        value={
          pickerTarget === 'date' ? (selectedDate || new Date()) :
          pickerTarget === 'inTime' ? (requestedInTime || new Date()) :
          (requestedOutTime || new Date())
        }
        onConfirm={handleConfirmPicker}
        onCancel={() => setPickerMode(null)}
        maximumDate={pickerTarget === 'date' ? new Date() : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, gap: 16, paddingBottom: 50 },
  infoBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 16, borderWidth: 1 },
  infoText: { flex: 1, fontSize: 13, lineHeight: 18 },
  stepCard: { padding: 16, gap: 12 },
  stepHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepNum: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  stepTitle: { fontSize: 15, fontWeight: '800', flex: 1 },
  stepHint: { fontSize: 12, marginLeft: 38 },
  picker: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 50, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14 },
  pickerText: { flex: 1, fontSize: 14, fontWeight: '600' },
  currentRecord: { borderRadius: 12, borderWidth: 1, padding: 12 },
  currentRecordLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  currentRecordValue: { fontSize: 15, fontWeight: '800', marginTop: 2 },
  timeRow: { flexDirection: 'row', gap: 10 },
  timePicker: { flex: 1, borderRadius: 14, borderWidth: 1, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  timePickerLabel: { fontSize: 11, fontWeight: '600' },
  timePickerValue: { fontSize: 14, fontWeight: '700' },
  reasonInput: { borderRadius: 14, borderWidth: 1, padding: 14, fontSize: 14, minHeight: 100 },
  charCount: { fontSize: 11, fontWeight: '600', alignSelf: 'flex-end' },
  proofBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed', padding: 16, justifyContent: 'center' },
  proofBtnText: { fontSize: 13, fontWeight: '600' },
  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 54, borderRadius: 18 },
  submitText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});
