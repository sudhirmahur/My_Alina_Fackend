// Tiny cross-component signal so the chat list refreshes when a conversation changes.
export const chatsChanged = () => window.dispatchEvent(new Event('alina:chats-changed'))
export const onChatsChanged = (fn) => { window.addEventListener('alina:chats-changed', fn); return () => window.removeEventListener('alina:chats-changed', fn) }
