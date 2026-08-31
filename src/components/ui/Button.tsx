import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { colors } from '../../constants/colors';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'gradient';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  style,
  textStyle,
}) => {
  const handlePress = () => {
    if (disabled || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const getContainerStyle = (): ViewStyle => {
    const s: ViewStyle = { ...styles.base, ...styles[size] };
    if (disabled) s.opacity = 0.5;

    switch (variant) {
      case 'secondary':
        return { ...s, backgroundColor: colors.light.surfaceAlt };
      case 'outline':
        return { ...s, backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.primary };
      case 'danger':
        return { ...s, backgroundColor: colors.error };
      case 'primary':
      default:
        return { ...s, backgroundColor: colors.primary };
    }
  };

  const getTextStyle = (): TextStyle => {
    const textBase = size === 'sm' ? styles.textSm : size === 'lg' ? styles.textLg : styles.textMd;
    switch (variant) {
      case 'outline':
        return { ...textBase, color: colors.primary, ...textStyle };
      case 'secondary':
        return { ...textBase, color: colors.light.text, ...textStyle };
      default:
        return { ...textBase, color: '#FFFFFF', ...textStyle };
    }
  };

  if (variant === 'gradient' && !disabled) {
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={handlePress}
        disabled={disabled || loading}
        style={style}
      >
        <LinearGradient
          colors={colors.gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.base, styles[size]]}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              {icon}
              <Text style={getTextStyle()}>{title}</Text>
            </>
          )}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={handlePress}
      disabled={disabled || loading}
      style={[getContainerStyle(), style]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' ? colors.primary : '#FFFFFF'} size="small" />
      ) : (
        <>
          {icon}
          <Text style={getTextStyle()}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  sm: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 10,
    minHeight: 38,
  },
  md: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    minHeight: 46,
  },
  lg: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14,
    minHeight: 52,
  },
  textSm: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  textMd: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  textLg: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});
