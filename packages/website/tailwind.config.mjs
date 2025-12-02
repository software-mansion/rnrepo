/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,md,mdx,svelte,ts,vue}'],
  theme: {
    extend: {
      colors: {
        rnrGrey: {
          0: '#FAFAFA',
          10: '#F5F5F5',
          20: '#E5E5E5',
          30: '#D4D4D4',
          40: '#A3A3A3',
          50: '#737373',
          60: '#525252',
          80: '#262626',
          90: '#171717',
          100: '#0A0A0A',
        },
        brandYellow: {
          100: '#FFD61E',
          80: '#FFE04B',
          60: '#FFE780',
          40: '#FFF1B2',
          20: '#FFFAE1',
        },
        brandSeaBlue: {
          100: '#38ACDD',
          80: '#5BB9E0',
          60: '#87CCE8',
          40: '#B5E1F1',
          20: '#E1F3FA',
        },
        brandPink: {
          100: '#FF6259',
          80: '#FA7F7C',
          60: '#FFA3A1',
          40: '#FFD2D7',
          20: '#FFEDF0',
        },
        brandGreen: {
          100: '#57B495',
          80: '#82CAB2',
          60: '#B1DFD0',
          40: '#DFF2EC',
          20: '#EBFCF7',
        },
        // Semantic mappings
        background: '#0A0A0A', // rnrGrey-100
        surface: '#171717',    // rnrGrey-90
        surfaceHighlight: '#262626', // rnrGrey-80
        primary: '#38ACDD',    // brandSeaBlue-100
        secondary: '#57B495',  // brandGreen-100
      },
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        mono: ['Fira Code', 'monospace'],
      }
    }
  },
  plugins: [],
}

