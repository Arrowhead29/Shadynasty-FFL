const subGoto = (dest, isExternal = false) => {
	open(false);
	if (isExternal) {
		window.location.href = dest;
	} else {
		goto(dest);
	}
}

// Then in your template, update the "Go to Sleeper" item:
{#each tabChildren as subTab, ix}
	{#if subTab.label == 'Managers'}
		<Item class="{managers.length ? '' : 'dontDisplay'}" onSMUIAction={() => subGoto(subTab.dest)} ontouchstart={() => preloadData(subTab.dest)} onmouseover={() => preloadData(subTab.dest)}>
			<Graphic class="material-icons">{subTab.icon}</Graphic>
			<Text class="subText">{subTab.label}</Text>
		</Item>
		{#if ix != tabChildren.length - 1}
			<Separator />
		{/if}
	{:else if subTab.label == 'Go to Sleeper'}
		<Item onSMUIAction={() => subGoto(subTab.dest, true)} ontouchstart={() => {}} onmouseover={() => {}}>
			<Graphic class="material-icons">{subTab.icon}</Graphic>
			<Text class="subText">{subTab.label}</Text>
		</Item>
		{#if ix != tabChildren.length - 1}
			<Separator />
		{/if}
	{:else}
		<Item onSMUIAction={() => subGoto(subTab.dest)} ontouchstart={() => preloadData(subTab.dest)} onmouseover={() => preloadData(subTab.dest)}>
			<Graphic class="material-icons">{subTab.icon}</Graphic>
			<Text class="subText">{subTab.label}</Text>
		</Item>
		{#if ix != tabChildren.length - 1}
			<Separator />
		{/if}
	{/if}
{/each}