import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

const jpFontStack = [
  "Hiragino Sans",
  "Hiragino Kaku Gothic ProN",
  "Yu Gothic UI",
  "Yu Gothic",
  "Meiryo",
  "Noto Sans JP",
  "sans-serif",
].join(", ");

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="ja">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <ScrollViewStyleReset />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              html, body, #root {
                font-family: ${jpFontStack};
              }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
