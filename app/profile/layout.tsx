import type { ReactNode } from "react";

export default function ProfileLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <div
      data-testid="profile-scroll-region"
      className="h-[calc(100dvh_-_3.5rem)] min-h-0 w-full max-w-full overflow-x-hidden overflow-y-auto overscroll-y-contain lg:h-dvh lg:[scrollbar-gutter:stable]"
    >
      {children}
    </div>
  );
}
