<script lang="ts">
  export let width: 'normal' | 'wide' | 'full' = 'normal';
  export let className = '';
</script>

<div class={'responsive-frame ' + className} class:responsive-frame-wide={width === 'wide'} class:responsive-frame-full={width === 'full'}>
  <slot />
</div>
