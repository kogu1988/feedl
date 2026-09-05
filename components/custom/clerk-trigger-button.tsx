"use client";

import { SignInButton, SignUpButton } from "@clerk/nextjs";

import { Button, type ButtonProps } from "@/components/ui/button";

export type ClerkTriggerButtonProps = ButtonProps & {
  mode: "sign-in" | "sign-up";
  fallbackRedirectUrl?: string;
  forceRedirectUrl?: string;
};

// Clerk giriş/kayıt tetikleyicileri için tek kaynak. Clerk tetikleyicisi
// çocuğa tıklayıcıyı React.cloneElement ile ekler; çocuk tek bir eleman
// olmalı (bkz. @clerk/react assertSingleChild). Görsel tamamen sistem
// Button'ından gelir — elle yazılmış buton varyantı kalmaz.
export function ClerkTriggerButton({
  mode,
  fallbackRedirectUrl,
  forceRedirectUrl,
  ...buttonProps
}: ClerkTriggerButtonProps) {
  if (mode === "sign-up") {
    return (
      <SignUpButton
        fallbackRedirectUrl={fallbackRedirectUrl}
        forceRedirectUrl={forceRedirectUrl}
      >
        <Button {...buttonProps} />
      </SignUpButton>
    );
  }
  return (
    <SignInButton
      fallbackRedirectUrl={fallbackRedirectUrl}
      forceRedirectUrl={forceRedirectUrl}
    >
      <Button {...buttonProps} />
    </SignInButton>
  );
}
