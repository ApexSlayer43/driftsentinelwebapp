'use client';

import {
  Scale,
  Clock,
  Activity,
  TrendingUp,
  Pause,
  Zap,
  ArrowUpRight,
  AlertTriangle,
  type LucideProps,
} from 'lucide-react';

const ICON_MAP: Record<string, React.FC<LucideProps>> = {
  Scale,
  Clock,
  Activity,
  TrendingUp,
  Pause,
  Zap,
  ArrowUpRight,
  AlertTriangle,
};

interface DynamicIconProps extends LucideProps {
  name: string;
}

export function DynamicIcon({ name, ...props }: DynamicIconProps) {
  const Icon = ICON_MAP[name] ?? AlertTriangle;
  return <Icon {...props} />;
}
