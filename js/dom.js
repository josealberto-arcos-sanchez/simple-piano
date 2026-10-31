// Helper declarativo para construir DOM: el(tag, attrs, ...children).
// Seguro frente a XSS: siempre usa textContent (nunca innerHTML con datos).
//
// - attrs acepta: className, text, title, type, style (objeto), dataset, on
//   (mapa { evento: handler }) y cualquier otro atributo (se aplica con setAttribute).
// - children pueden ser cadenas/números (se vuelven nodos de texto), nodos ya
//   creados o arrays (se achatan); null/undefined/false se ignoran.

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(attrs)) {
    if (value == null) continue;
    switch (key) {
      case 'class':
      case 'className':
        node.className = value;
        break;
      case 'text':
        node.textContent = value;
        break;
      case 'style':
        if (typeof value === 'string') node.setAttribute('style', value);
        else Object.assign(node.style, value);
        break;
      case 'dataset':
        Object.assign(node.dataset, value);
        break;
      case 'on':
        for (const [ev, fn] of Object.entries(value)) node.addEventListener(ev, fn);
        break;
      default:
        if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
        else node.setAttribute(key, value);
    }
  }

  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    node.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }

  return node;
}
