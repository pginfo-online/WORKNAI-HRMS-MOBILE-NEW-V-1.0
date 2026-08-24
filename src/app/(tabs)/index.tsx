import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../../store/auth.store';
import { useUIStore } from '../../store/ui.store';
import { useTaskStore } from '../../store/task.store';
import { dashboardApi } from '../../api/dashboard.api';
import { colors } from '../../constants/colors';
import { Card } from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';
import { ProgressRing } from '../../components/ui/ProgressRing';

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { theme } = useUIStore();
  const { tasks, fetchTodayTasks } = useTaskStore();

  const [guideVisible, setGuideVisible] = useState(false);
  const [handbookModalVisible, setHandbookModalVisible] = useState(false);
  const [guideStep, setGuideStep] = useState(0);

  const {
    data: dashData,
    isLoading: dashLoading,
    refetch: refetchDash,
  } = useQuery({
    queryKey: ['employee-dashboard'],
    queryFn: () => dashboardApi.getEmployeeDashboard().then((res) => res.data.data),
    staleTime: 60000,
  });

  useEffect(() => {
    fetchTodayTasks();
    checkFirstLaunch();
  }, [fetchTodayTasks]);

  const checkFirstLaunch = async () => {
    try {
      const seen = await AsyncStorage.getItem('hasSeenMobileHomeGuide');
      if (!seen) {
        setTimeout(() => setGuideVisible(true), 1200);
      }
    } catch (_) {}
  };

  const closeGuide = async () => {
    setGuideVisible(false);
    try {
      await AsyncStorage.setItem('hasSeenMobileHomeGuide', 'true');
    } catch (_) {}
  };

  const record = dashData?.todayRecord;
  const isCheckedIn = !!record?.inTime && !record?.outTime;
  const isCheckedOut = !!record?.outTime;

  const leaveSummary = dashData?.leaveSummary || {
    paidLeaveBalance: user?.paidLeaveBalance ?? 0,
    compOffBalance: user?.compOffBalance ?? 0,
    pendingLeavesCount: 0,
  };

  const upcomingHolidays = dashData?.upcomingHolidays || [];
  const birthdays = dashData?.birthdays || { today: [], tomorrow: [] };

  const completedCount = tasks.filter((t) => t.status === 'Completed').length;
  const totalTasks = tasks.length;
  const taskPct = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

  const handleRefresh = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    refetchDash();
    fetchTodayTasks();
  };

  const guideSteps = [
    {
      title: 'Welcome to Workn HRMS 👋',
      desc: 'Your central employee command center designed for seamless daily work management.',
      icon: 'sparkles-outline' as const,
    },
    {
      title: 'Shift & Attendance ⏱️',
      desc: 'View your live shift status, punch in when arriving, and punch out with daily logs.',
      icon: 'finger-print-outline' as const,
    },
    {
      title: 'Task Hub & Progress 📋',
      desc: 'Track assigned tasks, monitor completion rate, and sync deliverables automatically.',
      icon: 'checkbox-outline' as const,
    },
    {
      title: 'Leave & Balances 🏖️',
      desc: 'Check your PTO & Comp-Off balances instantly and submit time-off requests.',
      icon: 'calendar-outline' as const,
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={dashLoading}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Header Hero Banner */}
        <LinearGradient
          colors={colors.gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroBanner}
        >
          <View style={styles.headerTop}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.dateSub}>{format(new Date(), 'EEEE, dd MMMM yyyy')}</Text>
              <Text style={styles.greetingText}>
                Hello, {user?.name?.split(' ')[0] || 'Employee'} 👋
              </Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TouchableOpacity
                onPress={() => setGuideVisible(true)}
                style={styles.tourIconBtn}
              >
                <Ionicons name="help-circle-outline" size={22} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => router.push('/(tabs)/profile')}
                style={styles.avatarWrap}
              >
                {user?.profileImageUrl ? (
                  <Image source={{ uri: user.profileImageUrl }} style={styles.avatarImg} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarText}>
                      {user?.name?.substring(0, 2).toUpperCase() || 'WA'}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.heroBadgeRow}>
            <View style={[styles.roleChip, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
              <Text style={styles.roleChipText}>
                {user?.role || 'Employee'} · {user?.employeeCode}
              </Text>
            </View>
            {user?.department && (
              <View style={[styles.roleChip, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                <Text style={styles.roleChipText}>{user.department}</Text>
              </View>
            )}
          </View>
        </LinearGradient>

        {dashLoading ? (
          <View style={{ gap: 14 }}>
            <Skeleton width="100%" height={90} borderRadius={20} />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Skeleton width="48%" height={140} borderRadius={20} />
              <Skeleton width="48%" height={140} borderRadius={20} />
            </View>
            <Skeleton width="100%" height={160} borderRadius={20} />
          </View>
        ) : (
          <>
            {/* Live Attendance Status Card */}
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/attendance')}
              activeOpacity={0.88}
            >
              <Card style={styles.statusCard}>
                <View style={styles.statusCardHeader}>
                  <View
                    style={[
                      styles.statusPulseDot,
                      {
                        backgroundColor: isCheckedIn
                          ? '#10B981'
                          : isCheckedOut
                          ? colors.primary
                          : '#F59E0B',
                      },
                    ]}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.statusCardTitle, { color: theme.text }]}>
                      {isCheckedIn
                        ? 'ACTIVE SHIFT TIMER'
                        : isCheckedOut
                        ? 'SHIFT COMPLETED'
                        : 'SHIFT NOT STARTED'}
                    </Text>
                    <Text style={[styles.statusCardSub, { color: theme.textSecondary }]}>
                      {isCheckedIn
                        ? `Checked in at ${
                            record?.inTime ? format(new Date(record.inTime), 'hh:mm a') : ''
                          }`
                        : isCheckedOut
                        ? `Logged ${
                            record?.totalHours ? record.totalHours.toFixed(1) : '0'
                          } hrs today`
                        : 'Tap to mark check-in & start duty'}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={theme.textTertiary} />
                </View>
              </Card>
            </TouchableOpacity>

            {/* Deliverables Ring & Leave Balances Bento Row */}
            <View style={styles.statsRow}>
              {/* Task Completion Card */}
              <Card style={{ ...styles.statCardHalf, flex: 1 }}>
                <View style={styles.ringHeader}>
                  <Text style={[styles.statCardTitle, { color: theme.text }]}>Today's Work</Text>
                  <TouchableOpacity onPress={() => router.push('/(tabs)/attendance/tasks')}>
                    <Ionicons name="open-outline" size={16} color={colors.primary} />
                  </TouchableOpacity>
                </View>
                <View style={styles.ringCenter}>
                  <ProgressRing
                    percentage={taskPct}
                    size={68}
                    strokeWidth={7}
                    color={colors.primary}
                  >
                    <Text style={[styles.ringPctText, { color: theme.text }]}>{taskPct}%</Text>
                  </ProgressRing>
                  <View style={{ gap: 2 }}>
                    <Text style={[styles.taskCountText, { color: theme.text }]}>
                      {completedCount}/{totalTasks}
                    </Text>
                    <Text style={[styles.taskSubText, { color: theme.textTertiary }]}>Done</Text>
                  </View>
                </View>
              </Card>

              {/* Leave Balances Card */}
              <Card style={{ ...styles.statCardHalf, flex: 1 }}>
                <View style={styles.ringHeader}>
                  <Text style={[styles.statCardTitle, { color: theme.text }]}>Leaves</Text>
                  <TouchableOpacity onPress={() => router.push('/(tabs)/leaves')}>
                    <Ionicons name="open-outline" size={16} color={colors.primary} />
                  </TouchableOpacity>
                </View>

                <View style={styles.leaveStatsCol}>
                  <View style={styles.leaveStatItem}>
                    <Text style={[styles.leaveVal, { color: colors.primary }]}>
                      {leaveSummary.paidLeaveBalance}
                    </Text>
                    <Text style={[styles.leaveLbl, { color: theme.textSecondary }]}>PTO</Text>
                  </View>
                  <View style={styles.leaveStatItem}>
                    <Text style={[styles.leaveVal, { color: '#7C3AED' }]}>
                      {leaveSummary.compOffBalance}
                    </Text>
                    <Text style={[styles.leaveLbl, { color: theme.textSecondary }]}>
                      Comp-Off
                    </Text>
                  </View>
                </View>
              </Card>
            </View>

            {/* Upcoming Holiday or Celebration Strip */}
            {(upcomingHolidays.length > 0 || birthdays.today.length > 0) && (
              <View style={[styles.alertStrip, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                <Ionicons
                  name={birthdays.today.length > 0 ? 'gift-outline' : 'sunny-outline'}
                  size={18}
                  color={birthdays.today.length > 0 ? '#EC4899' : '#F59E0B'}
                />
                <Text style={[styles.alertStripText, { color: theme.text }]} numberOfLines={1}>
                  {birthdays.today.length > 0
                    ? `🎉 Birthday today: ${birthdays.today[0].name}`
                    : `🌴 Upcoming: ${upcomingHolidays[0].name} (${format(
                        new Date(upcomingHolidays[0].date),
                        'dd MMM'
                      )})`}
                </Text>
              </View>
            )}

            {/* Quick Actions Grid */}
            <Text style={[styles.sectionHeading, { color: theme.textSecondary }]}>
              Quick Actions
            </Text>
            <View style={styles.actionsGrid}>
              {[
                {
                  title: 'Check In / Out',
                  icon: 'finger-print-outline' as const,
                  color: colors.primary,
                  route: '/(tabs)/attendance',
                },
                {
                  title: 'Task Hub',
                  icon: 'checkbox-outline' as const,
                  color: '#10B981',
                  route: '/(tabs)/attendance/tasks',
                },
                {
                  title: 'Apply Leave',
                  icon: 'calendar-outline' as const,
                  color: '#7C3AED',
                  route: '/(tabs)/leaves',
                },
                {
                  title: 'Correction',
                  icon: 'create-outline' as const,
                  color: '#F59E0B',
                  route: '/(tabs)/attendance/correction',
                },
                {
                  title: 'Payslips',
                  icon: 'receipt-outline' as const,
                  color: '#06B6D4',
                  route: '/(tabs)/payslips',
                },
                {
                  title: 'Logs Summary',
                  icon: 'time-outline' as const,
                  color: '#6366F1',
                  route: '/(tabs)/attendance/summary',
                },
              ].map((action) => (
                <TouchableOpacity
                  key={action.title}
                  onPress={() => router.push(action.route as any)}
                  style={[
                    styles.actionCard,
                    { backgroundColor: theme.surface, borderColor: theme.border },
                  ]}
                >
                  <View
                    style={[styles.actionIconBg, { backgroundColor: `${action.color}15` }]}
                  >
                    <Ionicons name={action.icon} size={22} color={action.color} />
                  </View>
                  <Text style={[styles.actionTitle, { color: theme.text }]}>
                    {action.title}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Handbooks & Company Policies Widget */}
            <TouchableOpacity
              onPress={() => setHandbookModalVisible(true)}
              activeOpacity={0.88}
              style={[
                styles.policyCard,
                { backgroundColor: theme.surface, borderColor: theme.border },
              ]}
            >
              <View style={styles.policyIconWrap}>
                <Ionicons name="book-outline" size={20} color="#2563EB" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.policyTitle, { color: theme.text }]}>
                  Company Handbooks & Policies
                </Text>
                <Text style={[styles.policySub, { color: theme.textSecondary }]}>
                  Read HR, Attendance & Security guidelines
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* Onboarding Guide Modal */}
      <Modal visible={guideVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.guideModalCard, { backgroundColor: theme.surface }]}>
            <View style={styles.guideIconBubble}>
              <Ionicons name={guideSteps[guideStep].icon} size={32} color={colors.primary} />
            </View>
            <Text style={[styles.guideModalTitle, { color: theme.text }]}>
              {guideSteps[guideStep].title}
            </Text>
            <Text style={[styles.guideModalDesc, { color: theme.textSecondary }]}>
              {guideSteps[guideStep].desc}
            </Text>

            <View style={styles.guideDotRow}>
              {guideSteps.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.guideDot,
                    {
                      backgroundColor:
                        i === guideStep ? colors.primary : 'rgba(150,150,150,0.3)',
                    },
                  ]}
                />
              ))}
            </View>

            <View style={styles.guideBtnRow}>
              <TouchableOpacity onPress={closeGuide} style={styles.guideSkipBtn}>
                <Text style={styles.guideSkipText}>Skip</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  if (guideStep < guideSteps.length - 1) {
                    setGuideStep(guideStep + 1);
                  } else {
                    closeGuide();
                  }
                }}
                style={styles.guideNextBtn}
              >
                <Text style={styles.guideNextText}>
                  {guideStep < guideSteps.length - 1 ? 'Next' : 'Got it!'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Policies Modal */}
      <Modal visible={handbookModalVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={[styles.policyModalCard, { backgroundColor: theme.surface }]}>
            <View style={styles.policyModalHeader}>
              <Text style={[styles.guideModalTitle, { color: theme.text }]}>
                Company Policies 📄
              </Text>
              <TouchableOpacity onPress={() => setHandbookModalVisible(false)}>
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 300 }}>
              {[
                {
                  title: 'Employee Handbook 2026',
                  desc: 'Work hours, leave entitlement, code of conduct & office protocols.',
                },
                {
                  title: 'IT & Data Security Policy',
                  desc: 'Device encryption, 2FA, data confidentiality & acceptable use.',
                },
                {
                  title: 'Attendance & Punctuality Policy',
                  desc: 'Core hours, late mark grace window, and overtime rules.',
                },
              ].map((p, idx) => (
                <View
                  key={idx}
                  style={[styles.policyListItem, { borderColor: theme.border }]}
                >
                  <Ionicons name="document-text-outline" size={20} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.policyItemTitle, { color: theme.text }]}>
                      {p.title}
                    </Text>
                    <Text style={[styles.policyItemDesc, { color: theme.textSecondary }]}>
                      {p.desc}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, gap: 16, paddingBottom: 40 },
  heroBanner: { borderRadius: 24, padding: 22, gap: 16 },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  dateSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  greetingText: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  tourIconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  avatarWrap: { width: 44, height: 44, borderRadius: 22, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  avatarImg: { width: '100%', height: '100%' },
  avatarFallback: { flex: 1, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontSize: 15, fontWeight: '900' },
  heroBadgeRow: { flexDirection: 'row', gap: 8 },
  roleChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  roleChipText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  statusCard: { padding: 16 },
  statusCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusPulseDot: { width: 12, height: 12, borderRadius: 6 },
  statusCardTitle: { fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  statusCardSub: { fontSize: 12, marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 12 },
  statCardHalf: { padding: 16, gap: 12 },
  ringHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statCardTitle: { fontSize: 14, fontWeight: '800' },
  ringCenter: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  ringPctText: { fontSize: 13, fontWeight: '900' },
  taskCountText: { fontSize: 15, fontWeight: '900' },
  taskSubText: { fontSize: 11, fontWeight: '600' },
  leaveStatsCol: { gap: 8, marginTop: 2 },
  leaveStatItem: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  leaveVal: { fontSize: 18, fontWeight: '900' },
  leaveLbl: { fontSize: 12, fontWeight: '600' },
  alertStrip: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, borderWidth: 1 },
  alertStripText: { fontSize: 13, fontWeight: '600', flex: 1 },
  sectionHeading: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionCard: { width: '31%', borderRadius: 16, borderWidth: 1, padding: 14, alignItems: 'center', gap: 8 },
  actionIconBg: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  actionTitle: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
  policyCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: 1 },
  policyIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(37,99,235,0.08)', alignItems: 'center', justifyContent: 'center' },
  policyTitle: { fontSize: 13, fontWeight: '800' },
  policySub: { fontSize: 11, marginTop: 2 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  guideModalCard: { width: '100%', maxWidth: 360, borderRadius: 24, padding: 24, alignItems: 'center', gap: 14 },
  guideIconBubble: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(32,118,199,0.1)', alignItems: 'center', justifyContent: 'center' },
  guideModalTitle: { fontSize: 18, fontWeight: '900', textAlign: 'center' },
  guideModalDesc: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
  guideDotRow: { flexDirection: 'row', gap: 6, marginVertical: 8 },
  guideDot: { width: 8, height: 8, borderRadius: 4 },
  guideBtnRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginTop: 8 },
  guideSkipBtn: { padding: 10 },
  guideSkipText: { fontSize: 13, color: '#94A3B8', fontWeight: '700' },
  guideNextBtn: { backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
  guideNextText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  policyModalCard: { width: '100%', maxWidth: 380, borderRadius: 24, padding: 20, gap: 16 },
  policyModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  policyListItem: { flexDirection: 'row', gap: 12, paddingVertical: 12, borderBottomWidth: 1, alignItems: 'flex-start' },
  policyItemTitle: { fontSize: 13, fontWeight: '800' },
  policyItemDesc: { fontSize: 11, marginTop: 2 },
});
