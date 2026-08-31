import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Image,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useAuthStore } from '../../../store/auth.store';
import { useUIStore, ThemeMode } from '../../../store/ui.store';
import { useTaskStore } from '../../../store/task.store';
import { authApi } from '../../../api/auth.api';
import { colors, roleColors } from '../../../constants/colors';
import { Card } from '../../../components/ui/Card';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { AttendanceFeedback } from '../../../components/ui/AttendanceFeedback';
import { useAttendanceFeedback } from '../../../hooks/useAttendanceFeedback';
import { ErrorBoundary } from '../../../components/ErrorBoundary';

function ProfileContent() {
  const router = useRouter();
  const { user, updateUser, logout } = useAuthStore();
  const { isDark, themeMode, setThemeMode, theme } = useUIStore();
  const { tasks } = useTaskStore();
  const { feedbackState, showFeedback, hideFeedback } = useAttendanceFeedback();

  // Fresh profile query
  const { data: profileData } = useQuery({
    queryKey: ['my-profile'],
    queryFn: () =>
      authApi.getMe().then((res) => {
        const fresh = res.data.data;
        if (fresh) updateUser(fresh);
        return fresh;
      }),
  });

  const emp = profileData || user;

  // Change Password State
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  const changePasswordMutation = useMutation({
    mutationFn: () => authApi.changePassword({ currentPassword, newPassword }),
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowPasswordModal(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showFeedback({
        message: 'Password Changed ✓',
        subMessage: 'Your password was updated successfully.',
        variant: 'success',
        duration: 2500,
      });
    },
    onError: (err: any) => {
      showFeedback({
        message: 'Failed to Change Password',
        subMessage: err.response?.data?.message || err.message || 'Please check your current password.',
        variant: 'error',
      });
    },
  });

  const handlePasswordSubmit = () => {
    if (!currentPassword) {
      showFeedback({ message: 'Current Password Required', variant: 'warning' });
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      showFeedback({ message: 'Password Too Short', subMessage: 'New password must be at least 6 characters.', variant: 'warning' });
      return;
    }
    if (newPassword !== confirmPassword) {
      showFeedback({ message: 'Passwords Do Not Match', subMessage: 'New password and confirm password must match.', variant: 'warning' });
      return;
    }
    changePasswordMutation.mutate();
  };

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

  const roleStyle = emp?.role ? roleColors[emp.role] : { bg: '#F1F5F9', text: '#475569' };
  const completedTasksCount = tasks.filter((t) => t.status === 'Completed').length;

  const handleThemeChange = (mode: ThemeMode) => {
    Haptics.selectionAsync();
    setThemeMode(mode);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader title="Account Profile" subtitle="Your work identity & settings" />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* User Profile Header Card */}
        <Card style={styles.userCard}>
          <View style={styles.userHeaderRow}>
            {emp?.profileImageUrl ? (
              <Image key={emp.profileImageUrl} source={{ uri: emp.profileImageUrl }} style={styles.avatarImg} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
                <Text style={styles.avatarLetter}>{emp?.name?.charAt(0) || 'U'}</Text>
              </View>
            )}
            <View style={styles.userInfo}>
              <Text style={[styles.userName, { color: theme.text }]}>{emp?.name || 'Employee'}</Text>
              <Text style={[styles.userCode, { color: theme.textSecondary }]}>
                {emp?.employeeCode} · {emp?.email}
              </Text>
              {emp?.role && (
                <View style={[styles.roleBadge, { backgroundColor: roleStyle?.bg || '#E2E8F0' }]}>
                  <Text style={[styles.roleText, { color: roleStyle?.text || '#1E293B' }]}>{emp.role}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Quick Actions Row */}
          <View style={styles.quickActionsRow}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                Haptics.selectionAsync();
                router.push('/(tabs)/profile/edit');
              }}
              style={[styles.actionBtn, { backgroundColor: colors.primary }]}
            >
              <Ionicons name="create-outline" size={16} color="#FFFFFF" />
              <Text style={styles.actionBtnText}>Edit Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => {
                Haptics.selectionAsync();
                setShowPasswordModal(true);
              }}
              style={[styles.actionBtnSecondary, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
            >
              <Ionicons name="key-outline" size={16} color={colors.primary} />
              <Text style={[styles.actionBtnSecondaryText, { color: theme.text }]}>Change Password</Text>
            </TouchableOpacity>
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
              onPress={() => router.push('/(tabs)/attendance/tasks')}
              style={[styles.viewTasksBtn, { backgroundColor: 'rgba(32,118,199,0.1)' }]}
            >
              <Text style={[styles.viewTasksText, { color: colors.primary }]}>View</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </Card>

        {/* Employment Information */}
        <Card style={styles.detailsCard}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="briefcase-outline" size={18} color={colors.primary} />
            <Text style={[styles.cardHeading, { color: theme.textSecondary }]}>Employment Details</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.textTertiary }]}>Department</Text>
            <Text style={[styles.detailVal, { color: theme.text }]}>{emp?.department || 'Staff'}</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.textTertiary }]}>Position / Designation</Text>
            <Text style={[styles.detailVal, { color: theme.text }]}>{emp?.position || 'Employee'}</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.textTertiary }]}>Paid Leave Balance</Text>
            <Text style={[styles.detailVal, { color: colors.primary, fontWeight: '800' }]}>
              {emp?.paidLeaveBalance ?? 0} days
            </Text>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.textTertiary }]}>Comp-Off Balance</Text>
            <Text style={[styles.detailVal, { color: colors.primary, fontWeight: '800' }]}>
              {emp?.compOffBalance ?? 0} days
            </Text>
          </View>
        </Card>

        {/* Personal & Contact Details */}
        <Card style={styles.detailsCard}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="person-outline" size={18} color="#8B5CF6" />
            <Text style={[styles.cardHeading, { color: theme.textSecondary }]}>Personal & Contact</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.textTertiary }]}>Primary Mobile</Text>
            <Text style={[styles.detailVal, { color: theme.text }]}>{emp?.mobileNumber || 'Not set'}</Text>
          </View>
          {emp?.alternateMobileNumber ? (
            <>
              <View style={[styles.divider, { backgroundColor: theme.border }]} />
              <View style={styles.detailRow}>
                <Text style={[styles.detailLabel, { color: theme.textTertiary }]}>Alternate Mobile</Text>
                <Text style={[styles.detailVal, { color: theme.text }]}>{emp.alternateMobileNumber}</Text>
              </View>
            </>
          ) : null}
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.textTertiary }]}>Blood Group</Text>
            <Text style={[styles.detailVal, { color: theme.text }]}>{emp?.bloodGroup || 'Not specified'}</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <View style={styles.detailRow}>
            <Text style={[styles.detailLabel, { color: theme.textTertiary }]}>Marital Status</Text>
            <Text style={[styles.detailVal, { color: theme.text }]}>{emp?.maritalStatus || 'Not specified'}</Text>
          </View>
        </Card>

        {/* Address Information */}
        {(emp?.currentAddress || emp?.permanentAddress) ? (
          <Card style={styles.detailsCard}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="home-outline" size={18} color="#10B981" />
              <Text style={[styles.cardHeading, { color: theme.textSecondary }]}>Residence Address</Text>
            </View>

            {emp?.currentAddress ? (
              <View style={styles.addressBlock}>
                <Text style={[styles.detailLabel, { color: theme.textTertiary }]}>Current Residence</Text>
                <Text style={[styles.addressText, { color: theme.text }]}>{emp.currentAddress}</Text>
              </View>
            ) : null}

            {emp?.permanentAddress ? (
              <>
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <View style={styles.addressBlock}>
                  <Text style={[styles.detailLabel, { color: theme.textTertiary }]}>Permanent Residence</Text>
                  <Text style={[styles.addressText, { color: theme.text }]}>{emp.permanentAddress}</Text>
                </View>
              </>
            ) : null}
          </Card>
        ) : null}

        {/* Emergency Contact */}
        {(emp?.emergencyContactName || emp?.emergencyContactMobile) ? (
          <Card style={styles.detailsCard}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="alert-circle-outline" size={18} color="#EF4444" />
              <Text style={[styles.cardHeading, { color: theme.textSecondary }]}>Emergency Contact</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={[styles.detailLabel, { color: theme.textTertiary }]}>Contact Name</Text>
              <Text style={[styles.detailVal, { color: theme.text }]}>
                {emp?.emergencyContactName} {emp?.emergencyContactRelationship ? `(${emp.emergencyContactRelationship})` : ''}
              </Text>
            </View>
            {emp?.emergencyContactMobile ? (
              <>
                <View style={[styles.divider, { backgroundColor: theme.border }]} />
                <View style={styles.detailRow}>
                  <Text style={[styles.detailLabel, { color: theme.textTertiary }]}>Emergency Mobile</Text>
                  <Text style={[styles.detailVal, { color: '#EF4444', fontWeight: '700' }]}>{emp.emergencyContactMobile}</Text>
                </View>
              </>
            ) : null}
          </Card>
        ) : null}

        {/* App Appearance Preferences */}
        <Card style={styles.settingsCard}>
          <Text style={[styles.cardHeading, { color: theme.textSecondary }]}>Appearance Theme</Text>

          <View style={[styles.segmentRow, { backgroundColor: theme.surfaceAlt }]}>
            {(
              [
                { id: 'light' as const, label: 'Light', icon: 'sunny-outline' },
                { id: 'dark' as const, label: 'Dark', icon: 'moon-outline' },
                { id: 'system' as const, label: 'System', icon: 'options-outline' },
              ]
            ).map((item) => {
              const active = themeMode === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => handleThemeChange(item.id)}
                  style={[
                    styles.segmentBtn,
                    active && { backgroundColor: theme.surface, borderColor: theme.border },
                  ]}
                >
                  <Ionicons
                    name={item.icon as any}
                    size={16}
                    color={active ? colors.primary : theme.textSecondary}
                  />
                  <Text
                    style={[
                      styles.segmentText,
                      { color: active ? colors.primary : theme.textSecondary },
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>

        {/* Logout Button */}
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={20} color="#DC2626" />
          <Text style={styles.logoutText}>Sign Out of WorknAI HRMS</Text>
        </TouchableOpacity>

        {/* Brand Footer */}
        <View style={styles.brandFooter}>
          <Image
            source={require('../../../../assets/images/logo.png')}
            style={styles.footerLogoImg}
            resizeMode="contain"
          />
          <Text style={[styles.footerVersionText, { color: theme.textTertiary }]}>
            WorknAI HRMS v1.0.0 · Build 2026.1
          </Text>
        </View>
      </ScrollView>

      {/* Change Password Modal */}
      <Modal
        visible={showPasswordModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPasswordModal(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalKav}
          >
            <View style={[styles.modalCard, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={styles.modalHeader}>
                <View style={[styles.modalIconBg, { backgroundColor: 'rgba(139,92,246,0.12)' }]}>
                  <Ionicons name="key-outline" size={22} color="#8B5CF6" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalTitle, { color: theme.text }]}>Change Password</Text>
                  <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
                    Ensure your account stays protected
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setShowPasswordModal(false)} style={styles.modalCloseBtn}>
                  <Ionicons name="close" size={20} color={theme.textTertiary} />
                </TouchableOpacity>
              </View>

              <View style={styles.modalBody}>
                {/* Current Password */}
                <View style={styles.modalField}>
                  <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Current Password *</Text>
                  <View style={[styles.modalInputWrap, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
                    <TextInput
                      style={[styles.modalInput, { color: theme.text }]}
                      secureTextEntry={!showCurrentPass}
                      value={currentPassword}
                      onChangeText={setCurrentPassword}
                      placeholder="Enter current password"
                      placeholderTextColor={theme.textTertiary}
                    />
                    <TouchableOpacity onPress={() => setShowCurrentPass(!showCurrentPass)}>
                      <Ionicons
                        name={showCurrentPass ? 'eye-off-outline' : 'eye-outline'}
                        size={18}
                        color={theme.textTertiary}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* New Password */}
                <View style={styles.modalField}>
                  <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>New Password *</Text>
                  <View style={[styles.modalInputWrap, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
                    <TextInput
                      style={[styles.modalInput, { color: theme.text }]}
                      secureTextEntry={!showNewPass}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      placeholder="Min. 6 characters"
                      placeholderTextColor={theme.textTertiary}
                    />
                    <TouchableOpacity onPress={() => setShowNewPass(!showNewPass)}>
                      <Ionicons
                        name={showNewPass ? 'eye-off-outline' : 'eye-outline'}
                        size={18}
                        color={theme.textTertiary}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Confirm Password */}
                <View style={styles.modalField}>
                  <Text style={[styles.modalLabel, { color: theme.textSecondary }]}>Confirm New Password *</Text>
                  <View style={[styles.modalInputWrap, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
                    <TextInput
                      style={[styles.modalInput, { color: theme.text }]}
                      secureTextEntry={!showConfirmPass}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      placeholder="Re-type new password"
                      placeholderTextColor={theme.textTertiary}
                    />
                    <TouchableOpacity onPress={() => setShowConfirmPass(!showConfirmPass)}>
                      <Ionicons
                        name={showConfirmPass ? 'eye-off-outline' : 'eye-outline'}
                        size={18}
                        color={theme.textTertiary}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  onPress={() => setShowPasswordModal(false)}
                  style={[styles.modalCancelBtn, { borderColor: theme.border }]}
                >
                  <Text style={[styles.modalCancelText, { color: theme.textSecondary }]}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={handlePasswordSubmit}
                  disabled={changePasswordMutation.isPending}
                  style={[styles.modalSubmitBtn, { backgroundColor: colors.primary, opacity: changePasswordMutation.isPending ? 0.7 : 1 }]}
                >
                  {changePasswordMutation.isPending ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.modalSubmitText}>Update Password</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

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

export default function ProfileScreen() {
  return (
    <ErrorBoundary>
      <ProfileContent />
    </ErrorBoundary>
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
    padding: 18,
    gap: 16,
  },
  userHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
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
  avatarImg: {
    width: 60,
    height: 60,
    borderRadius: 20,
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
    fontSize: 13,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 2,
  },
  roleText: {
    fontSize: 11,
    fontWeight: '800',
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    borderRadius: 12,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  actionBtnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionBtnSecondaryText: {
    fontSize: 13,
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
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(32,118,199,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityTitle: {
    fontSize: 14,
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  viewTasksText: {
    fontSize: 12,
    fontWeight: '700',
  },
  detailsCard: {
    padding: 18,
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  cardHeading: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  detailVal: {
    fontSize: 13,
    fontWeight: '700',
  },
  addressBlock: {
    gap: 4,
  },
  addressText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  divider: {
    height: 1,
  },
  settingsCard: {
    padding: 18,
    gap: 12,
  },
  segmentRow: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '700',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
  },
  logoutText: {
    color: '#DC2626',
    fontSize: 14,
    fontWeight: '800',
  },
  brandFooter: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
  },
  footerLogoImg: {
    width: 32,
    height: 32,
    opacity: 0.8,
  },
  footerVersionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalKav: {
    width: '100%',
    maxWidth: 400,
  },
  modalCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalIconBg: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  modalSubtitle: {
    fontSize: 12,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalBody: {
    gap: 12,
  },
  modalField: {
    gap: 6,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  modalInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  modalInput: {
    flex: 1,
    fontSize: 14,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  modalCancelBtn: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '700',
  },
  modalSubmitBtn: {
    flex: 1.5,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubmitText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
