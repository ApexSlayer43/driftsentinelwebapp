"use client";
import { useState, useEffect, useRef } from "react";
import { ArrowRight, Link, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface TimelineItem {
  id: number;
  title: string;
  date: string;
  content: string;
  category: string;
  icon: React.ElementType;
  relatedIds: number[];
  status: "completed" | "in-progress" | "pending";
  energy: number;
}

interface RadialOrbitalTimelineProps {
  timelineData: TimelineItem[];
}

export default function RadialOrbitalTimeline({
  timelineData,
}: RadialOrbitalTimelineProps) {
  const [expandedItems, setExpandedItems] = useState<Record<number, boolean>>(
    {}
  );
  const [rotationAngle, setRotationAngle] = useState<number>(0);
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [pulseEffect, setPulseEffect] = useState<Record<number, boolean>>({});
  const [centerOffset] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [activeNodeId, setActiveNodeId] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const orbitRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === containerRef.current || e.target === orbitRef.current) {
      setExpandedItems({});
      setActiveNodeId(null);
      setPulseEffect({});
      setAutoRotate(true);
    }
  };

  const getRelatedItems = (itemId: number): number[] => {
    const currentItem = timelineData.find((item) => item.id === itemId);
    return currentItem ? currentItem.relatedIds : [];
  };

  const centerViewOnNode = (nodeId: number) => {
    const nodeIndex = timelineData.findIndex((item) => item.id === nodeId);
    const totalNodes = timelineData.length;
    const targetAngle = (nodeIndex / totalNodes) * 360;
    setRotationAngle(270 - targetAngle);
  };

  const toggleItem = (id: number) => {
    setExpandedItems((prev) => {
      const newState: Record<number, boolean> = {};
      newState[id] = !prev[id];

      if (!prev[id]) {
        setActiveNodeId(id);
        setAutoRotate(false);
        const relatedItems = getRelatedItems(id);
        const newPulseEffect: Record<number, boolean> = {};
        relatedItems.forEach((relId) => {
          newPulseEffect[relId] = true;
        });
        setPulseEffect(newPulseEffect);
        centerViewOnNode(id);
      } else {
        setActiveNodeId(null);
        setAutoRotate(true);
        setPulseEffect({});
      }

      return newState;
    });
  };

  useEffect(() => {
    let rotationTimer: NodeJS.Timeout;
    if (autoRotate) {
      rotationTimer = setInterval(() => {
        setRotationAngle((prev) => {
          const newAngle = (prev + 0.3) % 360;
          return Number(newAngle.toFixed(3));
        });
      }, 50);
    }
    return () => {
      if (rotationTimer) {
        clearInterval(rotationTimer);
      }
    };
  }, [autoRotate]);

  const calculateNodePosition = (index: number, total: number) => {
    const angle = ((index / total) * 360 + rotationAngle) % 360;
    const radius = 200;
    const radian = (angle * Math.PI) / 180;
    const x = radius * Math.cos(radian) + centerOffset.x;
    const y = radius * Math.sin(radian) + centerOffset.y;
    const zIndex = Math.round(100 + 50 * Math.cos(radian));
    const opacity = Math.max(
      0.4,
      Math.min(1, 0.4 + 0.6 * ((1 + Math.sin(radian)) / 2))
    );
    return { x, y, angle, zIndex, opacity };
  };

  const isRelatedToActive = (itemId: number): boolean => {
    if (!activeNodeId) return false;
    const relatedItems = getRelatedItems(activeNodeId);
    return relatedItems.includes(itemId);
  };

  const getStatusStyles = (status: TimelineItem["status"]): string => {
    switch (status) {
      case "completed":
        return "text-void bg-stable border-stable";
      case "in-progress":
        return "text-void bg-drift border-drift";
      case "pending":
        return "text-text-secondary bg-white/[0.06] border-white/[0.08]";
      default:
        return "text-text-secondary bg-white/[0.06] border-white/[0.08]";
    }
  };

  const activeItem = activeNodeId
    ? timelineData.find((item) => item.id === activeNodeId)
    : null;

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center overflow-hidden"
      ref={containerRef}
      onClick={handleContainerClick}
    >
      <div className="relative w-full max-w-4xl h-full flex items-center justify-center">
        <div
          className="absolute w-full h-full flex items-center justify-center"
          ref={orbitRef}
          style={{
            perspective: "1000px",
            transform: `translate(${centerOffset.x}px, ${centerOffset.y}px)`,
          }}
        >
          {/* Center orb — hidden when card is showing */}
          <div
            className={`absolute w-16 h-16 rounded-full bg-gradient-to-br from-stable via-stable/60 to-drift animate-pulse flex items-center justify-center z-10 transition-opacity duration-500 ${
              activeNodeId ? "opacity-0 pointer-events-none" : "opacity-100"
            }`}
          >
            <div className="absolute w-20 h-20 rounded-full border border-stable/20 animate-ping opacity-70" />
            <div
              className="absolute w-24 h-24 rounded-full border border-stable/10 animate-ping opacity-50"
              style={{ animationDelay: "0.5s" }}
            />
            <div className="w-8 h-8 rounded-full bg-text-primary/80 backdrop-blur-md" />
          </div>

          {/* Orbit ring — fades when active */}
          <div
            className={`absolute w-96 h-96 rounded-full border border-white/[0.08] transition-opacity duration-500 ${
              activeNodeId ? "opacity-20" : "opacity-100"
            }`}
          />

          {/* Connecting line from active node to center */}
          {activeNodeId && (() => {
            const nodeIndex = timelineData.findIndex((i) => i.id === activeNodeId);
            const pos = calculateNodePosition(nodeIndex, timelineData.length);
            return (
              <svg
                className="absolute pointer-events-none z-[250]"
                style={{ width: 1, height: 1, overflow: 'visible' }}
              >
                <line
                  x1={0}
                  y1={0}
                  x2={pos.x}
                  y2={pos.y}
                  stroke="rgba(0,212,170,0.3)"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
              </svg>
            );
          })()}

          {/* Nodes */}
          {timelineData.map((item, index) => {
            const position = calculateNodePosition(index, timelineData.length);
            const isExpanded = expandedItems[item.id];
            const isRelated = isRelatedToActive(item.id);
            const isPulsing = pulseEffect[item.id];
            const Icon = item.icon;

            // Fade non-active, non-related nodes when something is selected
            const isFaded = activeNodeId !== null && !isExpanded && !isRelated;

            const nodeStyle: React.CSSProperties = {
              transform: `translate(${position.x}px, ${position.y}px)`,
              zIndex: isExpanded ? 200 : position.zIndex,
              opacity: isFaded ? 0.15 : isExpanded ? 1 : position.opacity,
            };

            return (
              <div
                key={item.id}
                ref={(el) => {
                  nodeRefs.current[item.id] = el;
                }}
                className="absolute transition-all duration-700 cursor-pointer"
                style={nodeStyle}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleItem(item.id);
                }}
              >
                {/* Energy glow */}
                <div
                  className={`absolute rounded-full -inset-1 ${
                    isPulsing ? "animate-pulse" : ""
                  }`}
                  style={{
                    background: `radial-gradient(circle, rgba(0,212,170,0.15) 0%, rgba(0,212,170,0) 70%)`,
                    width: `${item.energy * 0.5 + 40}px`,
                    height: `${item.energy * 0.5 + 40}px`,
                    left: `-${(item.energy * 0.5 + 40 - 40) / 2}px`,
                    top: `-${(item.energy * 0.5 + 40 - 40) / 2}px`,
                  }}
                />

                {/* Node circle */}
                <div
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center
                    ${
                      isExpanded
                        ? "bg-stable text-void"
                        : isRelated
                        ? "bg-stable/30 text-text-primary"
                        : "bg-white/[0.04] text-text-secondary"
                    }
                    border-2
                    ${
                      isExpanded
                        ? "border-stable shadow-lg shadow-stable/30"
                        : isRelated
                        ? "border-stable animate-pulse"
                        : "border-white/[0.08]"
                    }
                    transition-all duration-300 transform
                    ${isExpanded ? "scale-150" : ""}
                  `}
                >
                  <Icon size={16} />
                </div>

                {/* Label */}
                <div
                  className={`
                    absolute top-12 whitespace-nowrap
                    font-mono text-[10px] font-semibold uppercase tracking-wider
                    transition-all duration-300
                    ${isExpanded ? "text-text-primary scale-125" : "text-text-muted"}
                  `}
                >
                  {item.title}
                </div>
              </div>
            );
          })}

          {/* Centered expanded card */}
          {activeItem && expandedItems[activeItem.id] && (
            <Card
              className="absolute w-72 bg-white/[0.04] backdrop-blur-xl border border-white/[0.12] shadow-2xl shadow-stable/10 overflow-visible z-[300] animate-in fade-in zoom-in-95 duration-300"
              style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                  <Badge
                    className={`px-2 text-[9px] font-mono uppercase tracking-wider ${getStatusStyles(
                      activeItem.status
                    )}`}
                  >
                    {activeItem.status === "completed"
                      ? "COMPLETE"
                      : activeItem.status === "in-progress"
                      ? "IN PROGRESS"
                      : "PENDING"}
                  </Badge>
                  <span className="text-[10px] font-mono text-text-muted">
                    {activeItem.date}
                  </span>
                </div>
                <CardTitle className="text-sm mt-2 text-text-primary font-mono">
                  {activeItem.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-text-secondary">
                <p>{activeItem.content}</p>

                {/* Energy bar */}
                <div className="mt-4 pt-3 border-t border-white/[0.08]">
                  <div className="flex justify-between items-center text-[10px] mb-1">
                    <span className="flex items-center text-text-muted">
                      <Zap size={10} className="mr-1" />
                      Energy Level
                    </span>
                    <span className="font-mono text-text-secondary">
                      {activeItem.energy}%
                    </span>
                  </div>
                  <div className="w-full h-1 bg-white/[0.06] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-stable to-drift rounded-full"
                      style={{ width: `${activeItem.energy}%` }}
                    />
                  </div>
                </div>

                {/* Related nodes */}
                {activeItem.relatedIds.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-white/[0.08]">
                    <div className="flex items-center mb-2">
                      <Link size={10} className="text-text-muted mr-1" />
                      <h4 className="text-[9px] uppercase tracking-wider font-medium text-text-muted font-mono">
                        Connected Nodes
                      </h4>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {activeItem.relatedIds.map((relatedId) => {
                        const relatedItem = timelineData.find(
                          (i) => i.id === relatedId
                        );
                        return (
                          <button
                            key={relatedId}
                            className="flex items-center h-6 px-2 py-0 text-[10px] font-mono border border-white/[0.08] bg-transparent hover:bg-elevated text-text-secondary hover:text-text-primary transition-all rounded"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleItem(relatedId);
                            }}
                          >
                            {relatedItem?.title}
                            <ArrowRight
                              size={8}
                              className="ml-1 text-text-muted"
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
