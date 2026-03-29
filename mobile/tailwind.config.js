/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./App.{js,jsx,ts,tsx}",
        "./components/**/*.{js,jsx,ts,tsx}",
        "./screens/**/*.{js,jsx,ts,tsx}",
        "./src/**/*.{js,jsx,ts,tsx}",
    ],
    presets: [require("nativewind/preset")],
    theme: {
        extend: {
            fontFamily: {
                sans: ["WorkSans_400Regular"],
                medium: ["WorkSans_500Medium"],
                bold: ["WorkSans_700Bold"],
                light: ["WorkSans_300Light"],
            },
            fontWeight: {
                light: "300",
                normal: "400",
                medium: "500",
                bold: "700",
            },
        },
    },
    plugins: [],
};