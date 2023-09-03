<script lang="ts">
	import { collection, addDoc } from 'firebase/firestore';
	import { db } from '../lib/firebase';
	import FingerprintJS from '@fingerprintjs/fingerprintjs';
	import { onMount } from 'svelte';

	onMount(async () => {
		if (window.location.hash) {
			const fp = await FingerprintJS.load({ monitoring: false });
			const result = await fp.get();
			const fingerprint = result.visitorId;

			const docRef = await addDoc(collection(db, 'hashedVisits'), {
				createdAt: new Date(),
				url: window.location.href,
				hash: window.location.hash,
				fingerprint
			});
		}
	});
</script>

<slot />
