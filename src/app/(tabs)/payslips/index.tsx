import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import Toast from 'react-native-toast-message';
import { payrollApi } from '../../../api/payroll.api';
import { useUIStore } from '../../../store/ui.store';
import { colors } from '../../../constants/colors';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Skeleton } from '../../../components/ui/Skeleton';
import { MonthYearPicker } from '../../../components/ui/MonthYearPicker';

export default function PayslipsScreen() {
  const { theme, isDark } = useUIStore();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [selectedPayslip, setSelectedPayslip] = useState<any | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const selectedYear = selectedDate.getFullYear();
  const selectedMonth = selectedDate.getMonth() + 1; // 1-12

  const {
    data: payslips = [],
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['my-payslips', selectedYear],
    queryFn: () =>
      payrollApi.getMyPayslips({ year: selectedYear }).then((res) => res.data.data.payrolls || []),
  });

  // Filter payslips by selected month if present
  const filteredPayslips = payslips.filter((p: any) => p.month === selectedMonth);

  const handleDownload = async (item: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setDownloadingId(item._id);

    try {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const fileName = `SalarySlip_${monthNames[item.month - 1] || 'Month'}_${item.year}.pdf`;
      const docDir = (FileSystem as any).documentDirectory || (FileSystem as any).cacheDirectory || '';
      const fileUri = `${docDir}${fileName}`;

      let downloaded = false;
      // 1. If stored on Cloudinary, try download directly via Expo FileSystem
      if (item.salarySlipUrl) {
        try {
          const downloadRes = await FileSystem.downloadAsync(item.salarySlipUrl, fileUri);
          if (downloadRes.status === 200) {
            downloaded = true;
          } else {
            console.warn(`Cloudinary download returned status ${downloadRes.status}, falling back to backend endpoint.`);
          }
        } catch (cdnErr: any) {
          console.warn('Direct Cloudinary download failed, falling back to backend:', cdnErr?.message || cdnErr);
        }
      }

      if (!downloaded) {
        // 2. Fallback: fetch from backend endpoint
        const res = await payrollApi.downloadPayslip(item._id);
        if (typeof res.data === 'string') {
          await FileSystem.writeAsStringAsync(fileUri, res.data, {
            encoding: FileSystem.EncodingType.UTF8,
          });
        } else {
          const reader = new FileReader();
          reader.readAsDataURL(res.data);
          await new Promise((resolve) => {
            reader.onloadend = async () => {
              const base64data = (reader.result as string).split(',')[1];
              await FileSystem.writeAsStringAsync(fileUri, base64data, {
                encoding: FileSystem.EncodingType.Base64,
              });
              resolve(true);
            };
          });
        }
      }

      Toast.show({
        type: 'success',
        text1: 'Payslip Saved ✓',
        text2: `Saved ${fileName}`,
      });

      // Open share/save sheet
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/pdf',
          dialogTitle: `Save ${fileName}`,
        });
      }
    } catch (err: any) {
      console.error('[Payslip Download Error]', err);
      Toast.show({
        type: 'error',
        text1: 'Download Failed',
        text2: 'Could not download or open payslip.',
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const openBreakdown = (item: any) => {
    Haptics.selectionAsync();
    setSelectedPayslip(item);
    setModalVisible(true);
  };

  const renderPayslipCard = ({ item }: { item: any }) => {
    const isDownloading = downloadingId === item._id;
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthName = monthNames[item.month - 1] || `Month ${item.month}`;

    return (
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconBg, { backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : '#e0e7ff' }]}>
            <Ionicons name="receipt" size={22} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.periodText, { color: theme.text }]}>
              {monthName} {item.year}
            </Text>
            <Text style={[styles.metaText, { color: theme.textSecondary }]}>
              {item.paidDays} / {item.totalDaysInMonth || 30} Paid Days
            </Text>
          </View>
          <Badge label={item.status || 'Processed'} variant="success" />
        </View>

        {/* Salary Stats Bento Row */}
        <View style={[styles.salaryRow, { backgroundColor: theme.surfaceAlt }]}>
          <View style={styles.salaryCol}>
            <Text style={[styles.salaryLabel, { color: theme.textTertiary }]}>Gross Salary</Text>
            <Text style={[styles.salaryVal, { color: theme.text }]}>
              ₹{item.grossEarnings ? item.grossEarnings.toLocaleString('en-IN') : '0'}
            </Text>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <View style={styles.salaryCol}>
            <Text style={[styles.salaryLabel, { color: theme.textTertiary }]}>PT Tax</Text>
            <Text style={[styles.salaryVal, { color: item.professionalTax > 0 ? colors.error : colors.success }]}>
              {item.professionalTax > 0 ? `-₹${item.professionalTax}` : '₹0'}
            </Text>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <View style={styles.salaryCol}>
            <Text style={[styles.salaryLabel, { color: theme.textTertiary }]}>Net Take Home</Text>
            <Text style={[styles.salaryVal, { color: colors.success, fontWeight: '900' }]}>
              ₹{item.netSalary ? item.netSalary.toLocaleString('en-IN') : '0'}
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity
            onPress={() => openBreakdown(item)}
            style={[styles.detailsBtn, { borderColor: theme.border, backgroundColor: theme.surfaceAlt }]}
          >
            <Ionicons name="information-circle-outline" size={18} color={theme.text} />
            <Text style={[styles.detailsBtnText, { color: theme.text }]}>Breakdown</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => handleDownload(item)}
            disabled={isDownloading}
            style={[styles.downloadBtn, { backgroundColor: colors.primary, opacity: isDownloading ? 0.7 : 1 }]}
          >
            {isDownloading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Ionicons name="download-outline" size={18} color="#FFFFFF" />
                <Text style={styles.downloadBtnText}>PDF Slip</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </Card>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader title="My Payslips"/>

      {/* Month/Year Filter */}
      <View style={{ marginBottom: 12 }}>
        <MonthYearPicker selectedDate={selectedDate} onChange={setSelectedDate} />
      </View>

      <FlatList
        data={filteredPayslips.length > 0 ? filteredPayslips : payslips}
        keyExtractor={(item) => item._id}
        renderItem={renderPayslipCard}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={{ gap: 14 }}>
              <Skeleton width="100%" height={170} borderRadius={22} />
              <Skeleton width="100%" height={170} borderRadius={22} />
            </View>
          ) : (
            <Card style={styles.emptyCard}>
              <Ionicons name="document-text-outline" size={48} color={colors.primary} style={{ opacity: 0.4 }} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No Payslip Found</Text>
              <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
                No salary statement generated for{' '}
                {selectedDate.toLocaleString('default', { month: 'long' })} {selectedYear}.
              </Text>
            </Card>
          )
        }
      />

      {/* Detailed Breakdown Bottom Sheet Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.surface }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: theme.text }]}>Salary Breakdown</Text>
                <Text style={[styles.modalSub, { color: theme.textSecondary }]}>
                  {selectedPayslip &&
                    `Cycle: ${new Date(selectedPayslip.fromDate).toLocaleDateString('en-GB')} to ${new Date(
                      selectedPayslip.toDate
                    ).toLocaleDateString('en-GB')}`}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={theme.text} />
              </TouchableOpacity>
            </View>

            {selectedPayslip && (
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
                {/* Attendance Summary Grid */}
                <Text style={[styles.sectionTitle, { color: theme.textTertiary }]}>ATTENDANCE METRICS</Text>
                <View style={styles.metricsGrid}>
                  <View style={[styles.metricItem, { backgroundColor: theme.surfaceAlt }]}>
                    <Text style={[styles.metricVal, { color: colors.success }]}>{selectedPayslip.presentDays || 0}</Text>
                    <Text style={[styles.metricLbl, { color: theme.textSecondary }]}>Present</Text>
                  </View>
                  <View style={[styles.metricItem, { backgroundColor: theme.surfaceAlt }]}>
                    <Text style={[styles.metricVal, { color: '#F59E0B' }]}>{selectedPayslip.halfDays || 0}</Text>
                    <Text style={[styles.metricLbl, { color: theme.textSecondary }]}>Half Days</Text>
                  </View>
                  <View style={[styles.metricItem, { backgroundColor: theme.surfaceAlt }]}>
                    <Text style={[styles.metricVal, { color: '#3B82F6' }]}>{selectedPayslip.paidLeavesTaken || 0}</Text>
                    <Text style={[styles.metricLbl, { color: theme.textSecondary }]}>Paid Leaves</Text>
                  </View>
                  <View style={[styles.metricItem, { backgroundColor: theme.surfaceAlt }]}>
                    <Text style={[styles.metricVal, { color: colors.error }]}>{selectedPayslip.absentDays || 0}</Text>
                    <Text style={[styles.metricLbl, { color: theme.textSecondary }]}>Absent / LWP</Text>
                  </View>
                </View>

                {/* Earnings & Deductions Breakdown */}
                <Text style={[styles.sectionTitle, { color: theme.textTertiary, marginTop: 16 }]}>
                  FINANCIAL LINE ITEMS
                </Text>
                <View style={[styles.breakdownList, { borderColor: theme.border }]}>
                  <View style={styles.breakdownRow}>
                    <Text style={[styles.breakdownKey, { color: theme.textSecondary }]}>Base Monthly CTC</Text>
                    <Text style={[styles.breakdownVal, { color: theme.text }]}>
                      ₹{selectedPayslip.baseSalary?.toLocaleString('en-IN') || 0}
                    </Text>
                  </View>
                  <View style={styles.breakdownRow}>
                    <Text style={[styles.breakdownKey, { color: theme.textSecondary }]}>
                      Gross Earned ({selectedPayslip.paidDays} Paid Days)
                    </Text>
                    <Text style={[styles.breakdownVal, { color: theme.text }]}>
                      ₹{selectedPayslip.grossEarnings?.toLocaleString('en-IN') || 0}
                    </Text>
                  </View>
                  <View style={styles.breakdownRow}>
                    <Text style={[styles.breakdownKey, { color: colors.error }]}>Professional Tax (PT)</Text>
                    <Text style={[styles.breakdownVal, { color: colors.error }]}>
                      -₹{selectedPayslip.professionalTax || 0}
                    </Text>
                  </View>
                  {selectedPayslip.sandwichDeductions > 0 && (
                    <View style={styles.breakdownRow}>
                      <Text style={[styles.breakdownKey, { color: colors.error }]}>
                        Sandwich Deductions ({selectedPayslip.sandwichDeductions} days)
                      </Text>
                      <Text style={[styles.breakdownVal, { color: colors.error }]}>Penalty Deducted</Text>
                    </View>
                  )}
                </View>

                {/* Final Net Amount Banner */}
                <View style={styles.netBanner}>
                  <View>
                    <Text style={styles.netBannerLbl}>NET AMOUNT PAYABLE</Text>
                    <Text style={styles.netBannerVal}>
                      ₹{selectedPayslip.netSalary ? selectedPayslip.netSalary.toLocaleString('en-IN') : '0'}
                    </Text>
                  </View>
                  <Ionicons name="checkmark-circle" size={32} color="#FFFFFF" />
                </View>
              </ScrollView>
            )}

            <TouchableOpacity
              onPress={() => {
                setModalVisible(false);
                if (selectedPayslip) handleDownload(selectedPayslip);
              }}
              style={[styles.modalDownloadBtn, { backgroundColor: colors.primary }]}
            >
              <Ionicons name="download-outline" size={18} color="#FFFFFF" />
              <Text style={styles.modalDownloadBtnText}>Download PDF Payslip</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { padding: 20, gap: 16, paddingBottom: 50 },
  card: { padding: 20, gap: 16, borderRadius: 22 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBg: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  periodText: { fontSize: 16, fontWeight: '800' },
  metaText: { fontSize: 12, marginTop: 2, fontWeight: '600' },
  salaryRow: { flexDirection: 'row', borderRadius: 16, padding: 14, alignItems: 'center' },
  salaryCol: { flex: 1, alignItems: 'center', gap: 4 },
  divider: { width: 1, height: 28 },
  salaryLabel: { fontSize: 10.5, fontWeight: '700', textTransform: 'uppercase' },
  salaryVal: { fontSize: 13, fontWeight: '800' },
  actionRow: { flexDirection: 'row', gap: 12 },
  detailsBtn: {
    flex: 1,
    flexDirection: 'row',
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  detailsBtnText: { fontSize: 13, fontWeight: '700' },
  downloadBtn: {
    flex: 1.4,
    flexDirection: 'row',
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  downloadBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  emptyCard: { padding: 40, alignItems: 'center', gap: 12, borderRadius: 22 },
  emptyTitle: { fontSize: 17, fontWeight: '800' },
  emptySub: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalCard: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  modalTitle: { fontSize: 19, fontWeight: '900' },
  modalSub: { fontSize: 12, marginTop: 3, fontWeight: '600' },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, marginBottom: 8 },
  metricsGrid: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  metricItem: { flex: 1, padding: 10, borderRadius: 12, alignItems: 'center', gap: 2 },
  metricVal: { fontSize: 15, fontWeight: '900' },
  metricLbl: { fontSize: 10, fontWeight: '700' },
  breakdownList: { borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: 8, gap: 10 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  breakdownKey: { fontSize: 13, fontWeight: '600' },
  breakdownVal: { fontSize: 13, fontWeight: '800' },
  netBanner: {
    backgroundColor: '#10B981',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 8,
  },
  netBannerLbl: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  netBannerVal: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', marginTop: 2 },
  modalDownloadBtn: {
    flexDirection: 'row',
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
  modalDownloadBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});
