<script>
	import Sidebar from "../Sidebar.svelte";
    import "../../app.css";
</script>

<div class="flex flex-col sm:flex-row">
    <div class="hidden sm:block">
        <Sidebar/>
    </div>
    <div class="sm:hidden p-4 mb-[-16px]">
        <a href="/nav" class="opacity-60 text-sm hover:opacity-100">John's blog</a>
    </div>
    <div class="main px-4 pb-[256px] max-w-[600px]">
        <slot/>
    </div>
</div>