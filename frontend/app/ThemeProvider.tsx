"use client"
import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      {...props}
      scriptProps={{
        ...props.scriptProps,
        // Next.js 16 / React 19 warns when next-themes renders an executable
        // script again during client hydration. Keep it executable in the
        // server HTML (before first paint), but inert in the client render.
        type: typeof window === "undefined" ? "text/javascript" : "text/plain",
      }}
    >
      {children}
    </NextThemesProvider>
  )
}
