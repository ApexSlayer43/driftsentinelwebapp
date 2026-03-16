"use client"
import React, { useState, useEffect, useRef } from "react"

interface MenuItemProps {
  children?: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  icon?: React.ReactNode
  isActive?: boolean
  title?: string
}

export function MenuItem({ children, onClick, disabled = false, icon, isActive = false, title }: MenuItemProps) {
  return (
    <button
      className={`relative block w-full h-12 text-center group
        ${disabled ? "text-text-dim cursor-not-allowed" : "text-text-muted"}
        ${isActive ? "text-white" : ""}
      `}
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      <span className="flex items-center justify-center h-full">
        {icon && (
          <span className="h-5 w-5 transition-all duration-200 group-hover:[&_svg]:stroke-[2.5] group-hover:text-white">
            {icon}
          </span>
        )}
        {children}
      </span>
    </button>
  )
}

interface MenuContainerProps {
  children: React.ReactNode
  className?: string
}

export function MenuContainer({ children, className }: MenuContainerProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const childrenArray = React.Children.toArray(children)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsExpanded(false)
      }
    }
    if (isExpanded) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [isExpanded])

  const handleToggle = () => {
    setIsExpanded(!isExpanded)
  }

  return (
    <div ref={containerRef} className={`relative w-[48px] ${className ?? ''}`} data-expanded={isExpanded}>
      <div className="relative">
        {/* First item — always visible (hamburger/close toggle) */}
        <div
          className="relative w-12 h-12 cursor-pointer rounded-full will-change-transform z-50"
          style={{
            background: 'rgba(13, 15, 21, 0.85)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.06)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.03)',
          }}
          onClick={handleToggle}
        >
          {childrenArray[0]}
        </div>

        {/* Expanding items */}
        {childrenArray.slice(1).map((child, index) => (
          <div
            key={index}
            className="absolute top-0 left-0 w-12 h-12 will-change-transform"
            style={{
              background: 'rgba(13, 15, 21, 0.85)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(255,255,255,0.04)',
              transform: `translateY(${isExpanded ? (index + 1) * 44 : 0}px)`,
              opacity: isExpanded ? 1 : 0,
              zIndex: 40 - index,
              clipPath:
                index === childrenArray.length - 2
                  ? "circle(50% at 50% 50%)"
                  : "circle(50% at 50% 55%)",
              transition: `transform 300ms cubic-bezier(0.4, 0, 0.2, 1),
                         opacity ${isExpanded ? "300ms" : "350ms"}`,
              backfaceVisibility: "hidden",
            }}
          >
            {child}
          </div>
        ))}
      </div>
    </div>
  )
}
