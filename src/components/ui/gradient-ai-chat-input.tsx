"use client";
import React, { useState, useRef, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Send, ChevronDown, Paperclip, X, Check, FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface GradientColors {
  topLeft: string;
  topRight: string;
  bottomRight: string;
  bottomLeft: string;
}

interface DropdownOption {
  id: string;
  label: string;
  value: string;
}

interface AttachedFile {
  name: string;
  file: File;
  status: 'pending' | 'uploading' | 'done' | 'error';
}

interface GradientAIChatInputProps {
  placeholder?: string;
  onSend?: (message: string) => void;
  onFileAttach?: (file: File) => void;
  enableAnimations?: boolean;
  className?: string;
  disabled?: boolean;
  uploading?: boolean;
  // Dropdown options
  dropdownOptions?: DropdownOption[];
  selectedOption?: DropdownOption | null;
  onOptionSelect?: (option: DropdownOption) => void;
  // Gradient customization
  mainGradient?: GradientColors;
  outerGradient?: GradientColors;
  innerGradientOpacity?: number;
  buttonBorderColor?: string;
  // Shadow customization
  enableShadows?: boolean;
  shadowOpacity?: number;
  shadowColor?: string;
}

export function GradientAIChatInput({
  placeholder = "Send message...",
  onSend,
  onFileAttach,
  enableAnimations = true,
  className,
  disabled = false,
  uploading = false,
  // Dropdown
  dropdownOptions = [],
  selectedOption = null,
  onOptionSelect,
  // DS Cyan/Teal gradient defaults (dark mode only)
  mainGradient = {
    topLeft: "#0E7490",     // cyan-700
    topRight: "#155E75",    // cyan-800
    bottomRight: "#164E63", // cyan-900
    bottomLeft: "#0D9488",  // teal-600
  },
  outerGradient = {
    topLeft: "#0C5E75",
    topRight: "#0E4F63",
    bottomRight: "#0C3E4F",
    bottomLeft: "#0B7A70",
  },
  innerGradientOpacity = 0.08,
  buttonBorderColor = "rgba(255,255,255,0.06)",
  // Shadow defaults
  enableShadows = true,
  shadowOpacity = 1,
  shadowColor = "rgb(34, 211, 238)", // cyan glow
}: GradientAIChatInputProps) {
  const [message, setMessage] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const shouldReduceMotion = useReducedMotion();
  const shouldAnimate = enableAnimations && !shouldReduceMotion;
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Utility: hex/rgb → rgba
  const hexToRgba = (color: string, alpha: number): string => {
    if (color.startsWith('rgb(')) {
      const rgbValues = color.slice(4, -1).split(',').map(val => parseInt(val.trim()));
      return `rgba(${rgbValues[0]}, ${rgbValues[1]}, ${rgbValues[2]}, ${alpha})`;
    }
    if (color.startsWith('#')) {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return color;
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && onSend && !disabled && !uploading) {
      onSend(message.trim());
      setMessage("");
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleFileAttachment = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0 && onFileAttach) {
      // Add file pill
      const newFiles = files.map(f => ({ name: f.name, file: f, status: 'pending' as const }));
      setAttachedFiles(prev => [...prev, ...newFiles]);
      // Trigger upload for each file
      files.forEach(f => onFileAttach(f));
    }
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <motion.div
      className={cn("relative", className)}
      initial={shouldAnimate ? { opacity: 0, y: 20 } : {}}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 30,
        mass: 0.8,
      }}
    >
      {/* Main container with multi-layer gradient border */}
      <div className="relative">
        {/* Outer thin border */}
        <div
          className="absolute inset-0 rounded-[20px] p-[0.5px]"
          style={{
            background: `conic-gradient(from 0deg at 50% 50%,
              ${outerGradient.topLeft} 0deg,
              ${outerGradient.topRight} 90deg,
              ${outerGradient.bottomRight} 180deg,
              ${outerGradient.bottomLeft} 270deg,
              ${outerGradient.topLeft} 360deg
            )`,
          }}
        >
          {/* Main thick border (2px) */}
          <div
            className="h-full w-full rounded-[19.5px] p-[2px]"
            style={{
              background: `conic-gradient(from 0deg at 50% 50%,
                ${mainGradient.topLeft} 0deg,
                ${mainGradient.topRight} 90deg,
                ${mainGradient.bottomRight} 180deg,
                ${mainGradient.bottomLeft} 270deg,
                ${mainGradient.topLeft} 360deg
              )`,
            }}
          >
            {/* Inner background */}
            <div className="h-full w-full rounded-[17.5px] relative" style={{ background: 'rgba(13, 15, 21, 0.95)' }}>
              {/* Inner thin accent border */}
              <div
                className="absolute inset-0 rounded-[17.5px] p-[0.5px]"
                style={{
                  background: `conic-gradient(from 0deg at 50% 50%,
                    ${hexToRgba(outerGradient.topLeft, innerGradientOpacity)} 0deg,
                    ${hexToRgba(outerGradient.topRight, innerGradientOpacity)} 90deg,
                    ${hexToRgba(outerGradient.bottomRight, innerGradientOpacity)} 180deg,
                    ${hexToRgba(outerGradient.bottomLeft, innerGradientOpacity)} 270deg,
                    ${hexToRgba(outerGradient.topLeft, innerGradientOpacity)} 360deg
                  )`,
                }}
              >
                <div className="h-full w-full rounded-[17px]" style={{ background: 'rgba(13, 15, 21, 0.95)' }} />
              </div>
              {/* Top edge highlight */}
              <div
                className="absolute top-0 left-4 right-4 h-[0.5px]"
                style={{
                  background: `linear-gradient(to right, transparent, ${hexToRgba(mainGradient.topLeft, 0.3)}, transparent)`,
                }}
              />
              {/* Bottom edge */}
              <div
                className="absolute bottom-0 left-4 right-4 h-[0.5px]"
                style={{
                  background: `linear-gradient(to right, transparent, ${hexToRgba(mainGradient.bottomRight, 0.15)}, transparent)`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Content: Two-row layout */}
        <div className="relative p-4">
          {/* Top row: textarea + send */}
          <div className="flex items-start gap-3 mb-3">
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={uploading ? 'Analyzing your report...' : placeholder}
                disabled={disabled || uploading}
                rows={1}
                className={cn(
                  "w-full resize-none border-0 bg-transparent",
                  "text-text-primary placeholder:text-text-dim",
                  "font-mono text-[13px] leading-6 py-2 px-0",
                  "focus:outline-none focus:ring-0 outline-none",
                  "overflow-hidden transition-colors duration-200",
                  (disabled || uploading) && "opacity-50 cursor-not-allowed"
                )}
                style={{
                  minHeight: "40px",
                  maxHeight: "120px",
                  height: "auto",
                }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = "auto";
                  target.style.height = Math.min(target.scrollHeight, 120) + "px";
                }}
              />
            </div>

            {/* Send button */}
            <motion.button
              type="submit"
              onClick={handleSubmit}
              disabled={disabled || uploading || !message.trim()}
              className={cn(
                "flex items-center justify-center",
                "w-8 h-8 mt-1 rounded-lg",
                "text-text-muted hover:text-positive",
                "transition-colors cursor-pointer",
                (disabled || uploading || !message.trim()) && "opacity-30 cursor-not-allowed"
              )}
              style={{ background: 'rgba(34, 211, 238, 0.08)' }}
              whileHover={shouldAnimate && message.trim() ? { scale: 1.1 } : {}}
              whileTap={shouldAnimate && message.trim() ? { scale: 0.9 } : {}}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin text-positive" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </motion.button>
          </div>

          {/* Bottom row: Attach + Mode selector + file pills */}
          <div className="flex items-center gap-2">
            {/* Attach File */}
            <motion.button
              type="button"
              onClick={handleFileAttachment}
              disabled={disabled || uploading}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5",
                "text-[11px] font-mono text-text-dim hover:text-text-muted",
                "rounded-full transition-colors cursor-pointer",
                "bg-white/[0.02] hover:bg-white/[0.04]",
                (disabled || uploading) && "opacity-40 cursor-not-allowed"
              )}
              style={{ border: `1px solid ${buttonBorderColor}` }}
              whileHover={shouldAnimate ? { scale: 1.02 } : {}}
              whileTap={shouldAnimate ? { scale: 0.98 } : {}}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
            >
              <Paperclip className="w-3 h-3" />
              <span>Upload PDF</span>
            </motion.button>

            {/* Mode dropdown */}
            {dropdownOptions.length > 0 && (
              <div className="relative" ref={dropdownRef}>
                <motion.button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  disabled={disabled}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5",
                    "text-[11px] font-mono text-text-dim hover:text-text-muted",
                    "rounded-full transition-colors cursor-pointer",
                    "bg-white/[0.02] hover:bg-white/[0.04]",
                    disabled && "opacity-40 cursor-not-allowed"
                  )}
                  style={{ border: `1px solid ${buttonBorderColor}` }}
                  whileHover={shouldAnimate ? { scale: 1.02 } : {}}
                  whileTap={shouldAnimate ? { scale: 0.98 } : {}}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                >
                  <span className="font-medium">
                    {selectedOption ? selectedOption.label : "Select Mode"}
                  </span>
                  <ChevronDown
                    className={cn(
                      "w-3 h-3 transition-transform",
                      isDropdownOpen && "rotate-180"
                    )}
                  />
                </motion.button>

                {isDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -5, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -5, scale: 0.95 }}
                    className="absolute bottom-full mb-2 left-0 rounded-lg min-w-[160px] z-10 py-1"
                    style={{
                      background: 'rgba(13, 15, 21, 0.96)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      boxShadow: '0 12px 24px rgba(0,0,0,0.4)',
                    }}
                  >
                    {dropdownOptions.map((option) => (
                      <button
                        key={option.id}
                        onClick={() => {
                          onOptionSelect?.(option);
                          setIsDropdownOpen(false);
                        }}
                        className={cn(
                          "w-full text-left px-3 py-1.5 font-mono text-[11px] transition-colors flex items-center gap-2",
                          selectedOption?.id === option.id
                            ? "text-positive bg-white/[0.04]"
                            : "text-text-muted hover:text-text-primary hover:bg-white/[0.02]"
                        )}
                      >
                        <span className="flex-1">{option.label}</span>
                        {selectedOption?.id === option.id && (
                          <Check className="w-3 h-3 text-positive" />
                        )}
                      </button>
                    ))}
                  </motion.div>
                )}
              </div>
            )}

            {/* Separator + file pills */}
            {attachedFiles.length > 0 && (
              <>
                <div className="h-5 w-px" style={{ backgroundColor: buttonBorderColor }} />
                <div className="flex flex-wrap gap-2">
                  {attachedFiles.map((af, index) => (
                    <motion.div
                      key={`${af.name}-${index}`}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className={cn(
                        "flex items-center gap-2 px-3 py-1",
                        "font-mono text-[10px] text-text-dim",
                        "rounded-full bg-white/[0.02]"
                      )}
                      style={{ border: `1px solid ${buttonBorderColor}` }}
                    >
                      <FileText className="w-3 h-3 text-positive" />
                      <span className="truncate max-w-[100px]">{af.name}</span>
                      {uploading ? (
                        <Loader2 className="w-3 h-3 animate-spin text-positive" />
                      ) : (
                        <button
                          onClick={() => removeFile(index)}
                          className="flex-shrink-0 w-4 h-4 rounded-full bg-white/[0.04] hover:bg-negative/20 flex items-center justify-center"
                        >
                          <X className="w-2.5 h-2.5 text-text-dim hover:text-negative" />
                        </button>
                      )}
                    </motion.div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileChange}
          className="hidden"
          accept=".pdf,.csv"
        />

        {/* Shadow system */}
        {enableShadows && (
          <>
            <div
              className="absolute -bottom-3 left-3 right-3 h-6 rounded-full blur-md"
              style={{
                opacity: shadowOpacity,
                background: `linear-gradient(to bottom, ${hexToRgba(shadowColor, 0.06)} 0%, transparent 100%)`,
              }}
            />
            <div
              className="absolute inset-0 rounded-[20px] pointer-events-none"
              style={{
                opacity: shadowOpacity,
                boxShadow: `0 10px 25px ${hexToRgba(shadowColor, 0.08)}`,
              }}
            />
          </>
        )}
      </div>
    </motion.div>
  );
}
