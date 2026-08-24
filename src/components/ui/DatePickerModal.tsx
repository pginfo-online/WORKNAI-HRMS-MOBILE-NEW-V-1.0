import React, { useState } from 'react';
import { View, Modal, StyleSheet, TouchableOpacity, Text, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors } from '../../constants/colors';

interface Props {
  value: Date;
  mode: 'date' | 'time';
  visible: boolean;
  onConfirm: (date: Date) => void;
  onCancel: () => void;
  maximumDate?: Date;
}

export function DatePickerModal({ value, mode, visible, onConfirm, onCancel, maximumDate }: Props) {
  const [tempDate, setTempDate] = useState(value);

  // Update temp date when modal opens with a new value
  React.useEffect(() => {
    if (visible) setTempDate(value);
  }, [visible, value]);

  if (!visible) return null;

  if (Platform.OS === 'android') {
    return (
      <DateTimePicker
        value={tempDate}
        mode={mode}
        display="default"
        maximumDate={maximumDate}
        onChange={(event, date) => {
          if (event.type === 'set' && date) {
            onConfirm(date);
          } else {
            onCancel();
          }
        }}
      />
    );
  }

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalBg}>
        <View style={styles.modalContent}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={onCancel} style={styles.btn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onConfirm(tempDate)} style={styles.btn}>
              <Text style={styles.doneText}>Done</Text>
            </TouchableOpacity>
          </View>
          <DateTimePicker
            value={tempDate}
            mode={mode}
            display="spinner"
            maximumDate={maximumDate}
            onChange={(event, date) => {
              if (date) setTempDate(date);
            }}
            style={styles.picker}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 30,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  btn: { paddingHorizontal: 10 },
  cancelText: { fontSize: 16, color: '#64748B' },
  doneText: { fontSize: 16, fontWeight: '700', color: colors.primary },
  picker: { width: '100%', height: 216 },
});
