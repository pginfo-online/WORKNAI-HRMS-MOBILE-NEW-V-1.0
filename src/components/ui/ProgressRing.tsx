import React from 'react';
import { View, StyleSheet } from 'react-native';

interface ProgressRingProps {
  size?: number;
  strokeWidth?: number;
  percentage: number;
  color?: string;
  bgColor?: string;
  children?: React.ReactNode;
}

export function ProgressRing({
  size = 70,
  strokeWidth = 7,
  percentage,
  color = '#2076C7',
  bgColor = 'rgba(0,0,0,0.08)',
  children,
}: ProgressRingProps) {
  const clampedPct = Math.min(100, Math.max(0, percentage));
  const innerSize = size - strokeWidth * 2;

  // Pure React Native circular ring visual
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: strokeWidth,
        borderColor: clampedPct > 0 ? color : bgColor,
        backgroundColor: 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: innerSize,
          height: innerSize,
          borderRadius: innerSize / 2,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {children}
      </View>
    </View>
  );
}
