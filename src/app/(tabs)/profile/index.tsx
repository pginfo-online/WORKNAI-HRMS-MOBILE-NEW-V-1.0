import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../../store/auth.store';
import { useUIStore } from '../../../store/ui.store';
import { useTaskStore } from '../../../store/task.store';
import { colors, roleColors } from '../../../constants/colors';
import { Card } from '../../../components/ui/Card';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const { isDark, setThemeMode, theme } = useUIStore();
  const { tasks } = useTaskStore();

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out of WorknAI HRMS?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => logout(),
      },
    ]);
  };

  const roleStyle = user?.role ? roleColors[user.role] : { bg: '#F1F5F9', text: '#475569' };
  const completedTasksCount = tasks.filter((t) => t.status === 'Completed').length;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader title="Account Profile" subtitle="Information & Settings" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* User Profile Card */}
        <Card style={styles.userCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarLetter}>{user?.name?.charAt(0) || 'U'}</Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={[styles.userName, { color: theme.text }]}>{user?.name || 'Employee'}</Text>
            <Text style={[styles.userCode, { color: theme.textSecondary }]}>
              {user?.employeeCode} · {user?.email}
            </Text>
            {user?.role && (
              <View style={[styles.roleBadge, { backgroundColor: roleStyle?.bg || '#E2E8F0' }]}>
                <Text style={[styles.roleText, { color: roleStyle?.text || '#1E293B' }]}>{user.role}</Text>
              </View>
            )}
          </View>
        </Card>

        {/* Task Activity Quick Card */}
        <Card style={styles.activityCard}>
          <View style={styles.activityHeader}>
            <View style={styles.activityIconBg}>
              <Ionicons name="checkbox-outline" size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.activityTitle, { color: theme.text }]}>Today's Task Activity</Text>
              <Text style={[styles.activitySub, { color: theme.textSecondary }]}>
                {tasks.length > 0
                  ? `${completedTasksCount} of ${tasks.length} tasks completed today`
                  : 'No tasks logged for today yet'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push('/(tabs)/attendance')}
              style={[styles.viewTasksBtn, { backgroundColor: 'rgba(32,118,199,0.1)' }]}
            >
              <Text style={[styles.viewTasksText, { color: colors.primary }]}>View</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </Card>

        {/* Employment Information */}
        <Card style={styles.detailsCard}>
          <Text style={[styles.cardHeading, { color: theme.textSecondary }]}>Employment Details</Text>
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.textTertiary }]}>Department</Text>
            <Text style={[styles.detailVal, { color: theme.text }]}>{user?.department || 'Staff'}</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.textTertiary }]}>Position</Text>
            <Text style={[styles.detailVal, { color: theme.text }]}>{user?.position || 'Employee'}</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.textTertiary }]}>Paid Leave Balance</Text>
            <Text style={[styles.detailVal, { color: colors.primary, fontWeight: '800' }]}>
              {user?.paidLeaveBalance ?? 0} days
            </Text>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.textTertiary }]}>Comp-Off Balance</Text>
            <Text style={[styles.detailVal, { color: colors.primary, fontWeight: '800' }]}>
              {user?.compOffBalance ?? 0} days
            </Text>
          </View>
        </Card>

        {/* App Preferences */}
        <Card style={styles.settingsCard}>
          <Text style={[styles.cardHeading, { color: theme.textSecondary }]}>Preferences</Text>

          {/* Dark Mode Toggle */}
          <TouchableOpacity
            onPress={() => setThemeMode(isDark ? 'light' : 'dark')}
            style={styles.settingRow}
          >
            <View style={styles.settingLeft}>
              <Ionicons
                name={isDark ? 'moon' : 'sunny'}
                size={20}
                color={isDark ? '#818CF8' : '#F59E0B'}
              />
              <Text style={[styles.settingText, { color: theme.text }]}>Dark Mode</Text>
            </View>
            <Ionicons
              name={isDark ? 'toggle' : 'toggle-outline'}
              size={32}
              color={isDark ? colors.primary : theme.textTertiary}
            />
          </TouchableOpacity>
        </Card>

        {/* Logout Button */}
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={20} color="#DC2626" />
          <Text style={styles.logoutText}>Sign Out of WorknAI HRMS</Text>
        </TouchableOpacity>
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
    gap: 16,
    paddingBottom: 40,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 16,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  userInfo: {
    flex: 1,
    gap: 4,
  },
  userName: {
    fontSize: 18,
    fontWeight: '800',
  },
  userCode: {
    fontSize: 12,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 2,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '700',
  },
  activityCard: {
    padding: 16,
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  activityIconBg: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(32,118,199,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  activitySub: {
    fontSize: 12,
    marginTop: 2,
  },
  viewTasksBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  viewTasksText: {
    fontSize: 12,
    fontWeight: '700',
  },
  detailsCard: {
    padding: 20,
    gap: 12,
  },
  cardHeading: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  detailVal: {
    fontSize: 14,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    width: '100%',
  },
  settingsCard: {
    padding: 20,
    gap: 14,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingText: {
    fontSize: 15,
    fontWeight: '600',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#FEE2E2',
    backgroundColor: '#FEF2F2',
    marginTop: 8,
  },
  logoutText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '700',
  },
});
