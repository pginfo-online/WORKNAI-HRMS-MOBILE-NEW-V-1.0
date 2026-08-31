/**
 * AttendanceFeedback.tsx
 *
 * PhonePe-style non-blocking animated bottom feedback bar.
 * Replaces Toast notifications on the Attendance screen family.
 *
 * Features:
 *  - Spring slide-up / slide-down animation (Reanimated 3)
 *  - Sits above the tab bar using safe area insets
 *  - 5 variants: success, error, warning, info, loading
 *  - Auto-dismiss controlled by the parent (via useAttendanceFeedback hook)
 *  - Tap to dismiss
 *  - Non-blocking: hidden state has pointerEvents="none"
 *  - Accessible with proper roles
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useUIStore } from '../../store/ui.store';

// ── Types ────────────────────────────────────────────────────────────────────

export type FeedbackVariant = 'success' | 'error' | 'warning' | 'info' | 'loading';

export interface AttendanceFeedbackProps {
  visible: boolean;
  message: string;
  subMessage?: string;
  variant: FeedbackVariant;
  /** Called when the user taps the bar or when auto-dismiss fires */
  onHide: () => void;
}

// ── Design tokens (Light & Dark) ─────────────────────────────────────────────

interface VariantStyle {
  bg: string;
  border: string;
  icon: keyof typeof Ionicons.glyphMap | null;
  iconColor: string;
  textColor: string;
}

const LIGHT_VARIANTS: Record<FeedbackVariant, VariantStyle> = {
  success: {
    bg: '#ECFDF5',
    border: '#6EE7B7',
    icon: 'checkmark-circle',
    iconColor: '#059669',
    textColor: '#065F46',
  },
  error: {
    bg: '#FEF2F2',
    border: '#FECACA',
    icon: 'close-circle',
    iconColor: '#DC2626',
    textColor: '#7F1D1D',
  },
  warning: {
    bg: '#FFFBEB',
    border: '#FDE68A',
    icon: 'warning',
    iconColor: '#D97706',
    textColor: '#78350F',
  },
  info: {
    bg: '#EFF6FF',
    border: '#BFDBFE',
    icon: 'information-circle',
    iconColor: '#2563EB',
    textColor: '#1E3A8A',
  },
  loading: {
    bg: '#F8FAFC',
    border: '#CBD5E1',
    icon: null,
    iconColor: '#64748B',
    textColor: '#1E293B',
  },
};

const DARK_VARIANTS: Record<FeedbackVariant, VariantStyle> = {
  success: {
    bg: '#064E3B',
    border: '#059669',
    icon: 'checkmark-circle',
    iconColor: '#34D399',
    textColor: '#ECFDF5',
  },
  error: {
    bg: '#450A0A',
    border: '#DC2626',
    icon: 'close-circle',
    iconColor: '#F87171',
    textColor: '#FEF2F2',
  },
  warning: {
    bg: '#451A03',
    border: '#D97706',
    icon: 'warning',
    iconColor: '#FBBF24',
    textColor: '#FFFBEB',
  },
  info: {
    bg: '#1E1B4B',
    border: '#3B82F6',
    icon: 'information-circle',
    iconColor: '#60A5FA',
    textColor: '#EFF6FF',
  },
  loading: {
    bg: '#0F172A',
    border: '#334155',
    icon: null,
    iconColor: '#94A3B8',
    textColor: '#F8FAFC',
  },
};

const SLIDE_DISTANCE = 100;
const SPRING_CONFIG = { damping: 22, stiffness: 220, mass: 0.8 };
const TIMING_CONFIG = { duration: 180 };

// ── Component ─────────────────────────────────────────────────────────────────

export const AttendanceFeedback: React.FC<AttendanceFeedbackProps> = ({
  visible,
  message,
  subMessage,
  variant,
  onHide,
}) => {
  const insets = useSafeAreaInsets();
  const { isDark } = useUIStore();
  const translateY = useSharedValue(SLIDE_DISTANCE);
  const opacity = useSharedValue(0);

  const palette = isDark ? DARK_VARIANTS : LIGHT_VARIANTS;
  const config = palette[variant] ?? palette.info;

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, SPRING_CONFIG);
      opacity.value = withTiming(1, TIMING_CONFIG);
    } else {
      translateY.value = withTiming(SLIDE_DISTANCE, TIMING_CONFIG, (finished) => {
        if (finished) runOnJS(() => {})();
      });
      opacity.value = withTiming(0, TIMING_CONFIG);
    }
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  // Bottom position: above the safe-area bottom (handles tab bar)
  const bottomOffset = insets.bottom + 16;

  return (
    <Animated.View
      style={[styles.wrapper, animatedStyle, { bottom: bottomOffset }]}
      pointerEvents={visible ? 'auto' : 'none'}
      accessibilityRole="alert"
      accessibilityLabel={message}
      accessibilityLiveRegion="polite"
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onHide}
        style={[
          styles.bar,
          {
            backgroundColor: config.bg,
            borderColor: config.border,
          },
        ]}
      >
        {/* Icon / Spinner */}
        <View style={styles.iconWrap}>
          {variant === 'loading' ? (
            <ActivityIndicator size="small" color={config.iconColor} />
          ) : config.icon ? (
            <Ionicons name={config.icon} size={22} color={config.iconColor} />
          ) : null}
        </View>

        {/* Text */}
        <View style={styles.textBlock}>
          <Text style={[styles.messageText, { color: config.textColor }]} numberOfLines={2}>
            {message}
          </Text>
          {subMessage ? (
            <Text style={[styles.subText, { color: config.textColor, opacity: 0.75 }]} numberOfLines={2}>
              {subMessage}
            </Text>
          ) : null}
        </View>

        {/* Dismiss */}
        {variant !== 'loading' && (
          <TouchableOpacity
            onPress={onHide}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.dismissBtn}
          >
            <Ionicons name="close" size={16} color={config.iconColor} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1.5,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 6,
  },
  iconWrap: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: {
    flex: 1,
    gap: 2,
  },
  messageText: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  subText: {
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 15,
  },
  dismissBtn: {
    padding: 2,
  },
});
