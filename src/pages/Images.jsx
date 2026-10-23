import { useRef, useState } from 'react'
import { Image as ImageIcon, ImagePlus, Loader2, Trash2 } from '../components/icons'
import { Button, Card, ConfirmDialog, EmptyState, ErrorNote, PageBody, PageHeader, Sheet, Skeleton } from '../components/ui'
import { useToast } from '../context/ToastContext'
import useResource from '../hooks/useResource'
import { friendly } from '../lib/errors'
import { formatBytes, relativeTime } from '../lib/format'
import { images as api } from '../services'

export default function Images() {
  const toast = useToast()
  const list = useResource(() => api.list(), [])
  const [uploading, setUploading] = useState(0)
  const [openId, setOpenId] = useState(null)
  const [confirm, setConfirm] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const input = useRef(null)

  const items = list.data?.items || []
  const open = items.find((i) => i.id === openId)

  const upload = async (fileList) => {
    for (const file of Array.from(fileList || [])) {
      setUploading((n) => n + 1)
      try { await api.upload(file); setUnavailable(false); list.reload(true); toast.success('Image uploaded') }
      catch (e) {
        if (e.code === 'image_storage_unavailable') setUnavailable(true)
        toast.error(`${file.name}: ${friendly(e)}`)
      } finally { setUploading((n) => n - 1) }
    }
  }
  const remove = async () => {
    try { await api.remove(open.id); toast.success('Image deleted'); setOpenId(null); list.reload(true) } catch (e) { toast.error(friendly(e)); throw e }
  }

  return (
    <>
      <PageHeader title="Images" subtitle="Your private photo library" actions={<Button size="sm" icon={ImagePlus} onClick={() => input.current?.click()}>Add</Button>} />
      <PageBody className="space-y-4">
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => { upload(e.target.files); e.target.value = '' }} />
        {unavailable && <ErrorNote error={friendly({ code: 'image_storage_unavailable' }) + ' Ask the person running Alina to add the Cloudinary keys.'} />}
        <ErrorNote error={list.error} onRetry={list.reload} />
        {list.loading && !list.data ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="aspect-square" />)}</div>
        ) : items.length === 0 && !uploading && !list.error ? (
          <EmptyState icon={ImageIcon} title="No images yet" text="JPEG, PNG or WebP. Files are checked by their real content, not just their name."
            action={<Button icon={ImagePlus} onClick={() => input.current?.click()}>Add an image</Button>} />
        ) : (
          <ul className="stagger grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Array.from({ length: uploading }).map((_, i) => (
              <li key={`u${i}`} className="grid aspect-square place-items-center rounded-3xl border border-line bg-surface"><Loader2 className="size-6 animate-spin text-accent" /></li>
            ))}
            {items.map((img) => (
              <li key={img.id}>
                <button onClick={() => setOpenId(img.id)} className="block aspect-square w-full overflow-hidden rounded-3xl border border-line bg-raised transition active:scale-[.97]">
                  <img src={img.url} alt={img.alt_text || img.original_filename || 'Uploaded image'} loading="lazy" decoding="async" className="size-full object-cover" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </PageBody>

      <Sheet open={!!open} onClose={() => setOpenId(null)} title="Image" size="lg">
        {open && (
          <div className="space-y-4">
            <img src={open.url} alt={open.alt_text || open.original_filename || 'Uploaded image'} className="max-h-[60dvh] w-full rounded-2xl bg-raised object-contain" />
            <Card className="space-y-1 text-sm">
              {open.original_filename && <p className="truncate font-medium">{open.original_filename}</p>}
              <p className="text-muted">{open.width}×{open.height} · {open.format.toUpperCase()} · {formatBytes(open.bytes)} · {relativeTime(open.created_at)}</p>
              {open.alt_text && <p className="pt-1">{open.alt_text}</p>}
            </Card>
            <Button variant="danger" icon={Trash2} onClick={() => setConfirm(true)}>Delete image</Button>
          </div>
        )}
      </Sheet>
      <ConfirmDialog open={confirm} onClose={() => setConfirm(false)} onConfirm={remove} danger confirmLabel="Delete" title="Delete this image?" text="It is permanently removed from Alina and from image storage." />
    </>
  )
}
