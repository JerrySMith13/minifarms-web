# Mini Farms USA — Page Design System

This document describes how pages in this project are built, so a new page can
be created that looks and behaves consistently with the existing ones
(`index.html`, `about.html`, `contact.html`, `blog.html`, `blog-post.html`).

## 1. File structure

```
templates/
  index.html
  about.html
  contact.html
  blog.html
  blog-post.html
  partials/
    blog-card.html
  css/
    common.css     <- shared styles, load on every page, load FIRST
    home.css        <- page-specific, load AFTER common.css
    about.css
    contact.css
    blog.css
    blog-post.css
```

Every page has **one CSS file dedicated to it** plus `common.css`. Never put
page-specific rules in `common.css`, and never duplicate shared rules
(navbar, footer, buttons, container, colors, fonts) in a page-specific file.

When adding a new page `foo.html`, also add `css/foo.css` and link both:

```html
<link rel="stylesheet" href="css/common.css" />
<link rel="stylesheet" href="css/foo.css" />
```

## 2. Boilerplate every page must have

```html
<!doctype html>
<html lang="en">
	<head>
		<meta charset="UTF-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0" />
		<title>Page Title | Mini Farms USA</title>
		<link rel="stylesheet" href="css/common.css" />
		<link rel="stylesheet" href="css/foo.css" />
	</head>
	<body>
		<!-- navbar -->
		<!-- page content -->
		<!-- footer -->
	</body>
</html>
```

Notes:
- Indentation uses **tabs**, not spaces.
- `blog.html`/`blog-post.html` use root-relative CSS paths (`/css/common.css`);
  other pages use relative paths (`css/common.css`). Match whichever sibling
  page your new page most resembles, or prefer root-relative (`/css/...`) if
  the new page can live at any URL depth.
- HTML comments (`<!-- ================= SECTION NAME ================= -->`)
  mark every major section. Keep doing this — it's how the templates
  communicate structure to both humans and the Worker that populates them.

## 3. Navbar (identical markup on every page)

```html
<header class="navbar">
	<div class="navbar-logo">
		<div class="navbar-logo-placeholder">MF</div>
		<span class="navbar-logo-text">Mini Farms USA</span>
	</div>
	<nav class="navbar-links">
		<ul>
			<li><a href="index.html">Home</a></li>
			<li><a href="about.html">About Us</a></li>
			<li><a href="blog.html">Blog</a></li>
			<li><a href="contact.html">Contact Us</a></li>
		</ul>
	</nav>
</header>
```

Add `class="active"` to the `<a>` matching the current page. `.navbar` is
`position: sticky; top: 0;`, so it stays pinned while scrolling.

## 4. Footer (identical structure, links vary by page)

```html
<footer class="site-footer">
	<div class="footer-content">
		<p class="footer-copyright">
			&copy; 2026 Mini Farms USA. All rights reserved.
		</p>
		<nav class="footer-links">
			<ul>
				<li><a href="index.html">Home</a></li>
				<!-- every page except itself -->
			</ul>
		</nav>
	</div>
</footer>
```

