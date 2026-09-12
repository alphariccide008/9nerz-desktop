/** @type {import('tailwindcss').Config} */
// 9nerz brand palette — ported verbatim from 9Nerz-mobile/tailwind.config.js
// so the desktop app matches the mobile app's colors, radii and type scale exactly.
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ink: "#202B4E",
        teal: "#1F7A66",
        amber: "#F2A93B",
        slate: "#5B6472",
        cloud: "#F6F7FA",
        charcoal: "#12172A",
        hairline: "#E2E5EA",

        background: "#F5F6F8",
        foreground: "#202B4E",
        card: "#FFFFFF",
        "card-foreground": "#202B4E",
        muted: "#EEF0F4",
        "muted-foreground": "#5B6472",
        accent: "#EAEDF3",
        "accent-foreground": "#202B4E",
        primary: "#202B4E",
        "primary-foreground": "#FFFFFF",
        secondary: "#EEF0F4",
        "secondary-foreground": "#202B4E",
        destructive: "#C6413A",
        "destructive-foreground": "#FFFFFF",
        success: "#1F7A66",
        border: "#E2E5EA",
        input: "#E2E5EA",
        ring: "#202B4E",

        "status-pending": "#F2A93B",
        "status-progress": "#2563EB",
        "status-review": "#7C3AED",
        "status-done": "#059669",
        "status-declined": "#DC2626",
      },
      borderRadius: {
        sm: "6px",
        DEFAULT: "10px",
        md: "8px",
        lg: "10px",
        xl: "14px",
        "2xl": "16px",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Poppins", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
