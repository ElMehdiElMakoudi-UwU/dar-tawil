/** Why stock moved outside a sale or a purchase. Shared by the form and the server. */
export const adjustReasons = ["waste", "damaged", "sample", "own_use", "count", "other"] as const;
export type AdjustReason = (typeof adjustReasons)[number];
