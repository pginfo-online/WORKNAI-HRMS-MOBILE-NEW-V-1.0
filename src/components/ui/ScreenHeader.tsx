import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, StatusBar, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useUIStore } from '../../store/ui.store';

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  showBack?: boolean;
  showLogo?: boolean;
  leftAction?: React.ReactNode;
  rightAction?: React.ReactNode;
  onBackPress?: () => void;
}

export const ScreenHeader: React.FC<ScreenHeaderProps> = ({
  title,
  subtitle,
  showBack = false,
  showLogo = false,
  leftAction,
  rightAction,
  onBackPress,
}) => {
  const router = useRouter();
  const { theme } = useUIStore();
  const insets = useSafeAreaInsets();
  const isBackInProgressRef = React.useRef(false);

  const handleBack = () => {
    if (isBackInProgressRef.current) return;
    isBackInProgressRef.current = true;
    setTimeout(() => {
      isBackInProgressRef.current = false;
    }, 450);

    if (onBackPress) {
      onBackPress();
      return;
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/attendance' as any);
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: Math.max(insets.top, Platform.OS === 'android' ? StatusBar.currentHeight || 20 : 20) + 8,
          borderBottomColor: theme.border,
          backgroundColor: theme.background,
        },
      ]}
    >
      <View style={styles.leftRow}>
        {showBack && (
          <TouchableOpacity
            onPress={handleBack}
            style={[styles.backBtn, { backgroundColor: theme.surfaceAlt }]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="chevron-back" size={20} color={theme.text} />
          </TouchableOpacity>
        )}

        {showLogo && (
          <View style={[styles.logoBadge, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
            <Image
              source={require('../../../assets/images/logo.png')}
              style={styles.logoImg}
              resizeMode="contain"
            />
          </View>
        )}

        {leftAction}

        <View style={{ flexShrink: 1 }}>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={[styles.subtitle, { color: theme.textSecondary }]} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
      </View>

      {rightAction && <View style={styles.rightWrap}>{rightAction}</View>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  logoBadge: {
    width: 40,
    height: 40,
    aspectRatio: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 3,
    borderWidth: 1,
    overflow: 'hidden',
  },
  logoImg: {
    width: '100%',
    height: '100%',
    aspectRatio: 1,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightWrap: {
    marginLeft: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
});
