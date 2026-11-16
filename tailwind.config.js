/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        'border-strong': 'hsl(var(--border-strong))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',

        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },

        // ---- Extensões DiskIngressos OS (Financeiro & Estornos) ----
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
          soft: 'hsl(var(--success-soft))',
          'soft-foreground': 'hsl(var(--success-soft-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
          soft: 'hsl(var(--warning-soft))',
          'soft-foreground': 'hsl(var(--warning-soft-foreground))',
        },
        info: {
          DEFAULT: 'hsl(var(--info))',
          foreground: 'hsl(var(--info-foreground))',
          soft: 'hsl(var(--info-soft))',
          'soft-foreground': 'hsl(var(--info-soft-foreground))',
        },

        // ---- Paleta de compatibilidade legada sincronizada ao Design System Global v1.0 (UI-004 / UI-009) ----
        brand: {
          sidebar: 'var(--safesaff-sidebar, #161D29)',
          sidebarActive: 'var(--disk-color-primary, #155EEF)',
          submenuActive: 'var(--disk-color-primary-active, #1E40AF)',
          header: 'var(--safesaff-sidebar, #161D29)',
          headerSearch: '#1D2735',
          bg: 'hsl(var(--background))',
          card: 'hsl(var(--card))',
          border: 'hsl(var(--border))',
          inputBorder: 'hsl(var(--input))',
          blue: 'var(--disk-color-primary, #155EEF)',
          blueHover: 'var(--disk-color-primary-hover, #1D4ED8)',
          green: 'var(--disk-color-success, #16734A)',
          orange: 'var(--disk-color-warning, #BD5D00)',
          red: 'var(--disk-color-danger, #C1273C)',
          cyan: 'var(--safesaff-accent-cyan, #009AC2)',
          purple: 'var(--safesaff-accent-violet, #7942D8)',
          slate: 'hsl(var(--muted-foreground))',
          textMain: 'hsl(var(--foreground))',
          textMuted: 'hsl(var(--muted-foreground))',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px rgba(0, 0, 0, 0.05)',
        cardHover: '0 6px 20px rgba(15, 23, 42, 0.08)',
        dropdown: '0 10px 25px -5px rgba(15, 23, 42, 0.15), 0 8px 10px -6px rgba(15, 23, 42, 0.1)',
        inputFocus: '0 0 0 3px rgba(22, 119, 255, 0.10)',
      },
      borderRadius: {
        card: '10px',
        btn: '8px',
        input: '8px',
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [],
}
