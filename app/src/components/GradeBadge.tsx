import type { HeroGrade, SlotGrade, SynergyGrade } from '../types/game';

interface GradeBadgeProps {
  grade: SlotGrade | SynergyGrade | HeroGrade | string;
  label?: string;
}

export function GradeBadge({ grade, label }: GradeBadgeProps) {
  const clsSuffix =
    grade === '?' ? 'P' : grade === '-' ? 'D' : grade.toUpperCase();
  const display = label ?? (grade === '?' ? 'NEW (?)' : grade === '-' ? '-' : grade);
  return <span className={`dk-g dk-g-${clsSuffix}`}>{display}</span>;
}
