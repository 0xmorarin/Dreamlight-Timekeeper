<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  export let label: string;
  export let items: Array<{ value: string; label: string; disabled?: boolean }> = [];
  export let value = '';
  const dispatch = createEventDispatcher();
  function choose(item: { value: string; label: string; disabled?: boolean }) {
    if (item.disabled) return;
    value = item.value;
    dispatch('change', { value: item.value });
  }
</script>

<div class="segmented-control" role="group" aria-label={label}>
  {#each items as item}
    <button
      type="button"
      aria-pressed={item.value === value}
      aria-disabled={item.disabled ? 'true' : undefined}
      class:selected={item.value === value}
      disabled={item.disabled}
      on:click={() => choose(item)}
    >{item.label}</button>
  {/each}
</div>
