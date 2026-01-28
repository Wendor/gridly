import { defineStore } from 'pinia';
import { useTabStore, QueryTab } from './tabs';
import { useConnectionStore } from './connections';
import { useQueryStore } from './query';
import { RowUpdate, UpdateResult } from '@/types';

export const useTableDataStore = defineStore('tableData', () => {
  const tabStore = useTabStore();
  const connectionStore = useConnectionStore();
  const queryStore = useQueryStore();

  function getRowKey(row: Record<string, unknown>, primaryKeys: string[]): string {
    const pkValues = primaryKeys.map((pk) => String(row[pk] ?? '')).join('|');
    return pkValues;
  }

  function updateCellValue(tabId: number, rowIndex: number, column: string, value: unknown): void {
    const tab = tabStore.tabs.find(t => t.id === tabId) as QueryTab | undefined;
    if (!tab || tab.type !== 'query') return;

    if (tab.primaryKeys.length === 0) return;

    const row = tab.rows[rowIndex];
    if (!row) return;

    const rowKey = getRowKey(row, tab.primaryKeys);

    if (!tab.originalRows.has(rowKey)) {
      tab.originalRows.set(rowKey, { ...row });
    }

    if (!tab.pendingChanges.has(rowKey)) {
      tab.pendingChanges.set(rowKey, {});
    }

    const changes = tab.pendingChanges.get(rowKey)!;

    // Check if value equals original
    const originalValue = tab.originalRows.get(rowKey)![column];
    // Simple equality check
    if (String(value) === String(originalValue)) {
      delete changes[column];
      if (Object.keys(changes).length === 0) {
        tab.pendingChanges.delete(rowKey);
        tab.originalRows.delete(rowKey);
      }
    } else {
      changes[column] = value;
    }

    // Update UI
    row[column] = value;
  }

  function revertChanges(tabId: number): void {
    const tab = tabStore.tabs.find(t => t.id === tabId) as QueryTab | undefined;
    if (!tab || tab.type !== 'query') return;

    for (const [rowKey, originalRow] of tab.originalRows) {
      const rowIndex = tab.rows.findIndex((r) => getRowKey(r, tab.primaryKeys) === rowKey);
      if (rowIndex !== -1) {
        tab.rows[rowIndex] = { ...originalRow };
      }
    }

    tab.pendingChanges.clear();
    tab.originalRows.clear();
  }

  async function commitChanges(tabId: number): Promise<void> {
    const tab = tabStore.tabs.find(t => t.id === tabId) as QueryTab | undefined;
    if (!tab || tab.type !== 'query') return;
    if (tab.connectionId === null) return;
    if (tab.pendingChanges.size === 0) return;
    if (!tab.tableName) return;

    const updates: RowUpdate[] = [];

    for (const [rowKey, changes] of tab.pendingChanges) {
      const original = tab.originalRows.get(rowKey);
      if (!original) continue;

      const primaryKeys: Record<string, unknown> = {};
      for (const pk of tab.primaryKeys) {
        primaryKeys[pk] = original[pk];
      }

      updates.push({
        tableName: tab.tableName,
        primaryKeys,
        changes: Object.fromEntries(Object.entries(changes)),
      });
    }

    try {
      tab.loading = true;
      const result = (await window.dbApi.updateRows(
        tab.connectionId,
        updates,
      )) as UpdateResult;

      if (result.success) {
        tab.pendingChanges.clear();
        tab.originalRows.clear();
        await queryStore.runQuery(tab.id);
      } else {
        connectionStore.error = result.error || 'Unknown error';
      }
    } catch (e) {
      connectionStore.error = e instanceof Error ? e.message : String(e);
    } finally {
      tab.loading = false;
    }
  }

  return {
    updateCellValue,
    revertChanges,
    commitChanges
  };
});
