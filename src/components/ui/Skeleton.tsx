/**
 * Skeleton.tsx — Premium shimmer skeleton component
 *
 * Upgrades:
 *  - Left-to-right shimmer gradient sweep (replaces opacity pulse)
 *  - Uses expo-linear-gradient for the sweep effect
 *  - Backward-compatible props
 *  - Exports SkeletonCircle, SkeletonText convenience wrappers
 */

import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useUIStore } from '../../store/ui.store';

// ── Types ─────────────────────────────────────────────────────────────────────

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

// ── Main Skeleton ─────────────────────────────────────────────────────────────

export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 8,
  style,
}) => {
  const { isDark } = useUIStore();
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  const baseBg = isDark ? '#1E293B' : '#E2E8F0';
  const shimmerColors: [string, string, string] = isDark
    ? ['#1E293B', '#2D3F55', '#1E293B']
    : ['#E2E8F0', '#F8FAFC', '#E2E8F0'];

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      })
    );
    animation.start();
    return () => animation.stop();
  }, [shimmerAnim]);

  const translateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-350, 350],
  });

  return (
    <View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: baseBg,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Animated.View
        style={[StyleSheet.absoluteFill, { transform: [{ translateX }] }]}
      >
        <LinearGradient
          colors={shimmerColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
};

// ── Convenience wrappers ──────────────────────────────────────────────────────

export const SkeletonCircle: React.FC<{ size?: number; style?: ViewStyle }> = ({
  size = 40,
  style,
}) => (
  <Skeleton width={size} height={size} borderRadius={size / 2} style={style} />
);

export const SkeletonText: React.FC<{
  width?: number | string;
  lines?: number;
  lineHeight?: number;
  gap?: number;
  style?: ViewStyle;
}> = ({ width = '100%', lines = 1, lineHeight = 14, gap = 8, style }) => (
  <View style={[{ gap }, style]}>
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton
        key={i}
        width={i === lines - 1 && lines > 1 ? '70%' : (width as any)}
        height={lineHeight}
        borderRadius={4}
      />
    ))}
  </View>
);
