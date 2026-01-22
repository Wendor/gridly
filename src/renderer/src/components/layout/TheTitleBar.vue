<template>
  <div class="title-bar" @dblclick="maximizeWindow">
    <div class="drag-region"></div>
    <div class="title-content">
      <!-- Optional: App Title could go here -->
    </div>
  </div>
</template>

<script setup lang="ts">
function maximizeWindow(): void {
  // Optional: functionality to maximize window on double click
  // Requires IPC handler, skipping for now as Mac usually handles this on native bar,
  // but since we hide it, we lose double-click-to-maximize unless we implement it.
  // For now, keep it simple.
}
</script>

<style scoped>
.title-bar {
  height: 35px;
  background: var(--bg-panel-header); /* Matches sidebar/tabs */
  display: flex;
  align-items: center;
  flex-shrink: 0;
  user-select: none;
  width: 100%;
  position: relative;
  z-index: 9999;
}

.drag-region {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  -webkit-app-region: drag;
}

.title-content {
  flex: 1;
  display: flex;
  justify-content: center;
  pointer-events: none; /* Let clicks pass to drag region */
  font-size: 13px;
  color: var(--text-secondary);
}
</style>
