import React, { useState, useRef, useEffect } from 'react';
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
import { useMutation, useQuery } from '@tanstack/react-query';
import { safeFormat } from '../../../utils/dateUtils';
import { attendanceApi } from '../../../api/attendance.api';
import { useUIStore } from '../../../store/ui.store';
import { useAttendanceFeedback } from '../../../hooks/useAttendanceFeedback';
import { colors } from '../../../constants/colors';
import { Card } from '../../../components/ui/Card';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { DatePickerModal } from '../../../components/ui/DatePickerModal';
import { Skeleton } from '../../../components/ui/Skeleton';
import { AttendanceFeedback } from '../../../components/ui/AttendanceFeedback';
import { ErrorBoundary } from '../../../components/ErrorBoundary';

type PickerMode = 'date' | 'time' | null;
type TargetStatus = 'P' | 'Half' | 'Coff';

const STATUS_OPTIONS: { id: TargetStatus; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'P', label: 'Present (Full Day)', icon: 'checkmark-circle' },
  { id: 'Half', label: 'Half Day', icon: 'time' },
  { id: 'Coff', label: 'Comp-Off (Holiday / Off)', icon: 'calendar' },
];

function CorrectionContent() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    prefillDate?: string;
    correctionId?: string;
    prefillReason?: string;
    prefillStatus?: TargetStatus;
    prefillInTime?: string;
    prefillOutTime?: string;
  }>();
  const isEditing = Boolean(params.correctionId);
  const { theme, isDark } = useUIStore();
  const { feedbackState, showFeedback, hideFeedback } = useAttendanceFeedback();

  const [selectedDate, setSelectedDate] = useState<Date | null>(() => {
    if (params.prefillDate) {
      const parsed = new Date(params.prefillDate);
      return isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
  });
  const [requestedStatus, setRequestedStatus] = useState<TargetStatus>(params.prefillStatus || 'P');
  const [requestedInTime, setRequestedInTime] = useState<Date | null>(() => {
    if (params.prefillInTime) {
      const parsed = new Date(params.prefillInTime);
      return isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
  });
  const [requestedOutTime, setRequestedOutTime] = useState<Date | null>(() => {
    if (params.prefillOutTime) {
      const parsed = new Date(params.prefillOutTime);
      return isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
  });
  const [reason, setReason] = useState(params.prefillReason || '');
  const [proofImageUri, setProofImageUri] = useState<string | null>(null);

  const [pickerMode, setPickerMode] = useState<PickerMode>(null);
  const [pickerTarget, setPickerTarget] = useState<'date' | 'inTime' | 'outTime'>('date');

  // Double-submit guard
  const isSubmittingRef = useRef(false);

  const REASON_MAX = 300;

  const selectedDateStr = selectedDate ? safeFormat(selectedDate, 'yyyy-MM-dd', '') : '';
  
  const { data: todayData } = useQuery({
    queryKey: ['today-status'],
    queryFn: () => attendanceApi.getToday().then((res) => res.data.data),
  });
  const office = todayData?.office;

  const { data: recordData, isLoading: recordLoading } = useQuery({
    queryKey: ['attendance-record', selectedDateStr],
    queryFn: () =>
      attendanceApi.getMySummary({ from: selectedDateStr, to: selectedDateStr, limit: 1 })
        .then(res => res.data.data?.records?.[0] || null),
    enabled: !!selectedDateStr,
  });

  const parseConfigTime = (timeStr?: string, defaultHour = 9, defaultMinute = 30) => {
    if (!timeStr) return { hour: defaultHour, minute: defaultMinute };
    const [h, m] = timeStr.split(':').map(Number);
    return { hour: isNaN(h) ? defaultHour : h, minute: isNaN(m) ? defaultMinute : m };
  };

  // Auto-set default times and status based on selected date and dynamic office timing
  useEffect(() => {
    if (selectedDate) {
      if (recordData?.isHoliday) {
        setRequestedStatus('Coff');
      }
      const inCfg = parseConfigTime(office?.checkInTime, 9, 30);
      const outCfg = parseConfigTime(office?.checkOutTime, 18, 30);

      if (!requestedInTime) {
        const dIn = new Date(selectedDate);
        dIn.setHours(inCfg.hour, inCfg.minute, 0, 0);
        setRequestedInTime(dIn);
      }
      if (!requestedOutTime) {
        const dOut = new Date(selectedDate);
        dOut.setHours(outCfg.hour, outCfg.minute, 0, 0);
        setRequestedOutTime(dOut);
      }
    }
  }, [selectedDate, recordData, office]);

  const openPicker = (target: typeof pickerTarget, mode: PickerMode) => {
    setPickerTarget(target);
    setPickerMode(mode);
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets?.[0]) {
        setProofImageUri(result.assets[0].uri);
        showFeedback({ message: 'Proof Document Attached', variant: 'success', duration: 2000 });
      }
    } catch {
      showFeedback({ message: 'Could not pick document', variant: 'error' });
    }
  };

  const handleDateConfirm = (date: Date) => {
    const inCfg = parseConfigTime(office?.checkInTime, 9, 30);
    const outCfg = parseConfigTime(office?.checkOutTime, 18, 30);

    if (pickerTarget === 'date') {
      setSelectedDate(date);
      const dIn = new Date(date);
      dIn.setHours(inCfg.hour, inCfg.minute, 0, 0);
      setRequestedInTime(dIn);

      const dOut = new Date(date);
      dOut.setHours(outCfg.hour, outCfg.minute, 0, 0);
      setRequestedOutTime(dOut);
    } else if (pickerTarget === 'inTime') {
      setRequestedInTime(date);
    } else if (pickerTarget === 'outTime') {
      setRequestedOutTime(date);
    }
    setPickerMode(null);
  };

  const correctionMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDate) throw new Error('NO_DATE');
      if (isEditing && params.correctionId) {
        await attendanceApi.editCorrection(params.correctionId, {
          requestedStatus,
          requestedInTime: requestedInTime?.toISOString(),
          requestedOutTime: requestedOutTime?.toISOString(),
          correctionReason: reason.trim(),
          correctionProofUrl: proofImageUri || undefined,
        });
      } else {
        await attendanceApi.requestCorrection({
          attendanceId: recordData?.record?._id || undefined,
          date: selectedDateStr,
          requestedStatus,
          requestedInTime: requestedInTime?.toISOString(),
          requestedOutTime: requestedOutTime?.toISOString(),
          correctionReason: reason.trim(),
          correctionProofUrl: proofImageUri || undefined,
        });
      }
    },
    onSuccess: () => {
      isSubmittingRef.current = false;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showFeedback({
        message: isEditing ? 'Correction Updated ✓' : 'Correction Submitted ✓',
        subMessage: isEditing
          ? 'Your updated request has been submitted for HR review.'
          : 'Your request has been submitted for HR review. Returning...',
        variant: 'success',
        duration: 2500,
      });
      setSelectedDate(null);
      setRequestedInTime(null);
      setRequestedOutTime(null);
      setReason('');
      setProofImageUri(null);

      // Auto-navigate back after 2s
      setTimeout(() => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/(tabs)/attendance');
        }
      }, 2000);
    },
    onError: (err: any) => {
      isSubmittingRef.current = false;
      showFeedback({
        message: 'Submission Failed',
        subMessage: err.response?.data?.message || err.message || 'Could not submit correction request.',
        variant: 'error',
      });
    },
  });

  const handleSubmit = () => {
    if (isSubmittingRef.current || correctionMutation.isPending) return;

    if (!selectedDate) {
      showFeedback({ message: 'Please Select a Date', variant: 'warning' });
      return;
    }
    if (!reason.trim() || reason.trim().length < 5) {
      showFeedback({ message: 'Reason Required', subMessage: 'Please provide a clear reason for the correction.', variant: 'warning' });
      return;
    }

    isSubmittingRef.current = true;
    correctionMutation.mutate();
  };

  const dayStatusLabel = recordData
    ? recordData.isHoliday
      ? `Holiday: ${recordData.holidayName || 'Official Holiday'}`
      : recordData.isWeekOff
      ? 'Week Off'
      : recordData.dayStatus === 'A'
      ? 'Absent'
      : recordData.dayStatus === 'P'
      ? 'Present'
      : recordData.dayStatus === 'Half'
      ? 'Half Day'
      : recordData.dayStatus || 'No Record'
    : 'No Record';

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader
        title={isEditing ? 'Edit Correction' : 'Attendance Correction'}
        subtitle={isEditing ? 'Update pending request details' : 'Request correction for Absent, Holiday, or Log issues'}
        showBack
      />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
              Corrections are reviewed by HR. Select the date, choose your target attendance status, specify times, and provide a reason.
            </Text>
          </View>

          {/* Step 1: Select Date */}
          <Card style={styles.stepCard}>
            <Text style={[styles.stepTitle, { color: theme.text }]}>1. Select Target Date *</Text>
            <TouchableOpacity
              onPress={() => openPicker('date', 'date')}
              style={[styles.picker, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
            >
              <Ionicons name="calendar-outline" size={18} color={selectedDate ? colors.primary : theme.textTertiary} />
              <Text style={[styles.pickerText, { color: selectedDate ? theme.text : theme.textTertiary }]}>
                {selectedDate ? safeFormat(selectedDate, 'EEEE, dd MMM yyyy') : 'Tap to select date'}
              </Text>
              <Ionicons name="chevron-down" size={16} color={theme.textTertiary} />
            </TouchableOpacity>

            {selectedDate && (
              <View style={[styles.currentRecord, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
                <View style={styles.recordStatusRow}>
                  <Text style={[styles.currentRecordLabel, { color: theme.textSecondary }]}>Current System Status</Text>
                  <View
                    style={[
                      styles.statusChip,
                      {
                        backgroundColor: recordData?.dayStatus === 'P'
                          ? 'rgba(16,185,129,0.12)'
                          : recordData?.isHoliday
                          ? 'rgba(219,39,119,0.12)'
                          : 'rgba(239,68,68,0.12)',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusChipText,
                        {
                          color: recordData?.dayStatus === 'P'
                            ? '#10B981'
                            : recordData?.isHoliday
                            ? '#DB2777'
                            : '#EF4444',
                        },
                      ]}
                    >
                      {dayStatusLabel}
                    </Text>
                  </View>
                </View>

                {recordLoading ? (
                  <View style={{ gap: 4, marginTop: 4 }}>
                    <Skeleton width="60%" height={16} borderRadius={4} />
                  </View>
                ) : (
                  <View style={{ gap: 2, marginTop: 4 }}>
                    <Text style={[styles.currentRecordValue, { color: theme.text }]}>
                      {recordData?.record?.inTime ? safeFormat(recordData.record.inTime, 'hh:mm a') : 'No Check-In'}
                      {recordData?.record?.outTime ? ` – ${safeFormat(recordData.record.outTime, 'hh:mm a')}` : ' – No Check-Out'}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </Card>

          {/* Step 2: Target Status Selector */}
          <Card style={styles.stepCard}>
            <Text style={[styles.stepTitle, { color: theme.text }]}>2. Target Attendance Status *</Text>
            <View style={styles.statusOptionsRow}>
              {STATUS_OPTIONS.map((opt) => {
                const isSelected = requestedStatus === opt.id;
                return (
                  <TouchableOpacity
                    key={opt.id}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setRequestedStatus(opt.id);
                    }}
                    style={[
                      styles.statusOptionBtn,
                      {
                        backgroundColor: isSelected
                          ? isDark
                            ? 'rgba(32,118,199,0.25)'
                            : 'rgba(32,118,199,0.1)'
                          : theme.surfaceAlt,
                        borderColor: isSelected ? colors.primary : theme.border,
                      },
                    ]}
                  >
                    <Ionicons
                      name={opt.icon}
                      size={16}
                      color={isSelected ? colors.primary : theme.textTertiary}
                    />
                    <Text
                      style={[
                        styles.statusOptionText,
                        {
                          color: isSelected ? colors.primary : theme.textSecondary,
                          fontWeight: isSelected ? '800' : '600',
                        },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Card>

          {/* Step 3: Requested Times */}
          <Card style={styles.stepCard}>
            <Text style={[styles.stepTitle, { color: theme.text }]}>3. Requested Correct Times *</Text>
            <View style={styles.timeRow}>
              <View style={{ flex: 1, gap: 6 }}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Check-In Time</Text>
                <TouchableOpacity
                  onPress={() => openPicker('inTime', 'time')}
                  style={[styles.picker, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
                >
                  <Ionicons name="time-outline" size={18} color={requestedInTime ? colors.primary : theme.textTertiary} />
                  <Text style={[styles.pickerText, { color: requestedInTime ? theme.text : theme.textTertiary }]}>
                    {requestedInTime ? safeFormat(requestedInTime, 'hh:mm a') : (office?.checkInTime || 'Select Time')}
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={{ flex: 1, gap: 6 }}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Check-Out Time</Text>
                <TouchableOpacity
                  onPress={() => openPicker('outTime', 'time')}
                  style={[styles.picker, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
                >
                  <Ionicons name="time-outline" size={18} color={requestedOutTime ? colors.primary : theme.textTertiary} />
                  <Text style={[styles.pickerText, { color: requestedOutTime ? theme.text : theme.textTertiary }]}>
                    {requestedOutTime ? safeFormat(requestedOutTime, 'hh:mm a') : (office?.checkOutTime || 'Select Time')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </Card>

          {/* Step 4: Reason */}
          <Card style={styles.stepCard}>
            <Text style={[styles.stepTitle, { color: theme.text }]}>4. Reason for Correction *</Text>
            <TextInput
              style={[styles.textArea, { backgroundColor: theme.surfaceAlt, color: theme.text, borderColor: theme.border }]}
              placeholder="e.g. Worked on site during holiday, biometric check-in missed..."
              placeholderTextColor={theme.textTertiary}
              value={reason}
              onChangeText={setReason}
              multiline
              numberOfLines={4}
              maxLength={REASON_MAX}
            />
            <Text style={[styles.charCount, { color: theme.textTertiary }]}>
              {reason.length} / {REASON_MAX}
            </Text>
          </Card>

          {/* Step 5: Attach Proof */}
          <Card style={styles.stepCard}>
            <Text style={[styles.stepTitle, { color: theme.text }]}>5. Proof / Attachment (Optional)</Text>
            <TouchableOpacity
              onPress={handlePickDocument}
              style={[styles.uploadBox, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
            >
              <Ionicons name={proofImageUri ? 'checkmark-circle' : 'cloud-upload-outline'} size={24} color={proofImageUri ? colors.success : colors.primary} />
              <Text style={[styles.uploadText, { color: proofImageUri ? colors.success : theme.textSecondary }]}>
                {proofImageUri ? 'Document Attached ✓' : 'Upload photo, email or duty pass'}
              </Text>
            </TouchableOpacity>
          </Card>

          {/* Submit */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={correctionMutation.isPending}
            style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: correctionMutation.isPending ? 0.7 : 1 }]}
          >
            {correctionMutation.isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.submitBtnText}>
                {isEditing ? 'Update Correction Request' : 'Submit Correction Request'}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <DatePickerModal
        visible={pickerMode !== null}
        mode={pickerMode === 'time' ? 'time' : 'date'}
        value={
          pickerTarget === 'inTime'
            ? requestedInTime || new Date()
            : pickerTarget === 'outTime'
            ? requestedOutTime || new Date()
            : selectedDate || new Date()
        }
        onConfirm={handleDateConfirm}
        onCancel={() => setPickerMode(null)}
      />

      <AttendanceFeedback
        visible={feedbackState.visible}
        message={feedbackState.message}
        subMessage={feedbackState.subMessage}
        variant={feedbackState.variant}
        onHide={hideFeedback}
      />
    </View>
  );
}

export default function CorrectionScreen() {
  return (
    <ErrorBoundary>
      <CorrectionContent />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, gap: 16, paddingBottom: 80 },
  infoBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 16, borderWidth: 1 },
  infoText: { flex: 1, fontSize: 12, lineHeight: 16 },
  stepCard: { padding: 18, gap: 12 },
  stepTitle: { fontSize: 15, fontWeight: '800' },
  picker: { flexDirection: 'row', alignItems: 'center', gap: 10, height: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14 },
  pickerText: { flex: 1, fontSize: 14, fontWeight: '600' },
  currentRecord: { padding: 12, borderRadius: 12, borderWidth: 1, marginTop: 4 },
  recordStatusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  currentRecordLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  statusChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  statusChipText: { fontSize: 11, fontWeight: '800' },
  currentRecordValue: { fontSize: 13, fontWeight: '700' },
  statusOptionsRow: { gap: 8 },
  statusOptionBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12, borderWidth: 1 },
  statusOptionText: { fontSize: 13 },
  timeRow: { flexDirection: 'row', gap: 10 },
  fieldLabel: { fontSize: 12, fontWeight: '700' },
  textArea: { borderRadius: 12, borderWidth: 1, padding: 12, fontSize: 14, minHeight: 90, textAlignVertical: 'top' },
  charCount: { fontSize: 11, alignSelf: 'flex-end', fontWeight: '600' },
  uploadBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 52, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed' },
  uploadText: { fontSize: 13, fontWeight: '700' },
  submitBtn: { height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  submitBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});
