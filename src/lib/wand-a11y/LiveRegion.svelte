<script lang="ts">
  export let message = '';
  export let politeness: 'polite' | 'assertive' = 'polite';
  export let atomic = true;
</script>
<div class="visually-hidden" role={politeness === 'assertive' ? 'alert' : 'status'} aria-live={politeness} aria-atomic={atomic}>{message}</div>
