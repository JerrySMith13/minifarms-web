// Sample blog post data used to preview rendering without relying on a
// populated MINIFARMS_BLOG_KV namespace. Shape matches what would come back
// from `env.MINIFARMS_BLOG_KV.get(key, "json")`, paired with the key that
// would normally come from `env.MINIFARMS_BLOG_KV.list()`.
export const samplePosts: { key: string; obj: any }[] = [
	{
		key: 'sample-1',
		obj: {
			imgLink: 'https://placehold.co/600x400?text=Mini+Farms',
			category: 'Farm Updates',
			author: 'Jane Smith',
			content:
				'This spring we expanded our mini farm plots to make room for a new batch of heirloom tomatoes. Here is a look at how the season is shaping up so far, from seedlings to soil prep.',
			date: '2026-04-12',
		},
	},
	{
		key: 'sample-2',
		obj: {
			imgLink: 'https://placehold.co/600x400?text=Harvest',
			category: 'Harvest',
			author: 'Miguel Torres',
			content:
				'Our first harvest of the year is in! We are sharing tips on storing and preserving fresh produce so it lasts longer, along with a few of our favorite recipes for using it up.',
			date: '2026-05-20',
		},
	},
	{
		key: 'sample-3',
		obj: {
			imgLink: 'https://placehold.co/600x400?text=Community',
			category: 'Community',
			author: 'Ava Chen',
			content:
				'Mini Farms USA partnered with three local schools this month to build raised garden beds for students. Here is how the program works and how you can get involved in your area.',
			date: '2026-06-30',
		},
	},
]
