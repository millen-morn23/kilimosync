/**
 * Deterministic product-image manifest for the demo catalog seeded by
 * scripts/seed-demo-data.ts.
 *
 * Keyed by (categorySlug, product name) rather than by the 136 individual
 * product rows: the seed script creates the same 56 named product
 * templates across 2-3 farmers per category, so every row with a given
 * name+category gets the same photograph — this is what "deterministic"
 * means here (no randomness, same product always gets the same image).
 *
 * Every entry was sourced from a specific, real Unsplash photo page (found
 * via search, never via the deprecated source.unsplash.com random-image
 * endpoint, never fabricated) and personally verified by viewing the
 * downloaded image before being included here. `image: null` means no
 * confident, product-accurate match could be found (or a candidate was
 * found but rejected for licensing or accuracy reasons) — see `note`.
 * Products with `image: null` keep the existing category icon/tint
 * fallback (src/lib/category-icons.tsx) instead of a wrong or
 * unlicensed photo. See docs/PRODUCT_IMAGES.md for the full sourcing
 * process and rejection log.
 */

export type ProductImageEntry = {
  name: string;
  categorySlug: string;
  image: {
    /** images.unsplash.com CDN URL, sized for a square product card. */
    url: string;
    source: "Unsplash";
    photographer: string;
    photographerUrl: string;
    alt: string;
  } | null;
  note?: string;
};

function unsplashUrl(id: string): string {
  return `${id}?w=800&h=800&fit=crop&q=80`;
}

