import type { Metadata } from "next";
import localFont from "next/font/local";
import { Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import { DialogProvider } from "@/components/feedback/dialog-provider";
import "./globals.css";

// LICENSE: Degular Demo is Personal Use Only; obtain a commercial license before public launch.
const degular = localFont({
  src: [
    {
      path: "../../public/fonts/degular-regular.otf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/degular-medium.otf",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../public/fonts/degular-semibold.otf",
      weight: "600",
      style: "normal",
    },
    {
      path: "../../public/fonts/degular-bold.otf",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-degular",
  display: "swap",
});

const halfre = localFont({
  src: "../../public/fonts/halfre.ttf",
  variable: "--font-halfre",
  display: "swap",
  weight: "400",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://usepaysafr.com"),
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/icon.png", type: "image/png" },
    ],
  },
  title: {
    default: "PaySafr | Work Delivered, Payments Secured",
    template: "%s | PaySafr",
  },
  description:
    "PaySafr helps freelancers and online sellers get paid with confidence. Work delivered, payments secured.",
  robots: { index: true, follow: true },
  openGraph: {
    type: "website",
    siteName: "PaySafr",
    title: "PaySafr | Work Delivered, Payments Secured",
    description: "Protected payments for freelancers and online sellers in Nigeria.",
    images: [
      {
        url: "/paysafr-hero-img.png",
        width: 1368,
        height: 768,
        alt: "A smiling woman holding a phone, with PaySafr payment notifications",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "PaySafr | Work Delivered, Payments Secured",
    description: "Protected payments for freelancers and online sellers in Nigeria.",
    images: ["/paysafr-hero-img.png"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${degular.variable} ${halfre.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <Providers>
          <DialogProvider>
            {children}
          </DialogProvider>
        </Providers>
      </body>
    </html>
  );
}
