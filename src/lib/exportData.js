import { chats, files, images, memory, reminders, settings, tasks } from '../services'

async function all(fetchPage) {
  const out = []
  for (let page = 1; page < 200; page++) {
    const res = await fetchPage(page)
    out.push(...res.items)
    if (!res.has_more) break
  }
  return out
}

/** Collects everything the signed-in user owns (file *metadata*, not file contents) and downloads it as JSON. */
export async function exportMyData(user, onProgress = () => {}) {
  onProgress('Collecting settings, memory, tasks and reminders…')
  const [cfg, mem, tsk, rem, fls, imgs, chatList] = await Promise.all([
    settings.get(), all((p) => memory.list({ page: p, page_size: 100 })), all((p) => tasks.list({ page: p, page_size: 100 })),
    all((p) => reminders.list({ page: p, page_size: 100 })), all((p) => files.list({ page: p, page_size: 100 })),
    all((p) => images.list({ page: p, page_size: 100 })), all((p) => chats.list({ page: p, page_size: 100 })),
  ])
  const conversations = []
  for (const [i, c] of chatList.entries()) {
    onProgress(`Collecting conversations (${i + 1}/${chatList.length})…`)
    const messages = await all((p) => chats.messages(c.id, { page: p, page_size: 100, order: 'asc' }))
    conversations.push({ ...c, messages })
  }
  const data = {
    exported_at: new Date().toISOString(),
    account: { email: user.email, display_name: user.display_name, created_at: user.created_at },
    settings: cfg, memories: mem, tasks: tsk, reminders: rem,
    files: fls.map(({ id, filename, size, status, created_at }) => ({ id, filename, size, status, created_at })),
    images: imgs.map(({ id, original_filename, width, height, bytes, created_at, alt_text }) => ({ id, original_filename, width, height, bytes, created_at, alt_text })),
    conversations,
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `alina-export-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
  return { chats: conversations.length, memories: mem.length, tasks: tsk.length, reminders: rem.length }
}
