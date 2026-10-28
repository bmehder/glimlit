/// A lit-html template returned by a JavaScript view. The rendering layer owns
/// mounting or hydrating it; the view does not write to the DOM.
pub type View

/// The HTMLElement owned by one running app instance. The host supplies it.
pub type Root

/// Instance identity and the browser root, when available. JavaScript views
/// receive this as their third argument. Use context.id for element IDs.
pub type Context
