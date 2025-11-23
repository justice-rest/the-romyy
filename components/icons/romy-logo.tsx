"use client"

import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import type { HTMLAttributes } from "react"

interface RomyLogoProps extends HTMLAttributes<HTMLImageElement> {
  className?: string
}

export function RomyLogo({ className, ...props }: RomyLogoProps) {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Preload both images for instant swapping
  useEffect(() => {
    setMounted(true)
    const lightImg = new Image()
    const darkImg = new Image()
    lightImg.src = "/light.png"
    darkImg.src = "/dark.png"
  }, [])

  // Use dark.png for light mode, light.png for dark mode
  const logoSrc = resolvedTheme === "dark" ? "/light.png" : "/dark.png"

  // Prevent flash by not rendering until mounted
  if (!mounted) {
    return <div className={className} />
  }

  return (
    <img
      src={logoSrc}
      alt="Rōmy"
      className={className}
      {...props}
    />
  )
}
