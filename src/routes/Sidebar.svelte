<script>
	import SidebarItem from './SidebarItem.svelte';
</script>

<div class="w-60 shrink-0 h-full">
	<div class="list-none flex flex-col pt-10 sticky top-0">
		<SidebarItem to="/">Home</SidebarItem>
		<SidebarItem to="/college-admissions">College admissions</SidebarItem>
		<SidebarItem to="/startup-spark">How a startup loses its spark</SidebarItem>
		<SidebarItem to="/ai-safety">My take on AI safety</SidebarItem>
		<SidebarItem to="/simplicity">Simplicity scarcity</SidebarItem>
		<SidebarItem to="/rnns">Why RNNs work</SidebarItem>
		<SidebarItem to="/roast">We don't roast anymore</SidebarItem>
		<SidebarItem to="/sf-paradox">SF's paradox</SidebarItem>
	</div>
</div>
