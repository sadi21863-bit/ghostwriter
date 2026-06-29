// Curated catalog of public-domain / Creative-Commons sources writers can draw on
// for inspiration and (license-permitting) reuse. Static data — no AI, no cost.
// Surfaced in the Discover stage. Each entry notes its license so users know the
// usage terms; always verify the specific work's license before reuse.
export type ResourceLicense = "Public Domain" | "CC / Public Domain" | "CC0" | "Mixed CC" | "Tool";

export interface InspirationSource {
  name: string;
  url: string;
  description: string;
  license: ResourceLicense;
}

export interface InspirationCategory {
  id: string;
  label: string;
  icon: string;
  sources: InspirationSource[];
}

export const INSPIRATION_CATEGORIES: InspirationCategory[] = [
  {
    id: "films", label: "Films & Video", icon: "🎬",
    sources: [
      { name: "Internet Archive", url: "https://archive.org/details/movies", description: "Vast library of public-domain movies — silent classics to forgotten B-movies, plus a Moving Images section.", license: "Public Domain" },
      { name: "Prelinger Archives", url: "https://archive.org/details/prelinger", description: "Ephemeral films: home movies, educational and industrial films, many rare and unique.", license: "Public Domain" },
      { name: "Saturation.io", url: "https://saturation.io", description: "Catalog and map of public-domain films with detailed insights on each.", license: "Public Domain" },
      { name: "U.S. National Archives", url: "https://www.archives.gov/research/film-sound-video", description: "Historical films tied to the history of the United States.", license: "Public Domain" },
    ],
  },
  {
    id: "images", label: "Images & Stock", icon: "🖼️",
    sources: [
      { name: "Wikimedia Commons", url: "https://commons.wikimedia.org", description: "Massive repository of images and media in the public domain or under free licenses.", license: "CC / Public Domain" },
      { name: "Library of Congress", url: "https://www.loc.gov/free-to-use/", description: "Digitized photographs, maps, and manuscripts.", license: "Public Domain" },
      { name: "Unsplash", url: "https://unsplash.com", description: "High-quality free stock photos, many public domain.", license: "CC / Public Domain" },
      { name: "Pexels", url: "https://www.pexels.com", description: "Curated free stock photos and videos.", license: "CC / Public Domain" },
      { name: "Pixabay", url: "https://pixabay.com", description: "Free photos, illustrations, and vectors, many under CC0.", license: "CC0" },
      { name: "Flickr (Commons / CC search)", url: "https://www.flickr.com/search/advanced/", description: "Advanced search filters for Creative-Commons-licensed and public-domain images.", license: "Mixed CC" },
    ],
  },
  {
    id: "books", label: "Books & Literature", icon: "📚",
    sources: [
      { name: "Project Gutenberg", url: "https://www.gutenberg.org", description: "Tens of thousands of free public-domain ebooks, updated as titles enter the public domain.", license: "Public Domain" },
      { name: "LibriVox", url: "https://librivox.org", description: "Free public-domain audiobooks — great for finding titles to inspire new projects.", license: "Public Domain" },
      { name: "Europeana", url: "https://www.europeana.eu", description: "Aggregated European cultural heritage, including public-domain books and images.", license: "CC / Public Domain" },
      { name: "Standard Ebooks", url: "https://standardebooks.org", description: "Carefully produced, free public-domain ebooks.", license: "Public Domain" },
    ],
  },
  {
    id: "audio", label: "Audio & Music", icon: "🎵",
    sources: [
      { name: "Freesound", url: "https://freesound.org", description: "Creative-Commons and public-domain sound effects.", license: "Mixed CC" },
      { name: "Free Music Archive", url: "https://freemusicarchive.org", description: "Searchable music across many genres under free licenses.", license: "Mixed CC" },
      { name: "Jamendo", url: "https://www.jamendo.com", description: "Music released under Creative Commons licenses.", license: "Mixed CC" },
      { name: "ccMixter", url: "http://ccmixter.org", description: "Creative-Commons-licensed remixes and samples.", license: "Mixed CC" },
      { name: "Audionautix", url: "https://audionautix.com", description: "Royalty-free music, all Creative Commons licensed.", license: "Mixed CC" },
    ],
  },
  {
    id: "general", label: "General & Reference", icon: "🌐",
    sources: [
      { name: "Public Domain Review", url: "https://publicdomainreview.org", description: "An online publication exploring and celebrating works in the public domain.", license: "Public Domain" },
      { name: "Creative Commons", url: "https://creativecommons.org", description: "Tools (incl. CC0) and a search portal for openly-licensed works across the web.", license: "Tool" },
    ],
  },
];
