/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        cf: {
          canvas: "#f4f5f7",
          card: "#ffffff",
          navy: "#0f172a",
          lime: "#84cc16",
          "lime-dark": "#65a30d",
          muted: "#64748b",
          line: "#e2e8f0",
        },
      },
      boxShadow: {
        card: "0 1px 0 rgba(255, 255, 255, 0.9) inset, 0 8px 32px -8px rgba(15, 23, 42, 0.08)",
        "card-sm": "0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 16px -4px rgba(15, 23, 42, 0.06)",
      },
      borderRadius: {
        card: "14px",
        pill: "9999px",
      },
    },
  },
  plugins: [],
};