Convention: the footer link list omits a link to the current page (see how
`about.html`'s footer excludes "About Us").

## 5. Page body pattern

Every page's main content lives inside one or more:

```html
<section class="section-padding">
	<div class="container">
		<!-- content -->
	</div>
</section>
```

- `.section-padding` gives consistent top/bottom breathing room
  (`--section-padding-y`, 4rem by default).
- `.container` caps content width (`--container-max-width`, 1100px) and
  centers it.
- Add `.section-alt-bg` to a section to give it the light gray alternate
  background (`--color-bg-alt`), useful for visually separating stacked
  sections (see the blog preview section on `index.html`).

Don't invent a new content wrapper — always nest section content in
`.container` unless building something intentionally full-bleed (like `.hero`).

## 6. Design tokens (`common.css` `:root`)

All colors, fonts, and sizing are CSS custom properties. **Never hard-code a
hex color or px font size in a page-specific stylesheet** — reference the
variable so the whole site can be re-themed by editing `common.css` alone.

```css
/* Brand colors */
--color-primary: #2e7d32;       /* buttons, links, highlights */
--color-primary-dark: #1b5e20;  /* hover states on primary elements */
--color-secondary: #f9a825;     /* accent/gold, used sparingly */

/* Neutrals */
--color-text: #222222;
--color-text-light: #5a5a5a;    /* muted text: captions, meta info */
--color-bg: #ffffff;
--color-bg-alt: #f5f5f0;        /* alternate section background */
--color-border: #e0e0e0;

/* Navbar / footer */
--color-nav-bg: #1b1b1b;
--color-nav-text: #ffffff;
--color-nav-text-hover: var(--color-secondary);

/* Overlay on top of background images */
--color-overlay: rgba(0, 0, 0, 0.45);

/* Fonts */
--font-heading: Georgia, "Times New Roman", serif;   /* h1-h4 */
--font-body: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;

--font-scale: 1;                 /* global multiplier */
--font-size-base: calc(1rem * var(--font-scale));
--font-size-small: calc(0.875rem * var(--font-scale));
--font-size-h1: calc(2.5rem * var(--font-scale));
--font-size-h2: calc(2rem * var(--font-scale));
--font-size-h3: calc(1.5rem * var(--font-scale));

/* Layout */
--container-max-width: 1100px;
--section-padding-y: 4rem;
--section-padding-x: 1.5rem;
```

Design intent: earthy green brand color, serif headings for warmth, sans-serif
body for readability, generous whitespace, rounded corners (`4px`–`8px`),
subtle borders instead of heavy shadows.

## 7. Reusable components

### Buttons

```html
<a href="contact.html" class="btn btn-primary">Get Involved</a>
```

- `.btn` — base: padding, rounded corners, bold uppercase small text.
- `.btn-primary` — solid brand-green background, white text.
- `.btn-outline` — transparent with white border/text; use on top of dark or
  photo backgrounds (e.g. inside `.hero`), never on plain white backgrounds.

### Hero banner (full-width photo section)

Used at the top of `index.html`. Copy this pattern for any new page that
needs a big photo banner:

```html
<section class="hero">
	<div class="hero-overlay"></div>
	<div class="hero-content">
		<h1>Heading</h1>
		<p>Supporting copy.</p>
		<a href="contact.html" class="btn btn-primary">Call to Action</a>
	</div>
</section>
```

```css
.hero {
	position: relative;
	min-height: 70vh;
	background-image: url("../images/your-image.jpg");
	background-size: cover;
	background-position: center;
	display: flex;
	align-items: center;
	justify-content: center;
}
.hero-overlay {
	position: absolute;
	inset: 0;
	background-color: var(--color-overlay);
}
.hero-content {
	position: relative;
	z-index: 1;
	text-align: center;
	color: #ffffff;
	max-width: 700px;
	padding: 0 1.5rem;
}
```

The overlay darkens the photo so white text stays legible — always include it.

### Blog post cards

Defined once in `partials/blog-card.html` and re-styled identically in both
`blog.css` and `home.css`. Reuse this exact markup and class names anywhere a
blog preview card is needed:

```html
<article class="blog-post-card">
	<a data-dynamic="link" href="">
		<img class="blog-post-image" data-dynamic="image-link" src="" alt="" />
	</a>
	<div class="blog-post-body">
		<p class="blog-post-meta">
			<span class="blog-post-category" data-dynamic="category">Category</span>
			&middot;
			By <span data-dynamic="author">Author Name</span>
			&middot;
			<span data-dynamic="date">Post Date</span>
		</p>
		<h3 class="blog-post-title" data-dynamic="title">Post Title</h3>
		<p class="blog-post-excerpt" data-dynamic="content">Post excerpt goes here.</p>
		<a class="blog-post-readmore" data-dynamic="link" href="">Read More &rarr;</a>
	</div>
</article>
```

Cards live in a `.blog-list` grid (`repeat(3, 1fr)`, collapsing to 2 columns
at 900px and 1 column at 600px).

### Two-column text/image layout

Used by `about.html`: a `3fr` text column beside a `2fr` stacked-image
column, collapsing to a single column at 768px. Reuse `.about-section`-style
grid for any "story + photos" layout.

### Icon-label-value list

Used by `contact.html` for contact methods: a round colored icon badge next
to a small uppercase label and a bold value. Reuse for any "list of items
with an icon" pattern.

## 8. Dynamic content convention (`data-dynamic`)

Pages that receive server-injected content (via the Cloudflare Worker) mark
the injection point with a `data-dynamic="<key>"` attribute rather than a
special class:

```html
<h1 class="post-title" data-dynamic="title">Post Title</h1>
```

- The attribute value is the data key the Worker looks up.
- The element's existing text/attribute (e.g. placeholder copy, empty `src`,
  empty `href`) is what gets replaced — keep placeholder content present so
  the template previews sensibly before population.
- `data-dynamic="image-link"` is used on `src` of `<img>` tags.
- `data-dynamic="link"` is used on `href` of `<a>` tags.
- When the same value must populate two places at once (e.g. post title in
  both `<title>` and the on-page `<h1>`), put `data-dynamic` on both
  elements — see `blog-post.html`.

Follow this convention for any new page the Worker needs to populate
dynamically; don't invent a new mechanism.

## 9. Responsive breakpoints

Use these two breakpoints consistently (don't introduce new arbitrary ones):

- `@media (max-width: 900px)` — grids go from 3 columns to 2.
- `@media (max-width: 768px)` — two-column layouts (text/image) stack to 1.
- `@media (max-width: 640px)` — navbar stacks vertically.
- `@media (max-width: 600px)` — grids go to 1 column; hero/post text/heights
  shrink for mobile.

## 10. Checklist for adding a new page

1. Copy the boilerplate `<head>` and `<body>` structure from the closest
   existing page (navbar + footer identical, just update the `active` link
   and footer link list).
2. Create `css/<page>.css`, link it after `common.css`.
3. Wrap content in `<section class="section-padding"><div class="container">`.
4. Reuse existing components (`.btn`, `.hero`, `.blog-post-card`, etc.)
   wherever the new page's content matches an existing pattern instead of
   writing new CSS.
5. Reference only `var(--color-*)`, `var(--font-*)`, and `var(--section-*)`
   tokens from `common.css` — no hard-coded colors or magic font sizes.
6. Add `data-dynamic="..."` attributes on any element the Worker will
   populate at runtime.
7. Add responsive rules only at the standard breakpoints listed above.
