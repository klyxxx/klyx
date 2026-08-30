import type { ReactNode } from "react";

import AccountSwitcher from "@/app/components/AccountSwitcher";
import { getActiveProfile } from "@/lib/active-profile";

export default async function ProfileLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const profile = await getActiveProfile();

  return (
    <>
      {profile && (
        <div className="mx-auto w-full max-w-4xl px-4 pt-6 sm:px-6">
          <div className="flex justify-end">
            <AccountSwitcher currentProfileId={profile.id} />
          </div>
        </div>
      )}
      {children}
    </>
  );
}
