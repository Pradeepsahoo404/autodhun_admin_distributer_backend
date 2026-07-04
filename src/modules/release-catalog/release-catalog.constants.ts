export const LABEL_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
} as const;

export type LabelStatus = (typeof LABEL_STATUS)[keyof typeof LABEL_STATUS];

export const LABEL_STATUS_VALUES = Object.values(LABEL_STATUS);
