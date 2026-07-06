/**
 * Order status utilities for UI rendering and tracking
 * Used across order confirmation, dashboard, and email templates
 */

interface StatusBadgeInfo {
  label: string
  color: string
  bg: string
  icon: string
}

export function getStatusBadge(status: string): StatusBadgeInfo {
  const statusMap: Record<string, StatusBadgeInfo> = {
    pending: {
      label: 'Pending',
      color: 'var(--color-warning)',
      bg: 'rgba(245, 158, 11, 0.12)',
      icon: '⏱',
    },
    processing: {
      label: 'Processing',
      color: 'var(--color-info)',
      bg: 'rgba(59, 130, 246, 0.12)',
      icon: '📦',
    },
    completed: {
      label: 'Shipped',
      color: 'var(--color-success)',
      bg: 'rgba(16, 185, 129, 0.12)',
      icon: '✈',
    },
    failed: {
      label: 'Failed',
      color: 'var(--color-danger)',
      bg: 'rgba(239, 68, 68, 0.12)',
      icon: '⚠',
    },
    refunded: {
      label: 'Refunded',
      color: 'var(--color-neutral)',
      bg: 'rgba(107, 114, 128, 0.12)',
      icon: '↩',
    },
  }

  return statusMap[status] || statusMap.processing
}
