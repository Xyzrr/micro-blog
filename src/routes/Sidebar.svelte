<script>
	import SidebarItem from "./SidebarItem.svelte";
</script>

<div class="w-60 shrink-0 h-full">
    <div class="list-none flex flex-col pt-10 sticky top-0">
        <SidebarItem to="/">Home</SidebarItem>
        <SidebarItem to="/startup-spark">How a startup loses its spark</SidebarItem>
        <SidebarItem to="/ai-safety">My take on AI safety</SidebarItem>
        <SidebarItem to="/rnns">Why RNNs work</SidebarItem>
        <SidebarItem to="/sf-paradox">SF's paradox</SidebarItem>
    </div>
</div>

<style>
    a {
        padding: 4px 16px;
        opacity: 60%;
        font-size: 14px;
        text-decoration: none;
    }
    a:hover {
        opacity: 100%;
    }
</style>