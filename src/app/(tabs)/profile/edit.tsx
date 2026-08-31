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
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as DocumentPicker from 'expo-document-picker';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../store/auth.store';
import { useUIStore } from '../../../store/ui.store';
import { authApi, UpdateProfileDto } from '../../../api/auth.api';
import { colors } from '../../../constants/colors';
import { Card } from '../../../components/ui/Card';
import { ScreenHeader } from '../../../components/ui/ScreenHeader';
import { AttendanceFeedback } from '../../../components/ui/AttendanceFeedback';
import { useAttendanceFeedback } from '../../../hooks/useAttendanceFeedback';
import { ErrorBoundary } from '../../../components/ErrorBoundary';
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const MARITAL_STATUSES = ['Single', 'Married', 'Divorced', 'Widowed'];
const GENDERS = ['Male', 'Female', 'Other'];

function EditProfileContent() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, updateUser } = useAuthStore();
  const { theme, isDark } = useUIStore();
  const { feedbackState, showFeedback, hideFeedback } = useAttendanceFeedback();

  // Fetch fresh profile data
  const { data: profileRes, isLoading: isFetching } = useQuery({
    queryKey: ['my-profile'],
    queryFn: () => authApi.getMe().then((res) => res.data.data),
  });

  const [form, setForm] = useState<UpdateProfileDto>({
    mobileNumber: '',
    alternateMobileNumber: '',
    gender: '',
    bloodGroup: '',
    maritalStatus: '',
    currentAddress: '',
    permanentAddress: '',
    district: '',
    state: '',
    pincode: '',
    emergencyContactName: '',
    emergencyContactRelationship: '',
    emergencyContactMobile: '',
    emergencyContactAddress: '',
  });

  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<{ uri: string; name: string; type: string } | null>(null);

  useEffect(() => {
    const src = profileRes || user;
    if (src) {
      setForm({
        mobileNumber: src.mobileNumber || '',
        alternateMobileNumber: src.alternateMobileNumber || '',
        gender: src.gender || '',
        bloodGroup: src.bloodGroup || '',
        maritalStatus: src.maritalStatus || '',
        currentAddress: src.currentAddress || '',
        permanentAddress: src.permanentAddress || '',
        district: src.district || '',
        state: src.state || '',
        pincode: src.pincode || '',
        emergencyContactName: src.emergencyContactName || '',
        emergencyContactRelationship: src.emergencyContactRelationship || '',
        emergencyContactMobile: src.emergencyContactMobile || '',
        emergencyContactAddress: src.emergencyContactAddress || '',
      });
      if (src.profileImageUrl) {
        setAvatarUri(src.profileImageUrl);
      }
    }
  }, [profileRes, user]);

  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const avatarMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await authApi.uploadAvatar(formData);
      return res.data.data;
    },
    onSuccess: (data) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (data?.profileImageUrl) {
        setAvatarUri(data.profileImageUrl);
      }
      if (data?.employee) {
        updateUser(data.employee);
        queryClient.setQueryData(['my-profile'], data.employee);
      }
      queryClient.invalidateQueries({ queryKey: ['my-profile'] });
      showFeedback({
        message: 'Photo Uploaded ✓',
        subMessage: 'Your new profile photo was updated successfully.',
        variant: 'success',
        duration: 2000,
      });
    },
    onError: (err: any) => {
      showFeedback({
        message: 'Photo Upload Failed',
        subMessage: err.response?.data?.message || err.message || 'Could not upload profile image.',
        variant: 'error',
      });
    },
    onSettled: () => {
      setIsUploadingAvatar(false);
    },
  });

  const handlePickAvatar = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        const filename = asset.name || `avatar_${Date.now()}.jpg`;
        const mime = asset.mimeType || (filename.endsWith('.png') ? 'image/png' : 'image/jpeg');

        const formData = new FormData();
        formData.append('avatar', {
          uri: asset.uri,
          name: filename,
          type: mime,
        } as any);

        setIsUploadingAvatar(true);
        avatarMutation.mutate(formData);
      }
    } catch {
      showFeedback({ message: 'Could not select photo', variant: 'error' });
    }
  };

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await authApi.updateProfile(form);
      return res.data.data;
    },
    onSuccess: (updatedData) => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      updateUser(updatedData);
      queryClient.setQueryData(['my-profile'], updatedData);
      queryClient.invalidateQueries({ queryKey: ['my-profile'] });
      showFeedback({
        message: 'Profile Updated ✓',
        subMessage: 'Your personal details were saved successfully.',
        variant: 'success',
        duration: 2000,
      });
      setTimeout(() => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace('/(tabs)/profile');
        }
      }, 1200);
    },
    onError: (err: any) => {
      showFeedback({
        message: 'Update Failed',
        subMessage: err.response?.data?.message || err.message || 'Could not save profile changes.',
        variant: 'error',
      });
    },
  });

  const handleSave = () => {
    if (!form.mobileNumber || form.mobileNumber.trim().length < 8) {
      showFeedback({
        message: 'Mobile Number Required',
        subMessage: 'Please enter a valid mobile contact number.',
        variant: 'warning',
      });
      return;
    }
    updateMutation.mutate();
  };

  if (isFetching && !profileRes && !user) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ScreenHeader title="Edit Profile" subtitle="Update your personal, residence & emergency info" showBack />

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
          {/* Avatar Section */}
          <View style={styles.avatarSection}>
            <View style={styles.avatarWrapper}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary }]}>
                  <Text style={styles.avatarLetter}>{user?.name?.charAt(0) || 'U'}</Text>
                </View>
              )}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handlePickAvatar}
                disabled={isUploadingAvatar}
                style={[styles.avatarEditBadge, { backgroundColor: colors.primary }]}
              >
                {isUploadingAvatar ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="camera" size={16} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            </View>
            <Text style={[styles.avatarHint, { color: theme.textSecondary }]}>
              {isUploadingAvatar ? 'Uploading new photo to Cloudinary...' : 'Tap camera icon to change profile photo'}
            </Text>
          </View>

          {/* Section 1: Contact Information */}
          <Card style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.iconBg, { backgroundColor: 'rgba(32,118,199,0.1)' }]}>
                <Ionicons name="call-outline" size={18} color={colors.primary} />
              </View>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Contact Details</Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Primary Mobile Number *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.surfaceAlt, color: theme.text, borderColor: theme.border }]}
                value={form.mobileNumber}
                onChangeText={(text) => setForm({ ...form, mobileNumber: text })}
                placeholder="10-digit mobile number"
                placeholderTextColor={theme.textTertiary}
                keyboardType="phone-pad"
                maxLength={15}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Alternate Mobile (Optional)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.surfaceAlt, color: theme.text, borderColor: theme.border }]}
                value={form.alternateMobileNumber}
                onChangeText={(text) => setForm({ ...form, alternateMobileNumber: text })}
                placeholder="Alternate phone number"
                placeholderTextColor={theme.textTertiary}
                keyboardType="phone-pad"
                maxLength={15}
              />
            </View>
          </Card>

          {/* Section 2: Personal Details */}
          <Card style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.iconBg, { backgroundColor: 'rgba(139,92,246,0.1)' }]}>
                <Ionicons name="person-outline" size={18} color="#8B5CF6" />
              </View>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Personal Attributes</Text>
            </View>

            {/* Blood Group */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Blood Group</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                {BLOOD_GROUPS.map((bg) => {
                  const isSelected = form.bloodGroup === bg;
                  return (
                    <TouchableOpacity
                      key={bg}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setForm({ ...form, bloodGroup: isSelected ? '' : bg });
                      }}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: isSelected
                            ? isDark
                              ? 'rgba(32,118,199,0.3)'
                              : 'rgba(32,118,199,0.12)'
                            : theme.surfaceAlt,
                          borderColor: isSelected ? colors.primary : theme.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          {
                            color: isSelected ? colors.primary : theme.textSecondary,
                            fontWeight: isSelected ? '800' : '600',
                          },
                        ]}
                      >
                        {bg}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Marital Status */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Marital Status</Text>
              <View style={styles.chipGrid}>
                {MARITAL_STATUSES.map((ms) => {
                  const isSelected = form.maritalStatus === ms;
                  return (
                    <TouchableOpacity
                      key={ms}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setForm({ ...form, maritalStatus: isSelected ? '' : ms });
                      }}
                      style={[
                        styles.chip,
                        {
                          flex: 1,
                          backgroundColor: isSelected
                            ? isDark
                              ? 'rgba(32,118,199,0.3)'
                              : 'rgba(32,118,199,0.12)'
                            : theme.surfaceAlt,
                          borderColor: isSelected ? colors.primary : theme.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          {
                            color: isSelected ? colors.primary : theme.textSecondary,
                            fontWeight: isSelected ? '800' : '600',
                          },
                        ]}
                      >
                        {ms}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Gender */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Gender</Text>
              <View style={styles.chipGrid}>
                {GENDERS.map((g) => {
                  const isSelected = form.gender === g;
                  return (
                    <TouchableOpacity
                      key={g}
                      onPress={() => {
                        Haptics.selectionAsync();
                        setForm({ ...form, gender: isSelected ? '' : g });
                      }}
                      style={[
                        styles.chip,
                        {
                          flex: 1,
                          backgroundColor: isSelected
                            ? isDark
                              ? 'rgba(32,118,199,0.3)'
                              : 'rgba(32,118,199,0.12)'
                            : theme.surfaceAlt,
                          borderColor: isSelected ? colors.primary : theme.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          {
                            color: isSelected ? colors.primary : theme.textSecondary,
                            fontWeight: isSelected ? '800' : '600',
                          },
                        ]}
                      >
                        {g}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </Card>

          {/* Section 3: Residence Address */}
          <Card style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.iconBg, { backgroundColor: 'rgba(16,185,129,0.1)' }]}>
                <Ionicons name="home-outline" size={18} color="#10B981" />
              </View>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Address Details</Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Current Residence Address</Text>
              <TextInput
                style={[styles.textArea, { backgroundColor: theme.surfaceAlt, color: theme.text, borderColor: theme.border }]}
                value={form.currentAddress}
                onChangeText={(text) => setForm({ ...form, currentAddress: text })}
                placeholder="Current living address..."
                placeholderTextColor={theme.textTertiary}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Permanent Residence Address</Text>
              <TextInput
                style={[styles.textArea, { backgroundColor: theme.surfaceAlt, color: theme.text, borderColor: theme.border }]}
                value={form.permanentAddress}
                onChangeText={(text) => setForm({ ...form, permanentAddress: text })}
                placeholder="Permanent home address..."
                placeholderTextColor={theme.textTertiary}
                multiline
                numberOfLines={3}
              />
            </View>
          </Card>

          {/* Section 4: Emergency Contact */}
          <Card style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={[styles.iconBg, { backgroundColor: 'rgba(239,68,68,0.1)' }]}>
                <Ionicons name="alert-circle-outline" size={18} color="#EF4444" />
              </View>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Emergency Contact</Text>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Contact Person Name</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.surfaceAlt, color: theme.text, borderColor: theme.border }]}
                value={form.emergencyContactName}
                onChangeText={(text) => setForm({ ...form, emergencyContactName: text })}
                placeholder="e.g. Spouse / Parent"
                placeholderTextColor={theme.textTertiary}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Relationship</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.surfaceAlt, color: theme.text, borderColor: theme.border }]}
                value={form.emergencyContactRelationship}
                onChangeText={(text) => setForm({ ...form, emergencyContactRelationship: text })}
                placeholder="e.g. Father, Mother, Spouse"
                placeholderTextColor={theme.textTertiary}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Emergency Mobile Number</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.surfaceAlt, color: theme.text, borderColor: theme.border }]}
                value={form.emergencyContactMobile}
                onChangeText={(text) => setForm({ ...form, emergencyContactMobile: text })}
                placeholder="10-digit mobile number"
                placeholderTextColor={theme.textTertiary}
                keyboardType="phone-pad"
                maxLength={15}
              />
            </View>
          </Card>

          {/* Save Button */}
          <TouchableOpacity
            onPress={handleSave}
            disabled={updateMutation.isPending}
            style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: updateMutation.isPending ? 0.7 : 1 }]}
          >
            {updateMutation.isPending ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="save-outline" size={18} color="#FFFFFF" />
                <Text style={styles.saveBtnText}>Save Profile Changes</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

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

export default function EditProfileScreen() {
  return (
    <ErrorBoundary>
      <EditProfileContent />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 13, fontWeight: '600' },
  content: { padding: 20, gap: 16, paddingBottom: 80 },
  avatarSection: { alignItems: 'center', gap: 8, marginVertical: 4 },
  avatarWrapper: { position: 'relative' },
  avatarImg: { width: 84, height: 84, borderRadius: 28 },
  avatarPlaceholder: { width: 84, height: 84, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontSize: 32, fontWeight: '900', color: '#FFFFFF' },
  avatarEditBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarHint: { fontSize: 12, fontWeight: '600' },
  card: { padding: 18, gap: 14 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  iconBg: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '800' },
  fieldGroup: { gap: 6 },
  label: { fontSize: 12, fontWeight: '700' },
  input: { height: 48, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, fontSize: 14 },
  textArea: { borderRadius: 12, borderWidth: 1, padding: 12, fontSize: 14, minHeight: 74, textAlignVertical: 'top' },
  chipRow: { gap: 8, paddingVertical: 2 },
  chipGrid: { flexDirection: 'row', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontSize: 12 },
  saveBtn: {
    flexDirection: 'row',
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  saveBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});
