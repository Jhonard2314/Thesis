import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Fine-Tuned Transformer-Based System for Bias Assessment and Summarization of English News Articles",
  description: "Sentence-level bias assessment and summarization of English news articles using BERT and BART-large-CNN models",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        style={{ background: '#0B1628', color: '#FFFFFF' }}>
        {children}
      </body>
    </html>
  );
}
