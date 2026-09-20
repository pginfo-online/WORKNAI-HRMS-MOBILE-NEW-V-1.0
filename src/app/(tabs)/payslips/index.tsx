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
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import { payrollApi } from '../../../api/payroll.api';
import { useUIStore } from '../../../store/ui.store';
import { useAuthStore } from '../../../store/auth.store';
import { colors } from '../../../constants/colors';
import { CONFIG } from '../../../constants/config';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { Card } from '../../../components/ui/Card';
import { Badge } from '../../../components/ui/Badge';
import { Skeleton } from '../../../components/ui/Skeleton';
import { MonthYearPicker } from '../../../components/ui/MonthYearPicker';

/**
 * Converts numeric amount to Indian English words
 */
const numberToIndianWords = (amount: number): string => {
  const words = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen',
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  if (!amount || amount === 0) return 'Zero';
  let word = '';
  let tempAmount = Math.floor(amount);

  if (tempAmount >= 10000000) {
    word += numberToIndianWords(Math.floor(tempAmount / 10000000)) + ' Crore ';
    tempAmount %= 10000000;
  }
  if (tempAmount >= 100000) {
    word += numberToIndianWords(Math.floor(tempAmount / 100000)) + ' Lakh ';
    tempAmount %= 100000;
  }
  if (tempAmount >= 1000) {
    word += numberToIndianWords(Math.floor(tempAmount / 1000)) + ' Thousand ';
    tempAmount %= 1000;
  }
  if (tempAmount >= 100) {
    word += numberToIndianWords(Math.floor(tempAmount / 100)) + ' Hundred ';
    tempAmount %= 100;
  }
  if (tempAmount > 0) {
    if (word !== '') word += 'and ';
    if (tempAmount < 20) word += words[tempAmount];
    else {
      word += tens[Math.floor(tempAmount / 10)] + ' ';
      word += words[tempAmount % 10];
    }
  }
  return word.trim();
};

