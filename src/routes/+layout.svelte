<script>
	import Sidebar from "./Sidebar.svelte";
    import "../app.css";
</script>

<div class="flex">
    <Sidebar/>
    <div class="main px-4 pb-[256px] max-w-[600px]">
        <slot/>
    </div>
</div>