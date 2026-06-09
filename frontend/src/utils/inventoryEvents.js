export const INVENTORY_CHANGED_EVENT = 'inventory-changed';

/** Notify the app that stock, sales, or catalog data changed so counters refresh. */
export function notifyInventoryChanged() {
  window.dispatchEvent(new Event(INVENTORY_CHANGED_EVENT));
}
