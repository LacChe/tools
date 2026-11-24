// Turns the HTML stored in the database into a safe DocumentFragment for the entry panel.
//
// The text is parsed in an inert document (nothing runs, nothing loads), then copied node by node into new
// elements. Only the tags in KEEP survive, and they get no attributes except the few listed in cleanAttrs().
// A tag that is not listed is replaced by its text, so no content is lost; tags that can run code or load
// things (DROP) are removed with everything inside them.

const KEEP = new Set([
  "p", "br", "hr", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "blockquote", "pre", "code",
  "strong", "b", "em", "i", "u", "s", "sup", "sub", "small", "mark", "span", "div",
  "table", "caption", "thead", "tbody", "tfoot", "tr", "th", "td", "a",
]);
const DROP = new Set([
  "script", "style", "iframe", "frame", "frameset", "object", "embed", "applet", "link", "meta", "base",
  "form", "input", "button", "textarea", "select", "option", "svg", "math", "noscript", "template", "title",
  "head", "audio", "video", "source", "track", "canvas", "img", "picture",
]);
const SAFE_LINK = new Set(["http:", "https:", "mailto:"]);

function cleanAttrs(from, to) {
  const tag = to.localName;
  if (tag === "a") {
    try {
      const url = new URL(from.getAttribute("href") ?? "", location.href);
      if (SAFE_LINK.has(url.protocol)) { to.setAttribute("href", url.href); to.setAttribute("rel", "noopener noreferrer"); }
    } catch { /* not a URL: keep the text, drop the link */ }
  } else if (tag === "th" || tag === "td") {
    for (const name of ["colspan", "rowspan"]) {
      const v = from.getAttribute(name);
      if (v && /^\d{1,2}$/.test(v)) to.setAttribute(name, v);
    }
  }
}

function copyChildren(from, to) {
  for (const node of from.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      to.append(document.createTextNode(node.data));
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = node.localName;
      if (DROP.has(tag)) continue;
      if (KEEP.has(tag)) {
        const el = document.createElement(tag);
        cleanAttrs(node, el);
        copyChildren(node, el);
        to.append(el);
      } else {
        copyChildren(node, to); // unknown tag: keep its text and children, lose the tag
      }
    } // comments and anything else are dropped
  }
}

export function safeFragment(html) {
  const doc = new DOMParser().parseFromString(String(html ?? ""), "text/html");
  const out = document.createDocumentFragment();
  copyChildren(doc.body, out);
  return out;
}