const monthNames = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function PayslipsScreen() {
  const { theme, isDark } = useUIStore();
  const { user } = useAuthStore();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'all'>('month');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [selectedPayslip, setSelectedPayslip] = useState<any | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);

  const selectedYear = selectedDate.getFullYear();
  const selectedMonth = selectedDate.getMonth() + 1; // 1-12
  const currentMonthName = monthNames[selectedMonth - 1] || 'Month';

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

  // Filter payslips strictly based on viewMode
  const displayedPayslips =
    viewMode === 'month'
      ? payslips.filter((p: any) => p.month === selectedMonth)
      : payslips;

  const handleDownload = async (item: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setDownloadingId(item._id);

    // Yield control to main browser / UI thread to render spinner and avoid long task violations
    await new Promise((resolve) => {
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        (window as any).requestIdleCallback(resolve);
      } else {
        setTimeout(resolve, 50);
      }
    });

    try {
      const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const fileName = `SalarySlip_${shortMonths[item.month - 1] || 'Month'}_${item.year}.pdf`;

      // ── 1. WEB PLATFORM DOWNLOAD ──
      if (Platform.OS === 'web') {
        const res = await payrollApi.downloadPayslip(item._id);
        const blob = new Blob([res.data], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => window.URL.revokeObjectURL(url), 1000);

        Toast.show({
          type: 'success',
          text1: 'Payslip Downloaded ✓',
          text2: `Saved ${fileName}`,
        });
        return;
      }

      // ── 2. NATIVE PLATFORM DOWNLOAD (iOS / Android) ──
      let token: string | null = null;
      try {
        token = await SecureStore.getItemAsync('accessToken');
      } catch {}
      if (!token) {
        try {
          token = await AsyncStorage.getItem('accessToken');
        } catch {}
      }
      if (!token && typeof window !== 'undefined' && window.localStorage) {
        token = window.localStorage.getItem('accessToken');
      }

      const docDir = (FileSystem as any).documentDirectory || (FileSystem as any).cacheDirectory || '';
      const fileUri = `${docDir}${fileName}`;

      // A. If Cloudinary URL is available, download directly
      if (item.salarySlipUrl) {
        try {
          const cdnRes = await FileSystem.downloadAsync(item.salarySlipUrl, fileUri);
          if (cdnRes.status === 200) {
            Toast.show({ type: 'success', text1: 'Payslip Ready ✓', text2: `Saved ${fileName}` });
            if (await Sharing.isAvailableAsync()) {
              await Sharing.shareAsync(fileUri, { mimeType: 'application/pdf', dialogTitle: `Save or Share ${fileName}` });
            }
            return;
          }
        } catch {
          // fallback to backend download
        }
      }

      // B. Download from backend endpoint with auth headers and query token
      const downloadUrl = `${CONFIG.API_BASE_URL}/payroll/salary-slip/${item._id}${token ? `?token=${encodeURIComponent(token)}` : ''}`;
      const downloadRes = await FileSystem.downloadAsync(downloadUrl, fileUri, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (downloadRes.status !== 200) {
        // C. Fallback: fetch via client with base64 conversion
        const res = await payrollApi.downloadPayslip(item._id);
        const reader = new FileReader();
        await new Promise((resolve, reject) => {
          reader.onloadend = async () => {
            try {
              const base64data = (reader.result as string).split(',')[1];
              await FileSystem.writeAsStringAsync(fileUri, base64data, {
                encoding: FileSystem.EncodingType.Base64,
              });
              resolve(true);
            } catch (e) {
              reject(e);
            }
          };
          reader.onerror = reject;
          reader.readAsDataURL(res.data);
        });
      }

      Toast.show({
        type: 'success',
        text1: 'Payslip Ready ✓',
        text2: `Saved ${fileName}`,
      });

      // Open share/save sheet
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(fileUri, {
          mimeType: 'application/pdf',
          dialogTitle: `Save or Share ${fileName}`,
        });
      }
    } catch (err: any) {
      console.error('[Payslip Download Error]', err);
      Toast.show({
        type: 'error',
        text1: 'Download Failed',
        text2: err?.message || 'Could not download or open payslip.',
      });
    } finally {
      setDownloadingId(null);
    }
  };

  const openBreakdown = async (item: any) => {
    Haptics.selectionAsync();
    setSelectedPayslip(item);
    setModalVisible(true);
    setModalLoading(true);

    // Fetch enriched bank & document details from backend
    try {
      const res = await payrollApi.getPayrollById(item._id);
      if (res.data?.data) {
        setSelectedPayslip(res.data.data);
      }
    } catch {
      // Fallback to item
    } finally {
      setModalLoading(false);
    }
  };

  const renderPayslipCard = ({ item }: { item: any }) => {
    const isDownloading = downloadingId === item._id;
    const cardMonthName = monthNames[item.month - 1] || `Month ${item.month}`;

    return (
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconBg, { backgroundColor: isDark ? 'rgba(99,102,241,0.15)' : '#e0e7ff' }]}>
            <Ionicons name="receipt" size={22} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.periodText, { color: theme.text }]}>
              {cardMonthName} {item.year}
            </Text>
            <Text style={[styles.metaText, { color: theme.textSecondary }]}>
              {item.paidDays} / {item.totalDaysInMonth || 30} Paid Days
            </Text>
          </View>
          <Badge label={item.status || 'Processed'} variant={item.status === 'Paid' ? 'success' : 'info'} />
        </View>

        {/* Salary Stats Bento Row */}
        <View style={[styles.salaryRow, { backgroundColor: theme.surfaceAlt }]}>
          <View style={styles.salaryCol}>
            <Text style={[styles.salaryLabel, { color: theme.textTertiary }]}>Gross</Text>
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
            <Text style={[styles.salaryLabel, { color: theme.textTertiary }]}>Net Pay</Text>
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
            <Ionicons name="eye-outline" size={17} color={colors.primary} />
            <Text style={[styles.detailsBtnText, { color: theme.text }]}>View Slip</Text>
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
                <Ionicons name="download-outline" size={17} color="#FFFFFF" />
                <Text style={styles.downloadBtnText}>PDF Slip</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </Card>
    );
  };

  const emp = selectedPayslip?.employeeId || user || {};
  const rawAccount = emp.accountNumber || '';
  const maskedAccount =
    rawAccount && rawAccount !== 'N/A' && rawAccount.length > 4
      ? `•••• •••• •••• ${rawAccount.slice(-4)}`
      : rawAccount || '•••• •••• •••• 4892';

  const modalMonthName = selectedPayslip
    ? monthNames[(selectedPayslip.month || 1) - 1] || 'Month'
    : '';

  const netPayWords = selectedPayslip?.netSalary
    ? numberToIndianWords(Math.round(selectedPayslip.netSalary))
    : '';

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader title="My Payslips" />

      {/* Month/Year Filter */}
      <View style={{ marginBottom: 10 }}>
        <MonthYearPicker selectedDate={selectedDate} onChange={setSelectedDate} />
      </View>

      {/* View Filter Pill (Selected Month vs All Months in Year) */}
      <View style={styles.filterPillContainer}>
        <TouchableOpacity
          onPress={() => {
            Haptics.selectionAsync();
            setViewMode('month');
          }}
          style={[
            styles.filterPill,
            {
              backgroundColor: viewMode === 'month' ? colors.primary : theme.surfaceAlt,
              borderColor: viewMode === 'month' ? colors.primary : theme.border,
            },
          ]}
        >
          <Text
            style={[
              styles.filterPillText,
              { color: viewMode === 'month' ? '#FFFFFF' : theme.textSecondary },
            ]}
          >
            {currentMonthName} {selectedYear}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            Haptics.selectionAsync();
            setViewMode('all');
          }}
          style={[
            styles.filterPill,
            {
              backgroundColor: viewMode === 'all' ? colors.primary : theme.surfaceAlt,
              borderColor: viewMode === 'all' ? colors.primary : theme.border,
            },
          ]}
        >
          <Text
            style={[
              styles.filterPillText,
              { color: viewMode === 'all' ? '#FFFFFF' : theme.textSecondary },
            ]}
          >
            All in {selectedYear} ({payslips.length})
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={displayedPayslips}
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
              <Ionicons name="receipt-outline" size={48} color={colors.primary} style={{ opacity: 0.4 }} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No Payslip Generated</Text>
              <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
                {viewMode === 'month'
                  ? `No verified salary statement found for ${currentMonthName} ${selectedYear}.`
                  : `No payroll records found for the year ${selectedYear}.`}
              </Text>
            </Card>
          )
        }
      />

      {/* Production-Grade Salary Slip Bottom Sheet Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: theme.surface }]}>
            {/* Modal Drag Handle & Header */}
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.companyBadge}>Worknai Technologies</Text>
                  <Text style={[styles.companyCin, { color: theme.textTertiary }]}>CIN: U72900MH2024PTC123456</Text>
                </View>
                <Text style={[styles.modalTitle, { color: theme.text, marginTop: 4 }]}>
                  Payslip for {modalMonthName} {selectedPayslip?.year}
                </Text>
                <Text style={[styles.modalSub, { color: theme.textSecondary }]}>
                  {selectedPayslip &&
                    `Pay Cycle: ${new Date(selectedPayslip.fromDate).toLocaleDateString('en-GB')} – ${new Date(
                      selectedPayslip.toDate
                    ).toLocaleDateString('en-GB')}`}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={theme.text} />
              </TouchableOpacity>
            </View>

            {selectedPayslip && (
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 480 }}>
                {/* Employee & Bank Profile Card */}
                <View style={[styles.empBankCard, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
                  <View style={styles.empBankRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.empBankLabel, { color: theme.textTertiary }]}>EMPLOYEE</Text>
                      <Text style={[styles.empBankVal, { color: theme.text }]}>
                        {selectedPayslip.employeeName || emp.name || 'Employee'}
                      </Text>
                      <Text style={[styles.empBankSub, { color: theme.textSecondary }]}>
                        {selectedPayslip.employeeCode || emp.employeeCode || 'WA00000'} • {emp.position || 'Staff'}
                      </Text>
                    </View>
                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                      <Text style={[styles.empBankLabel, { color: theme.textTertiary }]}>PAN NUMBER</Text>
                      <Text style={[styles.empBankVal, { color: theme.text, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }]}>
                        {emp.panNumber || 'ABCDE1234F'}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.dividerH, { backgroundColor: theme.border }]} />

                  <View style={styles.empBankRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.empBankLabel, { color: theme.textTertiary }]}>CREDITED TO</Text>
                      <Text style={[styles.empBankVal, { color: theme.text }]}>
                        {emp.bankName || 'HDFC Bank Ltd.'}
                      </Text>
                      <Text style={[styles.empBankSub, { color: theme.textSecondary, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }]}>
                        {maskedAccount}
                      </Text>
                    </View>
                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                      <Text style={[styles.empBankLabel, { color: theme.textTertiary }]}>IFSC CODE</Text>
                      <Text style={[styles.empBankVal, { color: theme.text }]}>
                        {emp.ifsc || 'HDFC0001234'}
                      </Text>
                      <Text style={[styles.empBankSub, { color: colors.success, fontWeight: '700' }]}>Direct Bank Transfer</Text>
                    </View>
                  </View>
                </View>

                {/* Attendance Summary Grid */}
                <Text style={[styles.sectionTitle, { color: theme.textTertiary, marginTop: 16 }]}>
                  ATTENDANCE &amp; LEAVE RECONCILIATION
                </Text>
                <View style={styles.metricsGrid}>
                  <View style={[styles.metricItem, { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0', borderWidth: 1 }]}>
                    <Text style={[styles.metricVal, { color: '#059669' }]}>{selectedPayslip.paidDays || 0}</Text>
                    <Text style={[styles.metricLbl, { color: '#059669', fontWeight: '800' }]}>Paid Days</Text>
                  </View>
                  <View style={[styles.metricItem, { backgroundColor: theme.surfaceAlt }]}>
                    <Text style={[styles.metricVal, { color: theme.text }]}>{selectedPayslip.presentDays || 0}</Text>
                    <Text style={[styles.metricLbl, { color: theme.textSecondary }]}>Present</Text>
                  </View>
                  <View style={[styles.metricItem, { backgroundColor: theme.surfaceAlt }]}>
                    <Text style={[styles.metricVal, { color: '#F59E0B' }]}>{selectedPayslip.halfDays || 0}</Text>
                    <Text style={[styles.metricLbl, { color: theme.textSecondary }]}>Half Days</Text>
                  </View>
                  <View style={[styles.metricItem, { backgroundColor: theme.surfaceAlt }]}>
                    <Text style={[styles.metricVal, { color: '#3B82F6' }]}>{selectedPayslip.paidLeavesTaken || 0}</Text>
                    <Text style={[styles.metricLbl, { color: theme.textSecondary }]}>Leaves</Text>
                  </View>
                  <View style={[styles.metricItem, { backgroundColor: selectedPayslip.absentDays > 0 ? '#fef2f2' : theme.surfaceAlt }]}>
                    <Text style={[styles.metricVal, { color: selectedPayslip.absentDays > 0 ? colors.error : theme.text }]}>
                      {selectedPayslip.absentDays || selectedPayslip.unpaidLeavesTaken || 0}
                    </Text>
                    <Text style={[styles.metricLbl, { color: theme.textSecondary }]}>Absent</Text>
                  </View>
                </View>

                {/* Financial Line Items (Earnings vs Deductions) */}
                <Text style={[styles.sectionTitle, { color: theme.textTertiary, marginTop: 16 }]}>
                  ITEMIZED BREAKDOWN
                </Text>
                <View style={[styles.breakdownList, { borderColor: theme.border }]}>
                  <View style={styles.breakdownRow}>
                    <Text style={[styles.breakdownKey, { color: theme.textSecondary }]}>Basic Monthly CTC</Text>
                    <Text style={[styles.breakdownVal, { color: theme.text }]}>
                      ₹{selectedPayslip.baseSalary ? selectedPayslip.baseSalary.toLocaleString('en-IN') : '0'}
                    </Text>
                  </View>
                  <View style={styles.breakdownRow}>
                    <Text style={[styles.breakdownKey, { color: theme.text, fontWeight: '800' }]}>
                      Gross Earned ({selectedPayslip.paidDays} Paid Days)
                    </Text>
                    <Text style={[styles.breakdownVal, { color: '#059669', fontWeight: '900' }]}>
                      ₹{selectedPayslip.grossEarnings ? selectedPayslip.grossEarnings.toLocaleString('en-IN') : '0'}
                    </Text>
                  </View>
                  <View style={styles.breakdownRow}>
                    <Text style={[styles.breakdownKey, { color: colors.error }]}>Professional Tax (PT)</Text>
                    <Text style={[styles.breakdownVal, { color: colors.error }]}>
                      {selectedPayslip.professionalTax > 0 ? `-₹${selectedPayslip.professionalTax}` : '₹0'}
                    </Text>
                  </View>
                  {selectedPayslip.otherDeductions > 0 && (
                    <View style={styles.breakdownRow}>
                      <Text style={[styles.breakdownKey, { color: colors.error }]}>
                        {selectedPayslip.otherDeductionRemarks || 'Other Deductions'}
                      </Text>
                      <Text style={[styles.breakdownVal, { color: colors.error }]}>
                        -₹{selectedPayslip.otherDeductions}
                      </Text>
                    </View>
                  )}
                  {selectedPayslip.sandwichDeductions > 0 && (
                    <View style={styles.breakdownRow}>
                      <Text style={[styles.breakdownKey, { color: colors.error }]}>
                        Sandwich Deductions ({selectedPayslip.sandwichDeductions} d)
                      </Text>
                      <Text style={[styles.breakdownVal, { color: colors.error }]}>Applied in Gross</Text>
                    </View>
                  )}
                </View>

                {/* Final Net Amount Banner */}
                <View style={styles.netBanner}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.netBannerLbl}>NET TAKE-HOME SALARY</Text>
                    <Text style={styles.netBannerVal}>
                      ₹{selectedPayslip.netSalary ? selectedPayslip.netSalary.toLocaleString('en-IN') : '0'}
                    </Text>
                    {netPayWords ? (
                      <Text style={styles.netWords}>Rupees {netPayWords} Only</Text>
                    ) : null}
                  </View>
                  <Ionicons name="shield-checkmark" size={36} color="#FFFFFF" style={{ opacity: 0.9 }} />
                </View>

                {/* Statutory Disclaimer */}
                <Text style={[styles.disclaimerText, { color: theme.textTertiary }]}>
                  This is a computer-generated salary slip issued by Worknai HRMS and does not require a physical signature.
                </Text>
              </ScrollView>
            )}

            {/* Modal Bottom Actions */}
            <View style={styles.modalActionRow}>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={[styles.modalCloseBtn, { borderColor: theme.border, backgroundColor: theme.surfaceAlt }]}
              >
                <Text style={[styles.modalCloseBtnText, { color: theme.text }]}>Close</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setModalVisible(false);
                  if (selectedPayslip) handleDownload(selectedPayslip);
                }}
                style={[styles.modalDownloadBtn, { backgroundColor: colors.primary }]}
              >
                <Ionicons name="download-outline" size={18} color="#FFFFFF" />
                <Text style={styles.modalDownloadBtnText}>Download &amp; Share PDF</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  listContent: { padding: 20, gap: 16, paddingBottom: 50 },
  filterPillContainer: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 8 },
  filterPill: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
  },
  filterPillText: { fontSize: 12, fontWeight: '800' },
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
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  companyBadge: { fontSize: 10.5, fontWeight: '800', color: '#059669', backgroundColor: '#ecfdf5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  companyCin: { fontSize: 10, fontWeight: '600' },
  modalTitle: { fontSize: 19, fontWeight: '900' },
  modalSub: { fontSize: 12, marginTop: 3, fontWeight: '600' },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  empBankCard: { borderRadius: 16, padding: 14, borderWidth: 1, gap: 10, marginBottom: 8 },
  empBankRow: { flexDirection: 'row', justifyContent: 'space-between' },
  empBankLabel: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.4 },
  empBankVal: { fontSize: 13, fontWeight: '800', marginTop: 2 },
  empBankSub: { fontSize: 11, fontWeight: '600', marginTop: 1 },
  dividerH: { height: 1, width: '100%' },
  sectionTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, marginBottom: 8 },
  metricsGrid: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  metricItem: { flex: 1, padding: 8, borderRadius: 10, alignItems: 'center', gap: 2 },
  metricVal: { fontSize: 14, fontWeight: '900' },
  metricLbl: { fontSize: 9.5, fontWeight: '700' },
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
  netBannerVal: { color: '#FFFFFF', fontSize: 24, fontWeight: '900', marginTop: 2 },
  netWords: { color: '#FFFFFF', fontSize: 11, fontWeight: '600', fontStyle: 'italic', marginTop: 4, opacity: 0.95 },
  disclaimerText: { fontSize: 10, textAlign: 'center', marginTop: 12, lineHeight: 14 },
  modalActionRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  modalCloseBtn: {
    flex: 1,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseBtnText: { fontSize: 14, fontWeight: '700' },
  modalDownloadBtn: {
    flex: 2,
    flexDirection: 'row',
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  modalDownloadBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
});
