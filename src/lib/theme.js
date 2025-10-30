// Theme configuration for easy customization
export const theme = {
  colors: {
    primary: {
      DEFAULT: 'var(--color-primary)',
      hover: 'var(--color-primary-hover)',
      light: 'var(--color-primary-light)',
    },
    secondary: {
      DEFAULT: 'var(--color-secondary)',
      hover: 'var(--color-secondary-hover)',
    },
    background: {
      primary: 'var(--color-bg-primary)',
      secondary: 'var(--color-bg-secondary)',
      tertiary: 'var(--color-bg-tertiary)',
    },
    text: {
      primary: 'var(--color-text-primary)',
      secondary: 'var(--color-text-secondary)',
      tertiary: 'var(--color-text-tertiary)',
    },
    border: {
      DEFAULT: 'var(--color-border)',
      hover: 'var(--color-border-hover)',
    },
    success: 'var(--color-success)',
    error: 'var(--color-error)',
  },
  spacing: {
    xs: 'var(--spacing-xs)',
    sm: 'var(--spacing-sm)',
    md: 'var(--spacing-md)',
    lg: 'var(--spacing-lg)',
    xl: 'var(--spacing-xl)',
  },
  borderRadius: {
    sm: 'var(--radius-sm)',
    md: 'var(--radius-md)',
    lg: 'var(--radius-lg)',
  },
  fontSize: {
    xs: 'var(--font-size-xs)',
    sm: 'var(--font-size-sm)',
    base: 'var(--font-size-base)',
    lg: 'var(--font-size-lg)',
    xl: 'var(--font-size-xl)',
    '2xl': 'var(--font-size-2xl)',
  },
  transitions: {
    fast: 'var(--transition-fast)',
    base: 'var(--transition-base)',
    slow: 'var(--transition-slow)',
  },
  shadows: {
    sm: 'var(--shadow-sm)',
    md: 'var(--shadow-md)',
    lg: 'var(--shadow-lg)',
  },
};

// Helper function to apply theme styles
export function getThemeStyles(styles) {
  return Object.entries(styles).reduce((acc, [key, value]) => {
    if (typeof value === 'string' && value.startsWith('var(')) {
      acc[key] = value;
    } else {
      acc[key] = value;
    }
    return acc;
  }, {});
}