export const PRODUCT_IMAGE_MANIFEST: ProductImageEntry[] = [
  // ── Vegetables (6/6 verified) ──────────────────────────────────────────
  {
    name: "Sukuma Wiki (Kale)",
    categorySlug: "vegetables",
    image: {
      url: unsplashUrl("https://images.unsplash.com/photo-1524179091875-bf99a9a6af57"),
      source: "Unsplash",
      photographer: "Laura Johnston",
      photographerUrl: "https://unsplash.com/@lauramakoj",
      alt: "Bunches of fresh curly-leafed kale (sukuma wiki) with thick pale stems",
    },
  },
  {
    name: "Tomatoes",
    categorySlug: "vegetables",
    image: {
      url: unsplashUrl("https://images.unsplash.com/photo-1758487405872-8e179dfe703e"),
      source: "Unsplash",
      photographer: "Yen Vu",
      photographerUrl: "https://unsplash.com/@yenvu2410",
      alt: "Ripe red tomatoes clustered on the vine",
    },
  },
  {
    name: "Cabbage",
    categorySlug: "vegetables",
    image: {
      url: unsplashUrl("https://images.unsplash.com/photo-1697346327617-c333613a349a"),
      source: "Unsplash",
      photographer: "Anna Evans",
      photographerUrl: "https://unsplash.com/@anevans",
      alt: "Whole round cabbage head growing in the garden with loose outer leaves",
    },
  },
  {
    name: "Spinach",
    categorySlug: "vegetables",
    image: {
      url: unsplashUrl("https://images.unsplash.com/photo-1574316071802-0d684efa7bf5"),
      source: "Unsplash",
      photographer: "Shutter Sphere Collective",
      photographerUrl: "https://unsplash.com/@shutterspherecollective",
      alt: "A dense pile of fresh glossy dark-green spinach leaves",
    },
  },
  {
    name: "Red Onions",
    categorySlug: "vegetables",
    image: {
      url: unsplashUrl("https://images.unsplash.com/photo-1593629718894-e9a8f9f65d01"),
      source: "Unsplash",
      photographer: "Quin Engle",
      photographerUrl: "https://unsplash.com/@twistsandzests",
      alt: "Whole red onions with papery skins",
    },
  },
  {
    name: "Carrots",
    categorySlug: "vegetables",
    image: {
      url: unsplashUrl("https://images.unsplash.com/photo-1717959159782-98c42b1d4f37"),
      source: "Unsplash",
      photographer: "Michael Perrine",
      photographerUrl: "https://unsplash.com/@mr_perrine",
      alt: "Freshly harvested orange carrots with soil still visible",
    },
  },

  // ── Fruits (6/6 verified) ───────────────────────────────────────────────
  {
    name: "Bananas",
    categorySlug: "fruits",
    image: {
      url: unsplashUrl("https://images.unsplash.com/photo-1757332050958-b797a022c910"),
      source: "Unsplash",
      photographer: "Daniel Dan",
      photographerUrl: "https://unsplash.com/@outsideclick",
      alt: "A bunch of ripe yellow bananas",
    },
  },
  {
    name: "Mangoes",
    categorySlug: "fruits",
    image: {
      url: unsplashUrl("https://images.unsplash.com/photo-1757281096712-d0c9fb17d608"),
      source: "Unsplash",
      photographer: "Daniel Dan",
      photographerUrl: "https://unsplash.com/@outsideclick",
      alt: "Whole ripe mangoes with red-green-yellow blush skin",
    },
  },
  {
    name: "Avocados",
    categorySlug: "fruits",
    image: {
      url: unsplashUrl("https://images.unsplash.com/photo-1704960961659-965d9d581448"),
      source: "Unsplash",
      photographer: "John Vid",
      photographerUrl: "https://unsplash.com/@vanvid",
      alt: "Two whole dark-skinned avocados",
    },
  },
  {
    name: "Pineapples",
    categorySlug: "fruits",
    image: {
      url: unsplashUrl("https://images.unsplash.com/photo-1550258987-190a2d41a8ba"),
      source: "Unsplash",
      photographer: "Fernando Andrade",
      photographerUrl: "https://unsplash.com/@thisisnando",
      alt: "A whole pineapple with its spiky green crown",
    },
  },
  {
    name: "Watermelon",
    categorySlug: "fruits",
    image: {
      url: unsplashUrl("https://images.unsplash.com/photo-1782702231394-5d4550fe5232"),
      source: "Unsplash",
      photographer: "Nellie Adamyan",
      photographerUrl: "https://unsplash.com/@nellie_adamyan",
      alt: "Sliced watermelon wedges showing red flesh and green rind",
    },
  },
  {
    name: "Passion Fruit",
    categorySlug: "fruits",
    image: {
      url: unsplashUrl("https://images.unsplash.com/photo-1562157244-acec728ea5b2"),
      source: "Unsplash",
      photographer: "Shaun Meintjes",
      photographerUrl: "https://unsplash.com/@shaunmcreatives",
      alt: "Passion fruit halves showing orange pulp and seeds, with whole fruit alongside",
    },
  },

  // ── Grains & Cereals (4/8 verified) ─────────────────────────────────────
  {
    name: "White Maize",
    categorySlug: "grains-cereals",
    image: null,
    note: "Not found: no confident photo of loose dried white/cream maize kernels on Unsplash — only corn-on-the-cob or yellow maize came up.",
  },
  {
    name: "Rice (Pishori)",
    categorySlug: "grains-cereals",
    image: {
      url: unsplashUrl("https://images.unsplash.com/photo-1586201375761-83865001e31c"),
      source: "Unsplash",
      photographer: "Pierre Bamin",
      photographerUrl: "https://unsplash.com/@bamin",
      alt: "Long-grain white rice kernels",
    },
    note: "Generic long-grain white rice — the specific Pishori variety isn't visually distinguishable from other long-grain white rice in a photo.",
  },
  {
    name: "Wheat",
    categorySlug: "grains-cereals",
    image: {
      url: unsplashUrl("https://images.unsplash.com/photo-1663025293688-322e16b6cb66"),
      source: "Unsplash",
      photographer: "Maria Camila Tobón",
      photographerUrl: "https://unsplash.com/@mcamitobon",
      alt: "Dried wheat kernels",
    },
  },
  {
    name: "Finger Millet",
    categorySlug: "grains-cereals",
    image: {
      url: unsplashUrl("https://images.unsplash.com/photo-1620827792322-5960fe216618"),
      source: "Unsplash",
      photographer: "Manikanth Halyal",
      photographerUrl: "https://unsplash.com/@manikanth_",
      alt: "Small dark reddish-brown finger millet grains",
    },
  },
  {
    name: "Sorghum",
    categorySlug: "grains-cereals",
    image: null,
    note: "Not found: Unsplash searches returned only sorghum plants/fields or unlabeled generic grain photos, nothing confidently identifiable as sorghum grain itself.",
  },
  {
    name: "Barley",
    categorySlug: "grains-cereals",
    image: null,
    note: "A visually accurate pearl-barley photo was found but rejected: it was hosted on plus.unsplash.com (Unsplash+ premium tier), which requires a paid license the app doesn't have — using it would violate Unsplash's terms.",
  },
  {
    name: "Brown Rice",
    categorySlug: "grains-cereals",
    image: null,
    note: "Same as Barley: a visually accurate photo existed but was an Unsplash+ premium (plus.unsplash.com) URL, excluded for licensing.",
  },
  {
    name: "Yellow Maize",
    categorySlug: "grains-cereals",
    image: {
      url: unsplashUrl("https://images.unsplash.com/photo-1641912593355-134c57c76246"),
      source: "Unsplash",
      photographer: "Daniela Paola Alchapar",
      photographerUrl: "https://unsplash.com/@paoalchapar",
      alt: "Dried yellow maize kernels",
    },
  },

  // ── Tubers & Roots (4/6 verified) ───────────────────────────────────────
  {
    name: "Irish Potatoes",
    categorySlug: "tubers-roots",
    image: {
      url: unsplashUrl("https://images.unsplash.com/photo-1590165482129-1b8b27698780"),
      source: "Unsplash",
      photographer: "Rodrigo dos Reis",
      photographerUrl: "https://unsplash.com/@rodreis",
      alt: "A pile of smooth tan-skinned potatoes",
    },
  },
  {
    name: "Sweet Potatoes",
    categorySlug: "tubers-roots",
    image: {
      url: unsplashUrl("https://images.unsplash.com/photo-1570723735746-c9bd51bd7c40"),
      source: "Unsplash",
      photographer: "Juno Jo",
      photographerUrl: "https://unsplash.com/@junojo",
      alt: "Reddish-purple-skinned sweet potatoes at a market stall",
    },
  },
  {
    name: "Cassava",
    categorySlug: "tubers-roots",
    image: {
      url: unsplashUrl("https://images.unsplash.com/photo-1757283961570-682154747d9c"),
      source: "Unsplash",
      photographer: "Daniel Dan",
      photographerUrl: "https://unsplash.com/@outsideclick",
      alt: "Cassava roots with brown bark-like skin and white starchy flesh at the cut ends",
    },
  },
  {
    name: "Arrowroots",
    categorySlug: "tubers-roots",
    image: {
      url: unsplashUrl("https://images.unsplash.com/photo-1757283961544-e161ac41b201"),
      source: "Unsplash",
      photographer: "Daniel Dan",
      photographerUrl: "https://unsplash.com/@outsideclick",
      alt: "Freshly dug arrowroot (taro/nduma) corms with dirt-covered fibrous skin",
    },
  },
  {
    name: "Yams",
    categorySlug: "tubers-roots",
    image: null,
    note: "Not found: Unsplash's 'yam' results consistently mislabeled sweet potatoes as yams, or returned unrelated photos — no confirmed true yam (Dioscorea) tuber photo.",
  },
  {
    name: "Purple Potatoes",
    categorySlug: "tubers-roots",
    image: null,
    note: "A candidate was found but rejected on review: it shows a mixed medley of yellow/red/purple potatoes together, not a photo specifically of purple potatoes — too likely to mislead a buyer about what they're ordering.",
  },

  // ── Legumes (6/8 verified) ──────────────────────────────────────────────
  {
    name: "Rosecoco Beans",
    categorySlug: "legumes",
    image: null,
    note: "Not found: only fresh bean pods on the vine, or an unlabeled speckled bean photo with no name confirmation, came up after 5+ searches.",
  },
  {
    name: "Green Grams (Ndengu)",
    categorySlug: "legumes",
    image: {
      url: unsplashUrl("https://images.unsplash.com/photo-1615485500710-aa71300612aa"),
      source: "Unsplash",
      photographer: "Mockup Graphics",
      photographerUrl: "https://unsplash.com/@mockupgraphics",
      alt: "A bowl of small round olive-green whole mung beans (green grams)",
    },
  },
  {
    name: "Pigeon Peas",
    categorySlug: "legumes",
    image: null,
    note: "Not found: searches for pigeon peas, toor dal, arhar dal, gandules and cajanus returned only lentils, moong dal or chickpeas — nothing confidently pigeon peas.",
  },
  {
    name: "Groundnuts",
    categorySlug: "legumes",
    image: {
      url: unsplashUrl("https://images.unsplash.com/photo-1575759474091-bab3c631c632"),
      source: "Unsplash",
      photographer: "Krisztina Papp",
      photographerUrl: "https://unsplash.com/@almapapi",
      alt: "Unshelled peanuts (groundnuts) with visible netted shell texture",
    },
  },
  {
    name: "Cowpeas",
    categorySlug: "legumes",
    image: {
      url: unsplashUrl("https://images.unsplash.com/photo-1690200276987-dee911d1732b"),
      source: "Unsplash",
      photographer: "Cosmin Ursea",
      photographerUrl: "https://unsplash.com/@cosminursea",
      alt: "Cream-colored beans soaking in water with a visible dark eye marking, characteristic of cowpeas",
    },
  },
  {
    name: "Lentils",
    categorySlug: "legumes",
    image: {
      url: unsplashUrl("https://images.unsplash.com/photo-1770617476260-1addeea7c826"),
      source: "Unsplash",
      photographer: "Mustafa akın",
      photographerUrl: "https://unsplash.com/@msaimakin",
      alt: "Small reddish-orange disc-shaped red lentils",
    },
  },
  {
    name: "Soybeans",
    categorySlug: "legumes",
    image: {
      url: unsplashUrl("https://images.unsplash.com/photo-1639843606783-b2f9c50a7468"),
      source: "Unsplash",
      photographer: "Daniela Paola Alchapar",
      photographerUrl: "https://unsplash.com/@paoalchapar",
      alt: "Small round cream-colored dried soybeans",
    },
  },
  {
    name: "Yellow Beans",
    categorySlug: "legumes",
    image: {
      url: unsplashUrl("https://images.unsplash.com/photo-1601993488142-d3050a16478d"),
      source: "Unsplash",
      photographer: "Thomas Kinto",
      photographerUrl: "https://unsplash.com/@thomaskinto",
      alt: "Scattered oval bright yellow dried beans",
    },
  },

  // ── Dairy & Eggs (4/8 verified) ─────────────────────────────────────────
  {
    name: "Fresh Milk",
    categorySlug: "dairy-eggs",
    image: {
      url: unsplashUrl("https://images.unsplash.com/photo-1611211301828-be4b317d0707"),
      source: "Unsplash",
      photographer: "engin akyurt",
      photographerUrl: "https://unsplash.com/@enginakyurt",
      alt: "Fresh milk being poured from a glass bottle into a glass",
    },
  },
  {
    name: "Eggs",
    categorySlug: "dairy-eggs",
    image: null,
    note: "A visually accurate photo (eggs in a basket) was found but rejected: hosted on plus.unsplash.com (Unsplash+ premium), excluded for licensing.",
  },
  {
    name: "Yoghurt",
    categorySlug: "dairy-eggs",
    image: {
      url: unsplashUrl("https://images.unsplash.com/photo-1571212515416-fef01fc43637"),
      source: "Unsplash",
      photographer: "micheile henderson",
      photographerUrl: "https://unsplash.com/@micheile",
      alt: "A bowl of thick plain white yoghurt",
    },
  },
  {
    name: "Ghee",
    categorySlug: "dairy-eggs",
    image: {
      url: unsplashUrl("https://images.unsplash.com/photo-1573812461383-e5f8b759d12e"),
      source: "Unsplash",
      photographer: "Megumi Nachev",
      photographerUrl: "https://unsplash.com/@meguminachev",
      alt: "A jar of golden clarified butter (ghee) with a spoonful being lifted out",
    },
  },
  {
    name: "Cheese",
    categorySlug: "dairy-eggs",
    image: {
      url: unsplashUrl("https://images.unsplash.com/photo-1655662844300-e59c3d2e7587"),
      source: "Unsplash",
      photographer: "Samuele Pieretti",
      photographerUrl: "https://unsplash.com/@samuelepieretti",
      alt: "A wedge of hard aged cheese",
    },
  },
  {
    name: "Butter",
    categorySlug: "dairy-eggs",
    image: null,
    note: "A visually accurate photo (cubed butter) was found but rejected: hosted on plus.unsplash.com (Unsplash+ premium), excluded for licensing.",
  },
  {
    name: "Mala (Fermented Milk)",
    categorySlug: "dairy-eggs",
    image: null,
    note: "A candidate was found but rejected on review: it shows the same pouring-white-liquid composition as the Fresh Milk photo and is visually indistinguishable from it — only the photographer's caption claims fermentation, which isn't verifiable from the image itself.",
  },
  {
    name: "Fresh Cream",
    categorySlug: "dairy-eggs",
    image: null,
    note: "Not found: candidates were either ambiguous with yoghurt, a savory dish using cream as a garnish, or steamed milk for coffee — nothing clearly depicted plain dairy cream on its own.",
  },

  // ── Poultry & Livestock (6/8 verified) ──────────────────────────────────
  {
    name: "Kienyeji Chicken",
    categorySlug: "poultry-livestock",
    image: {
      url: unsplashUrl("https://images.unsplash.com/photo-1686046662422-1ce6c62da531"),
      source: "Unsplash",
      photographer: "Johanne Pold Jacobsen",
      photographerUrl: "https://unsplash.com/@johannepoldjacobsen",
      alt: "Live free-range hens standing outdoors in a grassy yard",
    },
  },
  {
    name: "Broiler Chicken",
    categorySlug: "poultry-livestock",
    image: {
      url: unsplashUrl("https://images.unsplash.com/photo-1598016717029-026340d417d4"),
      source: "Unsplash",
      photographer: "Geon George",
      photographerUrl: "https://unsplash.com/@geongeorge",
      alt: "A live white broiler-breed chicken standing outdoors",
    },
  },
  {
    name: "Goat Meat",
    categorySlug: "poultry-livestock",
    image: null,
    note: "Not found: raw-meat search results were generic/unlabeled ('raw meat on tray') with no confirmation the meat is actually goat rather than lamb, beef or pork.",
  },
  {
    name: "Live Goats",
    categorySlug: "poultry-livestock",
    image: {
      url: unsplashUrl("https://images.unsplash.com/photo-1593750439808-958d28558592"),
      source: "Unsplash",
      photographer: "Jorge Salvador",
      photographerUrl: "https://unsplash.com/@jsshotz",
      alt: "Live goats with floppy ears standing together in a pen",
    },
  },
  {
    name: "Rabbit Meat",
    categorySlug: "poultry-livestock",
    image: null,
    note: "Not found: searches returned only live pet rabbits or unrelated cooked/plated meat dishes, nothing confirmed as raw butchered rabbit meat.",
  },
  {
    name: "Turkey",
    categorySlug: "poultry-livestock",
    image: {
      url: unsplashUrl("https://images.unsplash.com/photo-1756489626976-77b387d72879"),
      source: "Unsplash",
      photographer: "Maddy Hunt",
      photographerUrl: "https://unsplash.com/@maddyhuntphoto",
      alt: "A flock of live turkeys with dark iridescent plumage",
    },
  },
  {
    name: "Ducks",
    categorySlug: "poultry-livestock",
    image: {
      url: unsplashUrl("https://images.unsplash.com/photo-1465153690352-10c1b29577f8"),
      source: "Unsplash",
      photographer: "Ross Sokolovski",
      photographerUrl: "https://unsplash.com/@ross_sokolovski",
      alt: "A live duck with a dark green head and orange bill",
    },
  },
  {
    name: "Quail Eggs",
    categorySlug: "poultry-livestock",
    image: {
      url: unsplashUrl("https://images.unsplash.com/photo-1756892924724-e31147dfa238"),
      source: "Unsplash",
      photographer: "Klara Kulikova",
      photographerUrl: "https://unsplash.com/@kkalerry",
      alt: "Small speckled quail eggs clustered together",
    },
  },

  // ── Herbs & Spices (6/6 verified) ───────────────────────────────────────
  {
    name: "Dhania (Coriander)",
    categorySlug: "herbs-spices",
    image: {
      url: unsplashUrl("https://images.unsplash.com/photo-1709482107035-9ac8a2fb2ac9"),
      source: "Unsplash",
      photographer: "usama firdous",
      photographerUrl: "https://unsplash.com/@usamajatala",
      alt: "Fresh coriander (dhania) leaves with lacy, scalloped edges",
    },
  },
  {
    name: "Chili Peppers",
    categorySlug: "herbs-spices",
    image: {
      url: unsplashUrl("https://images.unsplash.com/photo-1526346698789-22fd84314424"),
      source: "Unsplash",
      photographer: "Elle Hughes",
      photographerUrl: "https://unsplash.com/@elletakesphotos",
      alt: "A pile of glossy red-orange finger chili peppers",
    },
  },
  {
    name: "Ginger",
    categorySlug: "herbs-spices",
    image: {
      url: unsplashUrl("https://images.unsplash.com/photo-1741517802684-ba07c444a5d2"),
      source: "Unsplash",
      photographer: "Zoshua Colah",
      photographerUrl: "https://unsplash.com/@zoshuacolah",
      alt: "Knobby tan-skinned ginger root rhizomes",
    },
  },
  {
    name: "Garlic",
    categorySlug: "herbs-spices",
    image: {
      url: unsplashUrl("https://images.unsplash.com/photo-1756361946221-00d12b875342"),
      source: "Unsplash",
      photographer: "engin akyurt",
      photographerUrl: "https://unsplash.com/@enginakyurt",
      alt: "Whole garlic bulbs with papery white skins",
    },
  },
  {
    name: "Mint",
    categorySlug: "herbs-spices",
    image: {
      url: unsplashUrl("https://images.unsplash.com/photo-1748792311906-9d0e8f88206c"),
      source: "Unsplash",
      photographer: "Marek Levák",
      photographerUrl: "https://unsplash.com/@designmesk",
      alt: "Fresh mint leaves with serrated edges",
    },
  },
  {
    name: "Turmeric",
    categorySlug: "herbs-spices",
    image: {
      url: unsplashUrl("https://images.unsplash.com/photo-1768729341217-0e11cb959252"),
      source: "Unsplash",
      photographer: "iKshana Productions",
      photographerUrl: "https://unsplash.com/@ikshanaproductions",
      alt: "Freshly dug turmeric rhizomes with leafy stalks still attached",
    },
  },
];
