import { useEffect, useRef, useState } from 'react'
import { validateImage } from '../../lib/validation'
import Avatar from '../ui/Avatar'
import Button from '../ui/Button'

/** Picks an avatar image, validating type and size before it is accepted. */
export default function ImageUpload({ name, currentSrc, file, onChange, error, onError }) {
  const inputRef = useRef(null)
  const [preview, setPreview] = useState(null)

  useEffect(() => {
    if (!file) return undefined
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => {
      URL.revokeObjectURL(url)
      setPreview(null)
    }
  }, [file])

  const pick = (event) => {
    const selected = event.target.files?.[0]
    event.target.value = ''
    if (!selected) return
    const problem = validateImage(selected)
    onError(problem)
    if (!problem) onChange(selected)
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar name={name || 'You'} src={preview || currentSrc} size="lg" />
      <div>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={pick} aria-label="Profile photo" tabIndex={-1} />
        <Button variant="secondary" size="sm" onClick={() => inputRef.current.click()}>
          {file ? 'Choose a different photo' : 'Change photo'}
        </Button>
        <p className="mt-1 text-xs text-ink-500">JPEG, PNG or WebP, up to 2 MB.</p>
        {error && (
          <p role="alert" className="mt-1 text-xs font-medium text-red-600">
            {error}
          </p>
        )}
      </div>
    </div>
  )
}
