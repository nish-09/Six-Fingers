"use client";

import React from "react";
import { AuthProvider } from "@/lib/authContext";
import { PresenceProvider } from "@/lib/presenceContext";
import { IncomingInviteToast } from "./IncomingInviteToast";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <PresenceProvider>
        {children}
        <IncomingInviteToast />
      </PresenceProvider>
    </AuthProvider>
  );
}
