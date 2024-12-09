/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors:{
        myblack:"#0A0A0A",
        mygray:"#181818",
        textgray:"#636363"
      }
    },
  },
  plugins: [],
}