export const colors = {
  // Brand
  primary: '#2076C7',
  primaryLight: '#4A9BE8',
  primaryDark: '#165B9C',
  teal: '#1CADA3',
  tealLight: '#38C9BF',
  tealDark: '#14857D',

  // System
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',

  // Light Mode
  light: {
    background: '#F8FAFC',
    surface: '#FFFFFF',
    surfaceAlt: '#F1F5F9',
    text: '#0F172A',
    textSecondary: '#64748B',
    textTertiary: '#94A3B8',
    border: '#E2E8F0',
    card: '#FFFFFF',
    tabBar: '#FFFFFF',
  },

  // Dark Mode
  dark: {
    background: '#0B1120',
    surface: '#131D31',
    surfaceAlt: '#1E293B',
    text: '#F8FAFC',
    textSecondary: '#94A3B8',
    textTertiary: '#64748B',
    border: '#27354E',
    card: '#131D31',
    tabBar: '#0F172A',
  },

  // Gradients
  gradients: {
    primary: ['#2076C7', '#1CADA3'] as const,
    accent: ['#6366F1', '#4F46E5'] as const,
    success: ['#10B981', '#059669'] as const,
    warning: ['#F59E0B', '#D97706'] as const,
    dark: ['#1E293B', '#0F172A'] as const,
  },
};

export const roleColors: Record<string, { bg: string; text: string }> = {
  SuperUser: { bg: '#FEF3C7', text: '#92400E' },
  HR: { bg: '#DBEAFE', text: '#1E40AF' },
  Manager: { bg: '#D1FAE5', text: '#065F46' },
  Director: { bg: '#EDE9FE', text: '#4C1D95' },
  VP: { bg: '#FCE7F3', text: '#831843' },
  GM: { bg: '#E0F2FE', text: '#0C4A6E' },
  Employee: { bg: '#F1F5F9', text: '#334155' },
  Intern: { bg: '#FDF4FF', text: '#6B21A8' },
};
